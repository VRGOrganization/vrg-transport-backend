import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogService } from '../common/audit/audit-log.service';
import { CreateUniversityDto, UpdateUniversityDto } from './dto/university.dto';
import {
  UNIVERSITY_REPOSITORY,
  type IUniversityRepository,
} from './interface/repository.interface';
import { University } from './schema/university.schema';

@Injectable()
export class UniversityService {
  constructor(
    @Inject(UNIVERSITY_REPOSITORY)
    private readonly repository: IUniversityRepository<University>,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateUniversityDto, adminId: string): Promise<University> {
    const existing = await this.repository.findByAcronym(dto.acronym);
    if (existing) {
      throw new ConflictException('Já existe uma faculdade com esta sigla.');
    }

    const created = await this.repository.create({
      name: dto.name,
      acronym: dto.acronym.toUpperCase(),
      address: dto.address,
    });

    await this.auditLog.record({
      action: 'university.create',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { universityId: (created as any)._id?.toString?.() },
    });

    return created;
  }

  async findAll(): Promise<University[]> {
    return this.repository.findAll();
  }

  async findAllInactive(): Promise<University[]> {
    return this.repository.findAllInactive();
  }

  async findOneOrFail(id: string): Promise<University> {
    const university = await this.repository.findById(id);
    if (!university) {
      throw new NotFoundException('Faculdade não encontrada.');
    }
    return university;
  }

  async update(
    id: string,
    dto: UpdateUniversityDto,
    adminId: string,
  ): Promise<University> {
    await this.findOneOrFail(id);

    if (dto.acronym) {
      const existing = await this.repository.findByAcronym(dto.acronym);
      if (existing && (existing as any)._id?.toString?.() !== id) {
        throw new ConflictException('Já existe uma faculdade com esta sigla.');
      }
    }

    const updated = await this.repository.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.acronym !== undefined ? { acronym: dto.acronym.toUpperCase() } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
    });

    if (!updated) {
      throw new NotFoundException('Faculdade não encontrada.');
    }

    await this.auditLog.record({
      action: 'university.update',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { universityId: id },
      metadata: { fields: Object.keys(dto) },
    });

    return updated;
  }

  async deactivate(id: string, adminId: string): Promise<{ message: string }> {
    await this.findOneOrFail(id);

    const result = await this.repository.deactivate(id);
    if (!result) {
      throw new NotFoundException('Faculdade não encontrada.');
    }

    await this.auditLog.record({
      action: 'university.deactivate',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { universityId: id },
    });

    return { message: 'Faculdade desativada com sucesso.' };
  }
}