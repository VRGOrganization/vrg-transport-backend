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

@Injectable()
export class BusService {
  constructor(
    @Inject(BUS_REPOSITORY)
    private readonly repository: IBusRepository<Bus>,
    private readonly universityService: UniversityService,
    private readonly auditLog: AuditLogService,
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
}