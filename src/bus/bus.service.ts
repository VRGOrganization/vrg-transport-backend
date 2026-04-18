import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogService } from '../common/audit/audit-log.service';
import { UniversityService } from '../university/university.service';
import { CreateBusDto, UpdateBusDto, UpdateUniversitySlotsDto } from './dto/bus.dto';
import {
  BUS_REPOSITORY,
  type IBusRepository,
} from './interface/repository.interface';
import { Types } from 'mongoose';
import { Bus } from './schema/bus.schema';
import { LICENSE_REQUEST_REPOSITORY } from '../license-request/interfaces/repository.interface';
import type { ILicenseRequestRepository } from '../license-request/interfaces/repository.interface';
import { LicenseRequest } from '../license-request/schemas/license-request.schema';
import { StudentService } from '../student/student.service';
import { MailService } from '../mail/mail.service';
import { EnrollmentPeriodService } from '../enrollment-period/enrollment-period.service';
import { LicenseService } from '../license/license.service';

@Injectable()
export class BusService {
  constructor(
    @Inject(BUS_REPOSITORY)
    private readonly repository: IBusRepository<Bus>,
    private readonly universityService: UniversityService,
    private readonly auditLog: AuditLogService,
    @Inject(LICENSE_REQUEST_REPOSITORY)
    private readonly licenseRequestRepository: ILicenseRequestRepository<LicenseRequest>,
    private readonly studentService: StudentService,
    private readonly mailService: MailService,
    private readonly enrollmentPeriodService: EnrollmentPeriodService,
    private readonly licenseService: LicenseService,
  ) {}

  async create(dto: CreateBusDto, adminId: string): Promise<Bus> {
    const existing = await this.repository.findByIdentifier(dto.identifier);
    if (existing) {
      throw new ConflictException('Já existe um ônibus com este identificador.');
    }

    const created = await this.repository.create({
      identifier: dto.identifier,
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
      universitySlots: [],
    });

    await this.auditLog.record({
      action: 'bus.create',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busId: (created as any)._id?.toString?.() },
    });

    return created;
  }

  async findAll(): Promise<Bus[]> {
    return this.repository.findAll();
  }

  async findAllActive(): Promise<Bus[]> {
    return this.repository.findAllActive();
  }

  async findAllInactive(): Promise<Bus[]> {
    return this.repository.findAllInactive();
  }

  async findOneOrFail(id: string): Promise<Bus> {
    const bus = await this.repository.findById(id);
    if (!bus) {
      throw new NotFoundException('Ônibus não encontrado.');
    }
    return bus;
  }

  // Retorna o ônibus ativo que contém essa universidade em universitySlots.
  // Quando há múltiplos ônibus, retorna o que tem menor priorityOrder para a universidade.
  async findByUniversityId(universityId: string): Promise<Bus | null> {
    const candidates = await this.repository.findByUniversityId(universityId);
    if (!candidates || candidates.length === 0) return null;

    let bestBus: Bus | null = null;
    let bestPriority = Infinity;
    for (const bus of candidates) {
      const slot = (bus as any).universitySlots?.find((s: any) => s.universityId?.toString() === universityId);
      if (slot && slot.priorityOrder < bestPriority) {
        bestPriority = slot.priorityOrder;
        bestBus = bus;
      }
    }
    return bestBus;
  }

  async update(id: string, dto: UpdateBusDto, adminId: string): Promise<Bus> {
    await this.findOneOrFail(id);

    if (dto.identifier) {
      const existing = await this.repository.findByIdentifier(dto.identifier);
      if (existing && (existing as any)._id?.toString?.() !== id) {
        throw new ConflictException('Já existe um ônibus com este identificador.');
      }
    }

    const updated = await this.repository.update(id, {
      ...(dto.identifier !== undefined ? { identifier: dto.identifier } : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
    });

    if (!updated) {
      throw new NotFoundException('Ônibus não encontrado.');
    }

    await this.auditLog.record({
      action: 'bus.update',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busId: id },
      metadata: { fields: Object.keys(dto) },
    });

    return updated;
  }

  async linkUniversity(
    busId: string,
    universityId: string,
    adminId: string,
  ): Promise<Bus> {
    await this.findOneOrFail(busId);
    await this.universityService.findOneOrFail(universityId);

    // Adiciona a universidade ao final da lista de universitySlots com priorityOrder = max+1
    const bus = await this.findOneOrFail(busId);
    const exists = bus.universitySlots.find((s: any) => s.universityId?.toString() === universityId);
    if (exists) return bus;

    const maxOrder = bus.universitySlots.reduce((acc, s) => Math.max(acc, s.priorityOrder || 0), 0);
    const newSlot = {
      universityId: new Types.ObjectId(universityId),
      priorityOrder: maxOrder + 1,
      filledSlots: 0,
    } as any;

    const updated = await this.repository.update(busId, {
      universitySlots: [...(bus.universitySlots || []), newSlot],
    });

    await this.auditLog.record({
      action: 'bus.link_university',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busId, universityId },
    });

    if (!updated) throw new NotFoundException('Ônibus não encontrado.');
    return updated;
  }

  async unlinkUniversity(
    busId: string,
    universityId: string,
    adminId: string,
  ): Promise<Bus> {
    await this.findOneOrFail(busId);
    await this.universityService.findOneOrFail(universityId);

    // Remove o slot e reordena priorityOrder
    const bus = await this.findOneOrFail(busId);
    const newSlots = (bus.universitySlots || []).filter((s: any) => s.universityId?.toString() !== universityId)
      .map((s: any, index: number) => ({
        universityId: s.universityId,
        priorityOrder: index + 1,
        filledSlots: s.filledSlots ?? 0,
      }));

    const updated = await this.repository.update(busId, { universitySlots: newSlots });

    await this.auditLog.record({
      action: 'bus.unlink_university',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busId, universityId },
    });

    if (!updated) throw new NotFoundException('Ônibus não encontrado.');
    return updated;
  }

  // Atualiza atomicamente a lista de universitySlots, preservando filledSlots das universidades mantidas
  async updateUniversitySlots(busId: string, dto: UpdateUniversitySlotsDto, adminId: string): Promise<Bus> {
    const bus = await this.findOneOrFail(busId);

    // Validações básicas: priorityOrder único e universityId único
    const orders = dto.slots.map(s => s.priorityOrder);
    const uniIds = dto.slots.map(s => s.universityId);
    const duplicateOrder = orders.some((v, i) => orders.indexOf(v) !== i);
    if (duplicateOrder) throw new ConflictException('priorityOrder duplicado na lista.');
    const duplicateUni = uniIds.some((v, i) => uniIds.indexOf(v) !== i);
    if (duplicateUni) throw new ConflictException('universityId repetido na lista.');

    // Verifica existência de cada universidade
    for (const slot of dto.slots) {
      await this.universityService.findOneOrFail(slot.universityId);
      if (slot.priorityOrder < 1) throw new ConflictException('priorityOrder deve ser >= 1');
    }

    // Monta novos slots preservando filledSlots quando aplicável
    const newSlots = dto.slots.map(s => {
      const existing = (bus.universitySlots || []).find((es: any) => es.universityId?.toString() === s.universityId);
      return {
        universityId: new Types.ObjectId(s.universityId),
        priorityOrder: s.priorityOrder,
        filledSlots: existing ? existing.filledSlots : 0,
      } as any;
    });

    const updated = await this.repository.update(busId, { universitySlots: newSlots });

    await this.auditLog.record({
      action: 'bus.update_university_slots',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busId },
      metadata: { slotsCount: newSlots.length },
    });

    if (!updated) throw new NotFoundException('Ônibus não encontrado.');
    return updated;
  }

  async deactivate(id: string, adminId: string): Promise<{ message: string }> {
    await this.findOneOrFail(id);

    const result = await this.repository.deactivate(id);
    if (!result) {
      throw new NotFoundException('Ônibus não encontrado.');
    }

    await this.auditLog.record({
      action: 'bus.deactivate',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busId: id },
    });

    return { message: 'Ônibus desativado com sucesso.' };
  }

  // Expose repository helpers for incrementing/decrementing filledSlots
  async incrementUniversityFilledSlots(busId: string, universityId: string, session?: import('mongoose').ClientSession): Promise<void> {
    return this.repository.incrementUniversityFilledSlots(busId, universityId, session as any);
  }

  async decrementUniversityFilledSlots(busId: string, universityId: string, session?: import('mongoose').ClientSession): Promise<void> {
    return this.repository.decrementUniversityFilledSlots(busId, universityId, session as any);
  }

  /**
   * Libera (zera) as vagas preenchidas associadas a este ônibus.
   * Retorna o total de vagas liberadas.
   */
  async releaseSlotsForBus(busId: string, adminId: string, promote = true): Promise<{ releasedSlots: number }> {
    await this.findOneOrFail(busId);

    const released = await this.repository.resetUniversityFilledSlots(busId);

    await this.auditLog.record({
      action: 'bus.release_slots',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busId },
      metadata: { releasedSlots: released },
    });

    // If no slots were released, nothing to promote
    if (!released || released <= 0) {
      return { releasedSlots: released };
    }

    // If caller disabled promotion, return early
    if (!promote) {
      return { releasedSlots: released };
    }

    // Try to promote waitlisted requests for the active enrollment period
    const activePeriod = await this.enrollmentPeriodService.getActive();
    if (!activePeriod) {
      return { releasedSlots: released };
    }

    const periodId = (activePeriod as any)._id?.toString?.();
    if (!periodId) return { releasedSlots: released };

    // Fetch current waitlisted requests for the period
    const waitlisted = await this.licenseRequestRepository.findWaitlistedByEnrollmentPeriod(
      periodId,
    );

    // Load bus to read universitySlots priority
    const bus = await this.findOneOrFail(busId);
    const slots = (bus as any).universitySlots || [];
    const sortedUniIds = [...slots]
      .sort((a: any, b: any) => (a.priorityOrder || 0) - (b.priorityOrder || 0))
      .map((s: any) => s.universityId?.toString?.());

    const promotedIds: string[] = [];

    // For each university in priority, pick waitlisted requests for this bus/university
    for (const uniId of sortedUniIds) {
      if (promotedIds.length >= released) break;
      const candidates = (waitlisted || [])
        .filter((r: any) => {
          const rUni = r.universityId ? (typeof r.universityId === 'string' ? r.universityId : (r.universityId as any).toString?.()) : null;
          if (rUni !== uniId) return false;
          const rBus = r.busId ? (typeof r.busId === 'string' ? r.busId : (r.busId as any).toString?.()) : null;
          return rBus === busId;
        })
        .sort((a: any, b: any) => {
          const pa = a.filaPosition ?? 0;
          const pb = b.filaPosition ?? 0;
          if (pa && pb) return pa - pb;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

      for (const c of candidates) {
        if (promotedIds.length >= released) break;
        promotedIds.push((c as any)._id?.toString?.());
      }
    }

    if (promotedIds.length === 0) {
      return { releasedSlots: released };
    }

    const promoted: any[] = [];
    const skipped: string[] = [];

    for (const reqId of promotedIds) {
      const promotedRequest = await this.licenseRequestRepository.promoteWaitlistedForPeriod(
        reqId,
        periodId,
      );

      if (!promotedRequest) {
        skipped.push(reqId);
        continue;
      }

      promoted.push(promotedRequest);
    }

    // Notify promoted students and emit events
    for (const request of promoted) {
      try {
        const student = await this.studentService.findOneOrFail(request.studentId);
        await this.mailService.sendWaitlistPromotion(student.email, student.name).catch(() => {});
      } catch (err) {
        this.auditLog.record({
          action: 'bus.release_slots.notify_failed',
          outcome: 'failure',
          actor: { id: adminId, role: 'admin' },
          target: { busId },
          metadata: { requestId: (request as any)._id?.toString?.() },
        }).catch(() => {});
      }

      this.licenseService.emitLicenseEvent(request.studentId, {
        type: 'license.changed',
        reason: 'waitlist_promoted',
      });
    }

    // Recompute filaPosition for remaining waitlisted in the period
    const remainingWaitlisted = await this.licenseRequestRepository.findWaitlistedByEnrollmentPeriod(
      periodId,
    );

    const sortedRemaining = [...remainingWaitlisted].sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    for (let index = 0; index < sortedRemaining.length; index += 1) {
      const r = sortedRemaining[index];
      await this.licenseRequestRepository.update((r as any)._id?.toString?.(), {
        filaPosition: index + 1,
      });
    }

    await this.auditLog.record({
      action: 'bus.release_slots_promote',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busId },
      metadata: {
        releasedSlots: released,
        promotedRequestIds: promoted.map((p) => (p as any)._id?.toString?.()),
        skippedRequestIds: skipped,
      },
    });

    return { releasedSlots: released };
  }
}