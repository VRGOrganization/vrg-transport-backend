import {
  BadRequestException,
  ConflictException,
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

@Injectable()
export class LicenseRequestService {
  constructor(
    @Inject(LICENSE_REQUEST_REPOSITORY)
    private readonly repository: ILicenseRequestRepository<LicenseRequest>,
    private readonly studentService: StudentService,
    private readonly licenseService: LicenseService,
    private readonly mailService: MailService,
    private readonly auditLog: AuditLogService,
  ) {}

  async createRequest(studentId: string): Promise<LicenseRequest> {
    const existing = await this.repository.findPendingByStudentId(studentId);
    if (existing) {
      throw new ConflictException(
        'Já existe uma solicitação pendente para este aluno',
      );
    }

    const request = await this.repository.create({
      studentId,
      status: LicenseRequestStatus.PENDING,
      rejectionReason: null,
      rejectedAt: null,
      approvedByEmployeeId: null,
      rejectedByEmployeeId: null,
      licenseId: null,
    });

    await this.auditLog.record({
      action: 'license_request.create',
      outcome: 'success',
      target: { studentId },
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

    const license = await this.licenseService.create(
      {
        id: request.studentId,
        institution: dto.institution,
        bus: dto.bus,
        photo: dto.photo,
      },
      employeeId,
    );

    const licenseId = (license as any)._id.toString();

    const updated = await this.repository.update(requestId, {
      status: LicenseRequestStatus.APPROVED,
      approvedByEmployeeId: employeeId,
      licenseId,
    });

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

    await this.mailService
      .sendLicenseRejection(student.email, student.name, reason)
      .catch(() => {});

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
}
