import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import mongoose, { ClientSession } from 'mongoose';
import { AuditLogService } from '../common/audit/audit-log.service';
import { EnrollmentPeriodService } from '../enrollment-period/enrollment-period.service';
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
import { Types } from 'mongoose';
import { BusService } from '../bus/bus.service';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
};

@Injectable()
export class LicenseRequestService {
  private readonly logger = new Logger(LicenseRequestService.name);

  constructor(
    @Inject(LICENSE_REQUEST_REPOSITORY)
    private readonly repository: ILicenseRequestRepository<LicenseRequest>,
    @Inject(forwardRef(() => EnrollmentPeriodService))
    private readonly enrollmentPeriodService: EnrollmentPeriodService,
    private readonly studentService: StudentService,
    private readonly busService: BusService,
    private readonly licenseService: LicenseService,
    private readonly imagesService: ImagesService,
    private readonly mailService: MailService,
    private readonly auditLog: AuditLogService,
  ) {}

  async assertInitialRequestEligibility(studentId: string): Promise<void> {
    const requests = await this.repository.findByStudentId(studentId);
    const existingPendingOrWaitlistedInitial = requests.find(
      (request) =>
        (request.status === LicenseRequestStatus.PENDING ||
          request.status === LicenseRequestStatus.WAITLISTED) &&
        request.type === 'initial',
    );

    if (existingPendingOrWaitlistedInitial) {
      throw new BadRequestException(
        'Você já possui uma solicitação em andamento. Aguarde a análise antes de enviar uma nova.',
      );
    }

    const activePeriod = await this.enrollmentPeriodService.getActive();

    if (!activePeriod) {
      throw new BadRequestException(
        'Inscrições encerradas. Aguarde a abertura de um novo período.',
      );
    }

    this.assertPeriodWindow(activePeriod.startDate, activePeriod.endDate);
  }

  async createRequest(studentId: string): Promise<LicenseRequest> {
    const requests = await this.repository.findByStudentId(studentId);
    const existingPendingOrWaitlistedInitial = requests.find(
      (request) =>
        (request.status === LicenseRequestStatus.PENDING ||
          request.status === LicenseRequestStatus.WAITLISTED) &&
        request.type === 'initial',
    );

    if (existingPendingOrWaitlistedInitial) {
      throw new BadRequestException(
        'Você já possui uma solicitação em andamento. Aguarde a análise antes de enviar uma nova.',
      );
    }

    const activePeriod = await this.enrollmentPeriodService.getActive();

    if (!activePeriod) {
      throw new BadRequestException(
        'Inscrições encerradas. Aguarde a abertura de um novo período.',
      );
    }

    this.assertPeriodWindow(activePeriod.startDate, activePeriod.endDate);

    const enrollmentPeriodId = (activePeriod as any)._id?.toString?.();
    if (!enrollmentPeriodId) {
      throw new BadRequestException('Período de inscrição inválido.');
    }

    // Resolve student and their university to snapshot into the request
    const student = await this.studentService.findOneOrFail(studentId);
    const universityIdForRequest = (student as any).universityId
      ? (student as any).universityId
      : null;

    if (!universityIdForRequest) {
      throw new BadRequestException('Cadastre sua instituição antes de se inscrever.');
    }

    // Find the bus that serves this university (the bus with lowest priorityOrder)
    const bus = await this.busService.findByUniversityId(
      typeof universityIdForRequest === 'string'
        ? universityIdForRequest
        : (universityIdForRequest as any)?.toString?.(),
    );

    if (!bus) {
      throw new BadRequestException('Nenhum ônibus disponível para sua instituição.');
    }

    const busIdForRequest = typeof (bus as any)._id === 'string' ? (bus as any)._id : (bus as any)._id?.toString?.();

    // If bus has no capacity defined, accept as PENDING
    if ((bus as any).capacity == null) {
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
        enrollmentPeriodId,
        filaPosition: null,
        busId: busIdForRequest
          ? (typeof busIdForRequest === 'string' ? new Types.ObjectId(busIdForRequest) : busIdForRequest)
          : null,
        universityId: typeof universityIdForRequest === 'string' ? new Types.ObjectId(universityIdForRequest) : universityIdForRequest,
      });

      await this.auditLog.record({
        action: 'license_request.create',
        outcome: 'success',
        target: { studentId, enrollmentPeriodId },
        metadata: { busId: busIdForRequest, universityId: universityIdForRequest },
      });

      return { ...(request as any), waitlisted: false };
    }

    // If bus has capacity, check total filled slots
    const totalFilled = ((bus as any).universitySlots || []).reduce(
      (acc: number, s: any) => acc + (s.filledSlots || 0),
      0,
    );

    if ((bus as any).capacity != null && totalFilled >= (bus as any).capacity) {
      // Assign filaPosition scoped to this bus (per-bus queue)
      const filaCount = await this.repository.countWaitlistedByEnrollmentPeriodAndBus(enrollmentPeriodId, busIdForRequest as string);
      const filaPosition = (filaCount || 0) + 1;

      const request = await this.repository.create({
        studentId,
        type: 'initial',
        status: LicenseRequestStatus.WAITLISTED,
        rejectionReason: null,
        cancellationReason: null,
        rejectedAt: null,
        approvedByEmployeeId: null,
        rejectedByEmployeeId: null,
        licenseId: null,
        pendingImages: [],
        changedDocuments: [],
        enrollmentPeriodId,
        filaPosition,
        busId: busIdForRequest
          ? (typeof busIdForRequest === 'string' ? new Types.ObjectId(busIdForRequest) : busIdForRequest)
          : null,
        universityId: typeof universityIdForRequest === 'string' ? new Types.ObjectId(universityIdForRequest) : universityIdForRequest,
      });

      try {
        await this.mailService.sendWaitlistConfirmation(student.email, student.name, filaPosition);
      } catch (error) {
        this.logger.warn(`Falha ao enviar email de confirmacao de fila para ${studentId}: ${(error as Error)?.message}`);
      }

      await this.auditLog.record({
        action: 'license_request.waitlisted',
        outcome: 'success',
        target: { studentId, enrollmentPeriodId },
        metadata: { filaPosition, busId: busIdForRequest, universityId: universityIdForRequest },
      });

      return { ...(request as any), waitlisted: true, filaPosition };
    }

    // Find the student's slot in the bus
    const studentSlot = ((bus as any).universitySlots || []).find((s: any) =>
      (s.universityId && s.universityId.toString ? s.universityId.toString() : s.universityId) ===
      (typeof universityIdForRequest === 'string' ? universityIdForRequest : (universityIdForRequest as any)?.toString?.()),
    );

    if (!studentSlot) {
      throw new BadRequestException('Sua instituição não está vinculada a este ônibus.');
    }

    // Check if any higher-priority university has active demand for this bus
    const higherPrioritySlots = ((bus as any).universitySlots || []).filter(
      (s: any) => (s.priorityOrder || 0) < (studentSlot.priorityOrder || 0),
    );

    for (const slot of higherPrioritySlots) {
      const uniIdStr = slot.universityId && slot.universityId.toString ? slot.universityId.toString() : slot.universityId;
      const hasDemand = await this.repository.hasActiveDemandForBusAndUniversity(
        busIdForRequest as string,
        typeof uniIdStr === 'string' ? uniIdStr : uniIdStr?.toString?.(),
      );
      if (hasDemand) {
        // Assign filaPosition scoped to this bus (per-bus queue)
        const filaCount = await this.repository.countWaitlistedByEnrollmentPeriodAndBus(enrollmentPeriodId, busIdForRequest as string);
        const filaPosition = (filaCount || 0) + 1;

        const request = await this.repository.create({
          studentId,
          type: 'initial',
          status: LicenseRequestStatus.WAITLISTED,
          rejectionReason: null,
          cancellationReason: null,
          rejectedAt: null,
          approvedByEmployeeId: null,
          rejectedByEmployeeId: null,
          licenseId: null,
          pendingImages: [],
          changedDocuments: [],
          enrollmentPeriodId,
          filaPosition,
          busId: busIdForRequest
            ? (typeof busIdForRequest === 'string' ? new Types.ObjectId(busIdForRequest) : busIdForRequest)
            : null,
          universityId: typeof universityIdForRequest === 'string' ? new Types.ObjectId(universityIdForRequest) : universityIdForRequest,
        });

        try {
          await this.mailService.sendWaitlistConfirmation(student.email, student.name, filaPosition);
        } catch (error) {
          this.logger.warn(`Falha ao enviar email de confirmacao de fila para ${studentId}: ${(error as Error)?.message}`);
        }

        await this.auditLog.record({
          action: 'license_request.waitlisted',
          outcome: 'success',
          target: { studentId, enrollmentPeriodId },
          metadata: { filaPosition, busId: busIdForRequest, universityId: universityIdForRequest },
        });

        return { ...(request as any), waitlisted: true, filaPosition };
      }
    }

    // Passed all checks -> create PENDING
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
      enrollmentPeriodId,
      filaPosition: null,
      busId: busIdForRequest
        ? (typeof busIdForRequest === 'string' ? new Types.ObjectId(busIdForRequest) : busIdForRequest)
        : null,
      universityId: typeof universityIdForRequest === 'string' ? new Types.ObjectId(universityIdForRequest) : universityIdForRequest,
    });

    await this.auditLog.record({
      action: 'license_request.create',
      outcome: 'success',
      target: { studentId, enrollmentPeriodId },
      metadata: { busId: busIdForRequest, universityId: universityIdForRequest },
    });

    return { ...(request as any), waitlisted: false };
  }

  async submitDocumentUpdateRequest(
    studentId: string,
    changedDocumentsRaw: string,
    files: {
      ProfilePhoto?: UploadedImageFile[];
      EnrollmentProof?: UploadedImageFile[];
      CourseSchedule?: UploadedImageFile[];
    },
  ): Promise<LicenseRequest> {
    const existingDocuments = await this.imagesService.findByStudentId(studentId);

    if (existingDocuments.length === 0) {
      throw new BadRequestException(
        'Você precisa enviar seus documentos pela primeira vez antes de solicitar alterações.',
      );
    }

    const changedDocuments = this.parseChangedDocuments(changedDocumentsRaw);

    const profileFile = files?.ProfilePhoto?.[0];
    const enrollmentFile = files?.EnrollmentProof?.[0];
    const scheduleFile = files?.CourseSchedule?.[0];

    const fileByType: Partial<Record<PhotoType, UploadedImageFile | undefined>> = {
      [PhotoType.ProfilePhoto]: profileFile,
      [PhotoType.EnrollmentProof]: enrollmentFile,
      [PhotoType.CourseSchedule]: scheduleFile,
    };

    const pendingImages: Partial<Record<PhotoType, string>> = {};

    for (const photoType of changedDocuments) {
      const file = fileByType[photoType];
      if (!file) {
        throw new BadRequestException(
          `Arquivo não enviado para o tipo ${photoType}`,
        );
      }

      pendingImages[photoType] = this.toDataUrl(file);
    }

    return this.cancelAndReplaceWithUpdate(
      studentId,
      changedDocuments,
      pendingImages,
    );
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

    let validityMonths = 6;
    let reservedPeriodId: string | null = null;
    let busIncremented = false;
    let busIdForIncrement: string | null = null;
    let uniIdForIncrement: string | null = null;
    let session: ClientSession | undefined = undefined;
    let usedSession = false;
    if (request.type === 'initial' && request.enrollmentPeriodId) {
      const period = await this.enrollmentPeriodService.findById(
        request.enrollmentPeriodId,
      );
      validityMonths = period?.licenseValidityMonths ?? 6;

      // Try to start a mongoose session for transactional update. If unavailable, fall back to non-transactional path.
      // Only start a session if mongoose is connected. In test environment mongoose
      // may not be connected which would cause startSession to hang or behave
      // unexpectedly. Fall back to non-transactional path when not connected.
      if (mongoose?.connection?.readyState === 1) {
        try {
          session = await mongoose.startSession();
        } catch (err) {
          session = undefined;
        }
      } else {
        session = undefined;
      }

      if (session) {
        try {
          usedSession = true;
          await session.withTransaction(async () => {
              // increment enrollment period within transaction
              await this.enrollmentPeriodService.incrementFilled(request.enrollmentPeriodId as string, session);
              reservedPeriodId = request.enrollmentPeriodId;

              // If this request has a bus/university snapshot, increment bus filledSlots now (inside transaction)
              if ((request as any).busId && (request as any).universityId) {
                const rawBus = (request as any).busId;
                const rawUni = (request as any).universityId;
                busIdForIncrement = typeof rawBus === 'string' ? rawBus : rawBus?.toString?.();
                uniIdForIncrement = typeof rawUni === 'string' ? rawUni : rawUni?.toString?.();
                if (busIdForIncrement && uniIdForIncrement) {
                  await this.busService.incrementUniversityFilledSlots(busIdForIncrement, uniIdForIncrement, session);
                  busIncremented = true;
                }
              }

              // create license (will use session in repository)
              let licenseCreated: any;
              if (request.type === 'update') {
                // update license path handled below outside transaction creation path
              } else {
                licenseCreated = await this.licenseService.create(
                  {
                    id: request.studentId,
                    institution: dto.institution,
                    bus: dto.bus,
                    photo: dto.photo,
                  },
                  employeeId,
                  validityMonths,
                  request.enrollmentPeriodId ?? null,
                  true,
                  session,
                );
              }

            // Update request as approved within transaction
            const licenseIdStr = (licenseCreated as any)?._id?.toString?.();
            await this.repository.update(requestId, {
              status: LicenseRequestStatus.APPROVED,
              approvedByEmployeeId: employeeId,
              licenseId: licenseIdStr ?? null,
              pendingImages: [],
            }, session);
          });
        } finally {
          session.endSession();
        }
      } else {
        // Fallback non-transactional path (existing logic)
        await this.enrollmentPeriodService.incrementFilled(
          request.enrollmentPeriodId as string,
        );
        reservedPeriodId = request.enrollmentPeriodId;

        // If this request has a bus/university snapshot, increment bus filledSlots now (non-transactional path)
        if ((request as any).busId && (request as any).universityId) {
          const rawBus = (request as any).busId;
          const rawUni = (request as any).universityId;
          busIdForIncrement = typeof rawBus === 'string' ? rawBus : rawBus?.toString?.();
          uniIdForIncrement = typeof rawUni === 'string' ? rawUni : rawUni?.toString?.();
          if (busIdForIncrement && uniIdForIncrement) {
            await this.busService.incrementUniversityFilledSlots(busIdForIncrement, uniIdForIncrement);
            busIncremented = true;
          }
        }
      }
    }

    let license: { _id: { toString(): string } } | null = null;
    try {
      if (usedSession) {
        // When usedSession is true, license creation and request update were already handled inside the transaction above.
        // We still need to retrieve the license id for audit logging; set license = null to indicate already processed.
        license = null;
      } else if (request.type === 'update') {
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
          validityMonths,
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
          validityMonths,
          request.enrollmentPeriodId ?? null,
          true,
        );

        license = createdLicense as any;
      }
    } catch (error) {
      if (!usedSession) {
        if (reservedPeriodId) {
          await this.enrollmentPeriodService.decrementFilled(reservedPeriodId);
        }
        if (busIncremented && busIdForIncrement && uniIdForIncrement) {
          await this.busService.decrementUniversityFilledSlots(busIdForIncrement, uniIdForIncrement);
        }
      }
      throw error;
    }

    if (!usedSession) {
      // If the bus snapshot exists, increment its filledSlots now (non-transactional path)
      if (busIdForIncrement && uniIdForIncrement) {
        await this.busService.incrementUniversityFilledSlots(busIdForIncrement, uniIdForIncrement);
        busIncremented = true;
      }

      const licenseId = license!._id.toString();

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
        metadata: {
          enrollmentPeriodId: request.enrollmentPeriodId,
          validityMonths,
        },
      });

      return updated!;
    }

    // If used session, fetch the updated request to return
    const updatedRequest = await this.repository.findById(requestId);
    // If this was an update request and we used a DB session, send notification after commit
    if (request.type === 'update') {
      try {
        const student = await this.studentService.findOneOrFail(request.studentId);
        await this.mailService
          .sendDocumentUpdateApproved(
            student.email,
            student.name,
            request.changedDocuments ?? [],
          )
          .catch(() => {});
      } catch (err) {
        this.logger.warn(
          `Falha ao enviar email de aprovacao de update para ${request.studentId}: ${(err as Error)?.message}`,
        );
      }
    }
    await this.auditLog.record({
      action: 'license_request.approve',
      outcome: 'success',
      actor: { id: employeeId, role: 'employee' },
      target: { studentId: request.studentId, requestId },
      metadata: {
        enrollmentPeriodId: request.enrollmentPeriodId,
        validityMonths,
      },
    });

    return updatedRequest!;
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

  private assertPeriodWindow(startDateRaw: Date, endDateRaw: Date): void {
    const now = new Date();
    const startDate = new Date(startDateRaw);
    const endDate = new Date(endDateRaw);

    if (now < startDate) {
      throw new BadRequestException('O período de inscrições ainda não começou.');
    }

    if (now > endDate) {
      throw new BadRequestException('O período de inscrições foi encerrado.');
    }
  }

  private parseChangedDocuments(changedDocumentsRaw: string): PhotoType[] {
    try {
      const parsed = JSON.parse(changedDocumentsRaw);
      if (!Array.isArray(parsed)) {
        throw new BadRequestException('changedDocuments deve ser um array JSON');
      }

      const allowed = new Set(Object.values(PhotoType));
      const invalid = parsed.filter((item) => !allowed.has(item));

      if (invalid.length > 0) {
        throw new BadRequestException('changedDocuments contém photoTypes inválidos');
      }

      return parsed as PhotoType[];
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('changedDocuments deve ser um JSON válido');
    }
  }

  private toDataUrl(file: UploadedImageFile): string {
    return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
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
