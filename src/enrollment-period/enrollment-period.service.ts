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
      if (this.isWindowExpired(active.dataFim)) {
        await this.finishPeriodLifecycle(
          active,
          adminId,
          'enrollment_period_window_ended',
        );
      } else {
        throw new ConflictException('Ja existe um periodo de inscricao ativo.');
      }
    }

    const dataInicio = new Date(dto.dataInicio);
    const dataFim = new Date(dto.dataFim);
    this.assertValidDateRange(dataInicio, dataFim);

    const created = await this.repository
      .create({
        dataInicio,
        dataFim,
        qtdVagasTotais: dto.qtdVagasTotais,
        qtdVagasPreenchidas: 0,
        waitlistSequence: 0,
        qtdFilaEncerrada: 0,
        filaEncerradaEm: null,
        validadeCarteirinhaMeses: dto.validadeCarteirinhaMeses,
        ativo: true,
        criadoPorAdminId: adminId,
        encerradoPorAdminId: null,
        encerradoEm: null,
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

    if (this.isWindowExpired(active.dataFim)) {
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
      dto.qtdVagasTotais !== undefined &&
      dto.qtdVagasTotais < current.qtdVagasPreenchidas
    ) {
      throw new ConflictException(
        'Nao e possivel reduzir o total de vagas abaixo das vagas preenchidas.',
      );
    }

    const dataInicio =
      dto.dataInicio !== undefined ? new Date(dto.dataInicio) : current.dataInicio;
    const dataFim = dto.dataFim !== undefined ? new Date(dto.dataFim) : current.dataFim;

    this.assertValidDateRange(dataInicio, dataFim);

    const previousValidity = current.validadeCarteirinhaMeses;
    const nextValidity =
      dto.validadeCarteirinhaMeses ?? current.validadeCarteirinhaMeses;

    const updated = await this.repository.update(id, {
      ...(dto.dataInicio !== undefined ? { dataInicio } : {}),
      ...(dto.dataFim !== undefined ? { dataFim } : {}),
      ...(dto.qtdVagasTotais !== undefined
        ? { qtdVagasTotais: dto.qtdVagasTotais }
        : {}),
      ...(dto.validadeCarteirinhaMeses !== undefined
        ? { validadeCarteirinhaMeses: dto.validadeCarteirinhaMeses }
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

    if (updated.ativo && this.isWindowExpired(updated.dataFim)) {
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

    if (this.isWindowExpired(period.dataFim)) {
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
        ativo: true,
        encerradoPorAdminId: null,
        encerradoEm: null,
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
    quantidade: number,
  ): Promise<LicenseRequest[]> {
    await this.assertPeriodExists(periodId);

    if (quantidade < 1) {
      throw new BadRequestException('A quantidade deve ser maior que zero.');
    }

    const waitlisted = await this.licenseRequestRepository.findWaitlistedByEnrollmentPeriod(
      periodId,
    );

    return [...waitlisted]
      .sort((a, b) => this.toTime(a.createdAt) - this.toTime(b.createdAt))
      .slice(0, quantidade);
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

  private assertValidDateRange(dataInicio: Date, dataFim: Date): void {
    if (Number.isNaN(dataInicio.getTime()) || Number.isNaN(dataFim.getTime())) {
      throw new BadRequestException('As datas informadas sao invalidas.');
    }

    if (dataFim <= dataInicio) {
      throw new BadRequestException(
        'dataFim deve ser maior que dataInicio para o periodo de inscricao.',
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

  private isWindowExpired(dataFimRaw: Date): boolean {
    const now = new Date();
    return now > new Date(dataFimRaw);
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

    const previousClosedCount = period.qtdFilaEncerrada ?? 0;
    const totalClosedCount = previousClosedCount + cancelledWaitlistCount;
    const filaEncerradaEm =
      totalClosedCount > 0
        ? period.filaEncerradaEm ?? new Date()
        : null;

    return this.repository.update(periodId, {
      ativo: false,
      encerradoPorAdminId: adminId,
      encerradoEm: new Date(),
      qtdFilaEncerrada: totalClosedCount,
      filaEncerradaEm,
    });
  }
}
