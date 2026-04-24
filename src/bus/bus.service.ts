import {
  ConflictException,
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
import { Inject, forwardRef } from '@nestjs/common';
import { LicenseService } from '../license/license.service';
import { Shift } from '../common/interfaces/student-attributes.enum';

@Injectable()
export class BusService {
  constructor(
    @Inject(BUS_REPOSITORY)
    private readonly repository: IBusRepository<Bus>,
    private readonly universityService: UniversityService,
    private readonly auditLog: AuditLogService,
    @Inject(LICENSE_REQUEST_REPOSITORY)
    private readonly licenseRequestRepository: ILicenseRequestRepository<LicenseRequest>,
    @Inject(forwardRef(() => StudentService))
    private readonly studentService: StudentService,
    private readonly mailService: MailService,
    @Inject(forwardRef(() => EnrollmentPeriodService))
    private readonly enrollmentPeriodService: EnrollmentPeriodService,
    @Inject(forwardRef(() => LicenseService))
    private readonly licenseService: LicenseService,
  ) {}

  async resetAllFilledSlots(adminId?: string): Promise<void> {
    await this.repository.resetAllFilledSlots();

    await this.auditLog.record({
      action: 'bus.reset_all_filled_slots',
      outcome: 'success',
      actor: adminId ? { id: adminId, role: 'admin' } : null,
    }).catch(() => {});
  }

  async resyncFilledSlots(busId: string, adminId?: string): Promise<Bus> {
    const bus = await this.repository.findById(busId);
    if (!bus) throw new NotFoundException('Ônibus não encontrado.');

    // Conta alunos atualmente atribuídos a este ônibus
    const students = await this.studentService.findByBusId(busId);
    const counts: Record<string, number> = {};
    for (const s of students || []) {
      const uid = (s as any).universityId ? (typeof (s as any).universityId === 'string' ? (s as any).universityId : (s as any).universityId.toString?.()) : '';
      if (!uid) continue;
      counts[uid] = (counts[uid] || 0) + 1;
    }

    // Reconstrói os slots preservando ordem/prioridade e ajustando filledSlots
    const newSlots = (bus.universitySlots || []).map((slot: any) => {
      const uid = slot.universityId ? (typeof slot.universityId === 'string' ? slot.universityId : slot.universityId.toString?.()) : '';
      return {
        universityId: slot.universityId,
        priorityOrder: slot.priorityOrder,
        filledSlots: counts[uid] || 0,
      };
    });

    const updated = await this.repository.update(busId, { universitySlots: newSlots });
    if (!updated) throw new NotFoundException('Ônibus não encontrado.');

    await this.auditLog.record({
      action: 'bus.resync_filled_slots',
      outcome: 'success',
      actor: adminId ? { id: adminId, role: 'admin' } : null,
      target: { busId },
      metadata: { totalStudents: students.length },
    }).catch(() => {});

    return updated;
  }

  async create(dto: CreateBusDto, adminId: string): Promise<Bus> {
    const existing = await this.repository.findByIdentifier(dto.identifier);
    if (existing) {
      throw new ConflictException('Já existe um ônibus com este identificador.');
    }

    const created = await this.repository.create({
      identifier: dto.identifier,
      ...(dto.shift !== undefined ? { shift: dto.shift } : {}),
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

  async getQueueCounts(): Promise<any[]> {
    const buses = await this.repository.findAllActive();

    const activePeriod = await this.enrollmentPeriodService.getActive();
    // If no active enrollment period, return counts with zeros
    if (!activePeriod) {
      return (buses || []).map((bus: any) => {
        const filledSlotsTotal = (bus.universitySlots || []).reduce((acc: number, s: any) => acc + (s.filledSlots || 0), 0);
        return {
          _id: (bus as any)._id?.toString?.(),
          identifier: (bus as any).identifier,
          shift: (bus as any).shift ?? null,
          capacity: (bus as any).capacity ?? null,
          filledSlotsTotal,
          availableSlots: (bus as any).capacity == null ? null : Math.max((bus as any).capacity - filledSlotsTotal, 0),
          pendingCount: 0,
          waitlistedCount: 0,
          universitySlots: (bus.universitySlots || []).map((s: any) => ({
            universityId: s.universityId?.toString?.(),
            priorityOrder: s.priorityOrder,
            filledSlots: s.filledSlots || 0,
            pendingCount: 0,
            waitlistedCount: 0,
          })),
        } as any;
      });
    }

    const periodId = (activePeriod as any)._id?.toString?.();
    if (!periodId) return [];

    const grouped = await this.licenseRequestRepository.findByEnrollmentPeriodAndBusGrouped(periodId);

    const pendingByBus: Record<string, number> = {};
    const waitlistedByBus: Record<string, number> = {};
    const perUni: Record<string, Record<string, { pending: number; waitlisted: number }>> = {};

    for (const item of grouped || []) {
      const bid = item._id ? (typeof item._id === 'string' ? item._id : item._id.toString?.()) : null;
      if (!bid) continue;
      pendingByBus[bid] = item.pending || 0;
      waitlistedByBus[bid] = item.waitlisted || 0;
      perUni[bid] = perUni[bid] || {};
      for (const pu of item.perUniversity || []) {
        const uid = pu.universityId ? (typeof pu.universityId === 'string' ? pu.universityId : pu.universityId.toString?.()) : '';
        perUni[bid][uid] = { pending: pu.pending || 0, waitlisted: pu.waitlisted || 0 };
      }
    }

    return (buses || []).map((bus: any) => {
      const id = (bus as any)._id?.toString?.();
      const identifier = (bus as any).identifier;
      const filledSlotsTotal = (bus.universitySlots || []).reduce((acc: number, s: any) => acc + (s.filledSlots || 0), 0);
      const slots = (bus.universitySlots || []).map((s: any) => {
        const uniId = s.universityId?.toString?.();
        const counts = perUni[identifier] && perUni[identifier][uniId] ? perUni[identifier][uniId] : { pending: 0, waitlisted: 0 };
        return {
          universityId: uniId,
          priorityOrder: s.priorityOrder,
          filledSlots: s.filledSlots || 0,
          pendingCount: counts.pending,
          waitlistedCount: counts.waitlisted,
        };
      });

      return {
        _id: id,
        identifier,
        shift: (bus as any).shift ?? null,
        capacity: (bus as any).capacity ?? null,
        filledSlotsTotal,
        availableSlots: (bus as any).capacity == null ? null : Math.max((bus as any).capacity - filledSlotsTotal, 0),
        pendingCount: pendingByBus[identifier] || 0,
        waitlistedCount: waitlistedByBus[identifier] || 0,
        universitySlots: slots,
      } as any;
    });
  }

  async getQueueSummary(busId: string): Promise<any> {
    const bus = await this.findOneOrFail(busId);
    const busIdentifier = (bus as any).identifier;

    const activePeriod = await this.enrollmentPeriodService.getActive();
    if (!activePeriod) {
      return {
        _id: (bus as any)._id?.toString?.(),
        identifier: (bus as any).identifier,
        shift: (bus as any).shift ?? null,
        capacity: (bus as any).capacity ?? null,
        filledSlotsTotal: (bus.universitySlots || []).reduce((acc: number, s: any) => acc + (s.filledSlots || 0), 0),
        availableSlots: (bus as any).capacity == null ? null : Math.max((bus as any).capacity - ((bus.universitySlots || []).reduce((acc: number, s: any) => acc + (s.filledSlots || 0), 0)), 0),
        pendingRequests: [],
        waitlistedRequests: [],
      };
    }

    const periodId = (activePeriod as any)._id?.toString?.();
    const filtered = await this.licenseRequestRepository.findByEnrollmentPeriodAndBus(periodId, busIdentifier);

    const pendingRequests = filtered.filter((r: any) => r.status === 'pending')
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const waitlistedRequests = filtered.filter((r: any) => r.status === 'waitlisted')
      .sort((a: any, b: any) => {
        const pa = a.filaPosition ?? 0;
        const pb = b.filaPosition ?? 0;
        if (pa && pb) return pa - pb;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    return {
      _id: (bus as any)._id?.toString?.(),
      identifier: (bus as any).identifier,
      shift: (bus as any).shift ?? null,
      capacity: (bus as any).capacity ?? null,
      filledSlotsTotal: (bus.universitySlots || []).reduce((acc: number, s: any) => acc + (s.filledSlots || 0), 0),
      availableSlots: (bus as any).capacity == null ? null : Math.max((bus as any).capacity - ((bus.universitySlots || []).reduce((acc: number, s: any) => acc + (s.filledSlots || 0), 0)), 0),
      pendingRequests,
      waitlistedRequests,
    } as any;
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

  async findByIdentifier(identifier: string): Promise<Bus | null> {
    return this.repository.findByIdentifier(identifier);
  }

  async findAllByUniversityId(universityId: string): Promise<Bus[]> {
    return this.repository.findByUniversityId(universityId);
  }

  private pickBestBusForUniversity(candidates: Bus[], universityId: string): Bus | null {
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

  // Retorna o ?nibus ativo que cont?m essa universidade em universitySlots.
  // Quando h? m?ltiplos ?nibus, retorna o que tem menor priorityOrder para a universidade.
  async findByUniversityId(universityId: string): Promise<Bus | null> {
    const candidates = await this.findAllByUniversityId(universityId);
    if (!candidates || candidates.length === 0) return null;

    return this.pickBestBusForUniversity(candidates, universityId);
  }

  async findByUniversityIdAndShift(
    universityId: string,
    shift?: Shift | null,
  ): Promise<Bus | null> {
    const candidates = await this.findAllByUniversityId(universityId);
    if (!candidates || candidates.length === 0) {
      return null;
    }

    if (!shift) {
      return this.pickBestBusForUniversity(candidates, universityId);
    }

    const shiftedCandidates = candidates.filter((bus: any) => bus.shift === shift);
    if (shiftedCandidates.length > 0) {
      return this.pickBestBusForUniversity(shiftedCandidates, universityId);
    }

    return this.pickBestBusForUniversity(candidates, universityId);
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
      ...(dto.shift !== undefined ? { shift: dto.shift } : {}),
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
  async releaseSlotsForBus(busId: string, adminId: string, promote = true, quantity?: number): Promise<{ releasedSlots: number }> {
    await this.findOneOrFail(busId);

    // Reset or decrement filled slots according to 'quantity'. If quantity is
    // provided, only decrement that many slots (distributed among slots by priority);
    // otherwise zero all filledSlots. The repository returns the actual number
    // of released slots.
    const released = await this.repository.resetUniversityFilledSlots(busId, quantity);

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
    const busIdentifier = (await this.findOneOrFail(busId) as any).identifier;

    // Fetch current waitlisted requests for the period scoped to this bus
    const waitlistedForBus = await this.licenseRequestRepository.findWaitlistedByEnrollmentPeriodAndBus(
      periodId,
      busIdentifier,
    );

    // Load bus to read universitySlots priority
    const bus = await this.findOneOrFail(busId);
    const slots = (bus as any).universitySlots || [];
    const sortedUniIds = [...slots]
      .sort((a: any, b: any) => (a.priorityOrder || 0) - (b.priorityOrder || 0))
      .map((s: any) => s.universityId?.toString?.())
      .filter(Boolean) as string[];

    // Get aggregated counts (pending + waitlisted) per university for this period and bus
    const grouped = await this.licenseRequestRepository.findByEnrollmentPeriodAndBusGrouped(periodId);
    const groupForBus = (grouped || []).find((g: any) => {
      const bid = g && g._id;
      if (!bid) return false;
      return (typeof bid === 'string' ? bid : bid.toString?.()) === busIdentifier;
    });

    const perUniCounts: Record<string, { pending: number; waitlisted: number }> = {};
    if (groupForBus && Array.isArray(groupForBus.perUniversity)) {
      for (const pu of groupForBus.perUniversity) {
        const uid = pu.universityId ? (typeof pu.universityId === 'string' ? pu.universityId : pu.universityId.toString?.()) : null;
        if (!uid) continue;
        perUniCounts[uid] = { pending: pu.pending || 0, waitlisted: pu.waitlisted || 0 };
      }
    }

    const promotedIds: string[] = [];
    let remainingToPromote = released;

    // Find first priority that has any active demand (pending OR waitlisted)
    let startIndex = 0;
    for (let i = 0; i < sortedUniIds.length; i++) {
      const uid = sortedUniIds[i];
      const counts = perUniCounts[uid] || { pending: 0, waitlisted: 0 };
      if ((counts.pending || 0) + (counts.waitlisted || 0) > 0) { startIndex = i; break; }
    }

    // Iterate priorities from the first active one, enforcing the dynamic-priority rule:
    // promote as many waitlisted candidates from the current university as possible,
    // but NEVER advance to a lower-priority university while the current one still
    // has active demand (pending OR remaining waitlisted).
    for (let idx = startIndex; idx < sortedUniIds.length; idx++) {
      if (remainingToPromote <= 0) break;
      const uniId = sortedUniIds[idx];
      const counts = perUniCounts[uniId] || { pending: 0, waitlisted: 0 };

      // If this university has no active demand at all, skip it.
      if ((counts.pending || 0) + (counts.waitlisted || 0) === 0) continue;

      // Collect ordered waitlisted candidates for this bus/university
        const candidates = (waitlistedForBus || [])
        .filter((r: any) => {
          const rUni = r.universityId ? (typeof r.universityId === 'string' ? r.universityId : (r.universityId as any).toString?.()) : null;
          if (rUni !== uniId) return false;
          const eligible = Array.isArray(r.accessBusIdentifiers) ? r.accessBusIdentifiers : [];
          return eligible.includes(busIdentifier);
        })
        .sort((a: any, b: any) => {
          const pa = a.filaPosition ?? 0;
          const pb = b.filaPosition ?? 0;
          if (pa && pb) return pa - pb;
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

      // If there are no waitlisted candidates but there is pending demand,
      // we must block lower priorities (the current university is active).
      if (candidates.length === 0) {
        if ((counts.pending || 0) > 0) {
          break;
        }
        // no waitlist and no pending -> nothing to do for this uni
        continue;
      }

      // Promote up to remainingToPromote candidates from this university
      for (let i = 0; i < candidates.length && remainingToPromote > 0; i++) {
        promotedIds.push((candidates[i] as any)._id?.toString?.());
        remainingToPromote -= 1;
      }

      // After attempting to promote all candidates from this university,
      // if any candidates remain unpromoted here, DO NOT pass to next priority.
      const notPromoted = candidates.filter((c: any) => !promotedIds.includes((c as any)._id?.toString?.()));
      if (notPromoted.length > 0) {
        break;
      }

      // If we promoted all waitlisted but there are still pending requests,
      // block lower priorities until pending also clears.
      if ((counts.pending || 0) > 0) {
        break;
      }

      // otherwise, this university has no more active demand; continue to next
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

    // Recompute filaPosition for remaining waitlisted for THIS BUS only
    const remainingWaitlistedForBus = await this.licenseRequestRepository.findWaitlistedByEnrollmentPeriodAndBus(
      periodId,
      busIdentifier,
    );

    const sortedRemainingBus = [...remainingWaitlistedForBus].sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    await this.licenseRequestRepository.reorderWaitlistedPositions(
      sortedRemainingBus.map((request: any) => request._id?.toString?.()).filter(Boolean),
    );

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
