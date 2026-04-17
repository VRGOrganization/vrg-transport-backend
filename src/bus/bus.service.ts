import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogService } from '../common/audit/audit-log.service';
import { UniversityService } from '../university/university.service';
import { CreateBusDto, UpdateBusDto } from './dto/bus.dto';
import {
  BUS_REPOSITORY,
  type IBusRepository,
} from './interface/repository.interface';
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
      capacity: dto.capacity,
      universityIds: [],
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

    const updated = await this.repository.addUniversity(busId, universityId);
    if (!updated) {
      throw new NotFoundException('Ônibus não encontrado.');
    }

    await this.auditLog.record({
      action: 'bus.link_university',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busId, universityId },
    });

    return updated;
  }

  async unlinkUniversity(
    busId: string,
    universityId: string,
    adminId: string,
  ): Promise<Bus> {
    await this.findOneOrFail(busId);
    await this.universityService.findOneOrFail(universityId);

    const updated = await this.repository.removeUniversity(busId, universityId);
    if (!updated) {
      throw new NotFoundException('Ônibus não encontrado.');
    }

    await this.auditLog.record({
      action: 'bus.unlink_university',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { busId, universityId },
    });

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
}