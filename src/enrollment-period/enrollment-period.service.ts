import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogService } from '../common/audit/audit-log.service';
import { LicenseService } from '../license/license.service';
import { LICENSE_REQUEST_REPOSITORY } from '../license-request/interfaces/repository.interface';
import type { ILicenseRequestRepository } from '../license-request/interfaces/repository.interface';
import { type LicenseRequest } from '../license-request/schemas/license-request.schema';
import { MailService } from '../mail/mail.service';
import { StudentService } from '../student/student.service';
import { CreateEnrollmentPeriodDto, UpdateEnrollmentPeriodDto } from './dto/enrollment-period.dto';
import {
  ENROLLMENT_PERIOD_REPOSITORY,
  type IEnrollmentPeriodRepository,
} from './interfaces/repository.interface';
import { EnrollmentPeriod } from './schemas/enrollment-period.schema';

@Injectable()
export class EnrollmentPeriodService {
  private readonly logger = new Logger(EnrollmentPeriodService.name);

  constructor(
    @Inject(ENROLLMENT_PERIOD_REPOSITORY)
    private readonly repository: IEnrollmentPeriodRepository<EnrollmentPeriod>,
    @Inject(LICENSE_REQUEST_REPOSITORY)
    private readonly licenseRequestRepository: ILicenseRequestRepository<LicenseRequest>,
    private readonly studentService: StudentService,
    private readonly mailService: MailService,
    private readonly licenseService: LicenseService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(
    dto: CreateEnrollmentPeriodDto,
    adminId: string,
  ): Promise<EnrollmentPeriod> {
    await this.licenseService.deactivateExpiredLicenses();

    const active = await this.repository.findActive();
    if (active) {
      if (this.isWindowExpired(active.endDate)) {
        await this.finishPeriodLifecycle(
          active,
          adminId,
          'enrollment_period_window_ended',
        );
      } else {
        throw new ConflictException('Ja existe um periodo de inscricao ativo.');
      }
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.assertValidDateRange(startDate, endDate);

    const created = await this.repository
      .create({
        startDate,
        endDate,
        totalSlots: dto.totalSlots,
        filledSlots: 0,
        waitlistSequence: 0,
        closedWaitlistCount: 0,
        waitlistClosedAt: null,
        licenseValidityMonths: dto.licenseValidityMonths,
        active: true,
        createdByAdminId: adminId,
        closedByAdminId: null,
        closedAt: null,
      })
      .catch((error) => {
        if (this.isDuplicateKeyError(error)) {
          throw new ConflictException('Ja existe um periodo de inscricao ativo.');
        }
        throw error;
      });

    await this.auditLog.record({
      action: 'enrollment_period.create',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { enrollmentPeriodId: (created as any)._id?.toString?.() },
    });

    return created;
  }

  async findAll(): Promise<EnrollmentPeriod[]> {
    return this.repository.findAll();
  }

  async getActive(): Promise<EnrollmentPeriod | null> {
    await this.licenseService.deactivateExpiredLicenses();

    const active = await this.repository.findActive();
    if (!active) {
      return null;
    }

    if (this.isWindowExpired(active.endDate)) {
      await this.finishPeriodLifecycle(
        active,
        null,
        'enrollment_period_window_ended',
      );
      return null;
    }

    return active;
  }

  async getActiveOrFail(): Promise<EnrollmentPeriod> {
    const period = await this.getActive();
    if (!period) {
      throw new NotFoundException('Nenhum periodo de inscricao ativo no momento.');
    }

    return period;
  }

  async findById(id: string): Promise<EnrollmentPeriod | null> {
    return this.repository.findById(id);
  }

  async update(
    id: string,
    dto: UpdateEnrollmentPeriodDto,
  ): Promise<EnrollmentPeriod> {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new NotFoundException('Periodo de inscricao nao encontrado.');
    }

    if (
      dto.totalSlots !== undefined &&
      dto.totalSlots < current.filledSlots
    ) {
      throw new ConflictException(
        'Nao e possivel reduzir o total de vagas abaixo das vagas preenchidas.',
      );
    }

    const startDate =
      dto.startDate !== undefined ? new Date(dto.startDate) : current.startDate;
    const endDate = dto.endDate !== undefined ? new Date(dto.endDate) : current.endDate;

    this.assertValidDateRange(startDate, endDate);

    const previousValidity = current.licenseValidityMonths;
    const nextValidity =
      dto.licenseValidityMonths ?? current.licenseValidityMonths;

    const updated = await this.repository.update(id, {
      ...(dto.startDate !== undefined ? { startDate } : {}),
      ...(dto.endDate !== undefined ? { endDate } : {}),
      ...(dto.totalSlots !== undefined
        ? { totalSlots: dto.totalSlots }
        : {}),
      ...(dto.licenseValidityMonths !== undefined
        ? { licenseValidityMonths: dto.licenseValidityMonths }
        : {}),
    });

    if (!updated) {
      throw new NotFoundException('Periodo de inscricao nao encontrado.');
    }

    if (previousValidity !== nextValidity) {
      await this.licenseService.syncValidityMonthsForEnrollmentPeriod(
        id,
        previousValidity,
        nextValidity,
      );
      await this.licenseService.deactivateExpiredLicenses();
    }

    if (updated.active && this.isWindowExpired(updated.endDate)) {
      await this.finishPeriodLifecycle(
        updated,
        null,
        'enrollment_period_window_ended',
      );
      const closed = await this.repository.findById(id);
      if (!closed) {
        throw new NotFoundException('Periodo de inscricao nao encontrado.');
      }
      return closed;
    }

    return updated;
  }

  async close(id: string, adminId: string): Promise<EnrollmentPeriod> {
    const period = await this.repository.findById(id);
    if (!period) {
      throw new NotFoundException('Periodo de inscricao nao encontrado.');
    }

    const updated = await this.finishPeriodLifecycle(
      period,
      adminId,
      'enrollment_period_closed_by_admin',
    );

    if (!updated) {
      throw new NotFoundException('Periodo de inscricao nao encontrado.');
    }

    return updated;
  }

  async reopen(id: string): Promise<EnrollmentPeriod> {
    const period = await this.repository.findById(id);
    if (!period) {
      throw new NotFoundException('Periodo de inscricao nao encontrado.');
    }

    if (this.isWindowExpired(period.endDate)) {
      throw new BadRequestException(
        'Nao e possivel reabrir um periodo com janela encerrada. Crie um novo periodo.',
      );
    }

    const active = await this.repository.findActive();
    if (active && (active as any)._id?.toString?.() !== id) {
      throw new ConflictException('Ja existe um periodo de inscricao ativo.');
    }

    const updated = await this.repository
      .update(id, {
        active: true,
        closedByAdminId: null,
        closedAt: null,
      })
      .catch((error) => {
        if (this.isDuplicateKeyError(error)) {
          throw new ConflictException('Ja existe um periodo de inscricao ativo.');
        }
        throw error;
      });

    if (!updated) {
      throw new NotFoundException('Periodo de inscricao nao encontrado.');
    }

    return updated;
  }

  async incrementFilled(periodId: string): Promise<void> {
    const updated = await this.repository.incrementFilledIfAvailable(periodId);
    if (!updated) {
      throw new ConflictException('Nao ha vagas disponiveis para aprovacao neste periodo.');
    }
  }

  async decrementFilled(periodId: string): Promise<void> {
    await this.repository.decrementFilled(periodId);
  }

  async reserveWaitlistPosition(periodId: string): Promise<number> {
    const updated = await this.repository.incrementWaitlistSequence(periodId);
    if (!updated) {
      throw new NotFoundException('Periodo de inscricao nao encontrado.');
    }

    return updated.waitlistSequence;
  }

  async previewReleaseSlots(
    periodId: string,
    quantity: number,
  ): Promise<LicenseRequest[]> {
    await this.assertPeriodExists(periodId);

    if (quantity < 1) {
      throw new BadRequestException('A quantidade deve ser maior que zero.');
    }

    const waitlisted = await this.licenseRequestRepository.findWaitlistedByEnrollmentPeriod(
      periodId,
    );

    return [...waitlisted]
      .sort((a, b) => this.toTime(a.createdAt) - this.toTime(b.createdAt))
      .slice(0, quantity);
  }

  async confirmReleaseSlots(
    periodId: string,
    requestIds: string[],
  ): Promise<void> {
    await this.assertPeriodExists(periodId);

    if (!requestIds.length) {
      throw new BadRequestException('Nenhuma solicitacao foi informada.');
    }

    const uniqueRequestIds = [...new Set(requestIds)];
    if (uniqueRequestIds.length !== requestIds.length) {
      throw new BadRequestException(
        'A lista de solicitacoes contem IDs duplicados.',
      );
    }

    const promoted: LicenseRequest[] = [];
    const skipped: string[] = [];

    for (const requestId of uniqueRequestIds) {
      const promotedRequest =
        await this.licenseRequestRepository.promoteWaitlistedForPeriod(
          requestId,
          periodId,
        );

      if (!promotedRequest) {
        skipped.push(requestId);
        continue;
      }

      promoted.push(promotedRequest);
    }

    if (promoted.length === 0) {
      throw new ConflictException(
        'Nenhuma solicitacao foi promovida. Elas podem ja ter sido processadas por outra operacao.',
      );
    }

    for (const request of promoted) {
      try {
        const student = await this.studentService.findOneOrFail(request.studentId);
        await this.mailService.sendWaitlistPromotion(student.email, student.name);
      } catch (error) {
        this.logger.warn(
          `Falha ao enviar email de promocao de fila para ${request.studentId}: ${(error as Error)?.message}`,
        );
      }

      this.licenseService.emitLicenseEvent(request.studentId, {
        type: 'license.changed',
        reason: 'waitlist_promoted',
      });
    }

    const remainingWaitlisted = await this.licenseRequestRepository.findWaitlistedByEnrollmentPeriod(
      periodId,
    );

    const sortedRemaining = [...remainingWaitlisted].sort(
      (a, b) => this.toTime(a.createdAt) - this.toTime(b.createdAt),
    );

    for (let index = 0; index < sortedRemaining.length; index += 1) {
      const request = sortedRemaining[index];
      await this.licenseRequestRepository.update(this.toId(request), {
        filaPosition: index + 1,
      });
    }

    await this.auditLog.record({
      action: 'enrollment_period.release_slots',
      outcome: 'success',
      target: { enrollmentPeriodId: periodId },
      metadata: {
        requestedRequestIds: uniqueRequestIds,
        releasedRequestIds: promoted.map((request) => this.toId(request)),
        skippedRequestIds: skipped,
        remaining: sortedRemaining.length,
      },
    });
  }

  private async assertPeriodExists(periodId: string): Promise<void> {
    const period = await this.repository.findById(periodId);
    if (!period) {
      throw new NotFoundException('Periodo de inscricao nao encontrado.');
    }
  }

  private assertValidDateRange(startDate: Date, endDate: Date): void {
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('As datas informadas sao invalidas.');
    }

    if (endDate <= startDate) {
      throw new BadRequestException(
        'endDate deve ser maior que startDate para o periodo de inscricao.',
      );
    }
  }

  private toId(request: LicenseRequest): string {
    return (request as any)._id?.toString?.() ?? (request as any).id;
  }

  private toTime(value: Date | string | undefined): number {
    if (!value) return 0;
    return new Date(value).getTime();
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }

  private isWindowExpired(endDateRaw: Date): boolean {
    const now = new Date();
    return now > new Date(endDateRaw);
  }

  private async finishPeriodLifecycle(
    period: EnrollmentPeriod,
    adminId: string | null,
    cancellationReason: string,
  ): Promise<EnrollmentPeriod | null> {
    const periodId = (period as any)._id?.toString?.();
    if (!periodId) {
      throw new NotFoundException('Periodo de inscricao nao encontrado.');
    }

    const cancelledWaitlistCount =
      await this.licenseRequestRepository.cancelWaitlistedByEnrollmentPeriod(
        periodId,
        cancellationReason,
      );

    const previousClosedCount = period.closedWaitlistCount ?? 0;
    const totalClosedCount = previousClosedCount + cancelledWaitlistCount;
    const waitlistClosedAt =
      totalClosedCount > 0
        ? period.waitlistClosedAt ?? new Date()
        : null;

    return this.repository.update(periodId, {
      active: false,
      closedByAdminId: adminId,
      closedAt: new Date(),
      closedWaitlistCount: totalClosedCount,
      waitlistClosedAt,
    });
  }
}
