import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogService } from '../common/audit/audit-log.service';
import { LicenseService } from '../license/license.service';
import { MailService } from '../mail/mail.service';
import { StudentService } from '../student/student.service';
import { LICENSE_REQUEST_REPOSITORY } from './interfaces/repository.interface';
import type { ILicenseRequestRepository } from './interfaces/repository.interface';
import {
  LicenseRequest,
  LicenseRequestStatus,
} from './schemas/license-request.schema';
import { ApproveLicenseRequestDto } from './dto/license-request.dto';
import { PhotoType } from '../image/types/photoType.enum';
import { ImagesService } from '../image/image.service';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
};

@Injectable()
export class LicenseRequestService {
  constructor(
    @Inject(LICENSE_REQUEST_REPOSITORY)
    private readonly repository: ILicenseRequestRepository<LicenseRequest>,
    private readonly studentService: StudentService,
    private readonly licenseService: LicenseService,
    private readonly imagesService: ImagesService,
    private readonly mailService: MailService,
    private readonly auditLog: AuditLogService,
  ) {}

  async createRequest(studentId: string): Promise<LicenseRequest> {
    const requests = await this.repository.findByStudentId(studentId);
    const existingPendingInitial = requests.find(
      (request) =>
        request.status === LicenseRequestStatus.PENDING &&
        request.type === 'initial',
    );

    if (existingPendingInitial) {
      throw new BadRequestException(
        'Você já possui uma solicitação em andamento. Aguarde a análise antes de enviar uma nova.',
      );
    }

    const request = await this.repository.create({
      studentId,
      type: 'initial',
      status: LicenseRequestStatus.PENDING,
      rejectionReason: null,
      cancellationReason: null,
      rejectedAt: null,
      approvedByEmployeeId: null,
      rejectedByEmployeeId: null,
      licenseId: null,
      pendingImages: [],
      changedDocuments: [],
    });

    await this.auditLog.record({
      action: 'license_request.create',
      outcome: 'success',
      target: { studentId },
    });

    return request;
  }

  async cancelAndReplaceWithUpdate(
    studentId: string,
    changedDocuments: PhotoType[],
    pendingImages: Partial<Record<PhotoType, string>>,
  ): Promise<LicenseRequest> {
    const requests = await this.repository.findByStudentId(studentId);
    const hasApprovedRequest = requests.some(
      (request) => request.status === LicenseRequestStatus.APPROVED,
    );

    if (!hasApprovedRequest) {
      throw new BadRequestException(
        'Só é possível solicitar alteração de documentos após a aprovação da carteirinha inicial.',
      );
    }

    const pendingUpdate = requests.find(
      (request) =>
        request.status === LicenseRequestStatus.PENDING && request.type === 'update',
    );

    if (pendingUpdate) {
      throw new BadRequestException(
        'Você já possui uma solicitação de alteração de documentos em andamento.',
      );
    }

    const pendingInitial = requests.find(
      (request) =>
        request.status === LicenseRequestStatus.PENDING && request.type === 'initial',
    );

    if (pendingInitial) {
      await this.repository.update((pendingInitial as any)._id.toString(), {
        status: LicenseRequestStatus.CANCELLED,
        cancellationReason: 'document_update',
      });
    }

    const request = await this.repository.create({
      studentId,
      type: 'update',
      status: LicenseRequestStatus.PENDING,
      rejectionReason: null,
      cancellationReason: null,
      rejectedAt: null,
      approvedByEmployeeId: null,
      rejectedByEmployeeId: null,
      licenseId: null,
      pendingImages: Object.entries(pendingImages).map(
        ([photoType, dataUrl]) => ({ photoType, dataUrl }),
      ),
      changedDocuments,
    });

    await this.auditLog.record({
      action: 'license_request.create_update',
      outcome: 'success',
      target: { studentId },
      metadata: { changedDocuments },
    });

    return request;
  }

  async approve(
    requestId: string,
    employeeId: string,
    dto: ApproveLicenseRequestDto,
  ): Promise<LicenseRequest> {
    const request = await this.repository.findById(requestId);
    if (!request) throw new NotFoundException('Solicitação não encontrada');
    if (request.status !== LicenseRequestStatus.PENDING) {
      throw new BadRequestException('Solicitação não está pendente');
    }

    let license: { _id: { toString(): string } };

    if (request.type === 'update') {
      const changedDocuments = request.changedDocuments ?? [];
      const images = await this.imagesService.findByStudentId(request.studentId);
      const pendingMap = Object.fromEntries(
        (request.pendingImages ?? []).map((p) => [p.photoType, p.dataUrl]),
      );

      for (const photoType of changedDocuments) {
        const image = images.find((item) => item.photoType === photoType);
        if (!image) {
          throw new NotFoundException(
            `Imagem do tipo ${photoType} não encontrada para arquivamento`,
          );
        }

        const imageId = (image as any)._id.toString();
        await this.imagesService.archiveToHistory(imageId);
      }

      const updatedLicense = await this.licenseService.regenerateExistingForStudent(
        request.studentId,
        {
          institution: dto.institution,
          bus: dto.bus,
          photo: dto.photo,
        },
        employeeId,
      );

      for (const photoType of changedDocuments) {
        const pendingDataUrl = pendingMap[photoType];
        if (!pendingDataUrl) continue;

        await this.studentService.createOrUpdateImage(
          request.studentId,
          photoType,
          this.dataUrlToUploadedFile(pendingDataUrl, photoType),
        );
      }

      license = updatedLicense as any;
    } else {
      const createdLicense = await this.licenseService.create(
        {
          id: request.studentId,
          institution: dto.institution,
          bus: dto.bus,
          photo: dto.photo,
        },
        employeeId,
      );

      license = createdLicense as any;
    }

    const licenseId = license._id.toString();

    const updated = await this.repository.update(requestId, {
      status: LicenseRequestStatus.APPROVED,
      approvedByEmployeeId: employeeId,
      licenseId,
      pendingImages: [],
    });

    if (request.type === 'update') {
      const student = await this.studentService.findOneOrFail(request.studentId);

      await this.mailService
        .sendDocumentUpdateApproved(
          student.email,
          student.name,
          request.changedDocuments ?? [],
        )
        .catch(() => {});
    }

    await this.auditLog.record({
      action: 'license_request.approve',
      outcome: 'success',
      actor: { id: employeeId, role: 'employee' },
      target: { studentId: request.studentId, requestId },
    });

    return updated!;
  }

  async reject(
    requestId: string,
    employeeId: string,
    reason: string,
  ): Promise<LicenseRequest> {
    const request = await this.repository.findById(requestId);
    if (!request) throw new NotFoundException('Solicitação não encontrada');
    if (request.status !== LicenseRequestStatus.PENDING) {
      throw new BadRequestException('Solicitação não está pendente');
    }

    const updated = await this.repository.update(requestId, {
      status: LicenseRequestStatus.REJECTED,
      rejectionReason: reason,
      rejectedAt: new Date(),
      rejectedByEmployeeId: employeeId,
    });

    const student = await this.studentService.findOneOrFail(request.studentId);

    if (request.type === 'update') {
      await this.mailService
        .sendDocumentUpdateRejected(student.email, student.name, reason)
        .catch(() => {});
    } else {
      await this.mailService
        .sendLicenseRejection(student.email, student.name, reason)
        .catch(() => {});
    }

    await this.auditLog.record({
      action: 'license_request.reject',
      outcome: 'success',
      actor: { id: employeeId, role: 'employee' },
      target: { studentId: request.studentId, requestId },
      metadata: { reason },
    });

    return updated!;
  }

  async findAll(): Promise<LicenseRequest[]> {
    return this.repository.findAll();
  }

  async findPending(): Promise<LicenseRequest[]> {
    return this.repository.findAllByStatus(LicenseRequestStatus.PENDING);
  }

  async findByStudentId(studentId: string): Promise<LicenseRequest[]> {
    return this.repository.findByStudentId(studentId);
  }

  async findMyLatest(studentId: string): Promise<LicenseRequest | null> {
    const requests = await this.repository.findByStudentId(studentId);
    return requests[0] ?? null;
  }

  private dataUrlToUploadedFile(
    dataUrl: string,
    photoType: PhotoType,
  ): UploadedImageFile {
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!match) {
      throw new BadRequestException(
        `Arquivo pendente inválido para o tipo ${photoType}`,
      );
    }

    return {
      mimetype: match[1],
      buffer: Buffer.from(match[2], 'base64'),
      originalname: `${photoType}`,
    };
  }
}
