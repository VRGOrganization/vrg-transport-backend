import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditLogService } from '../common/audit/audit-log.service';
import { UniversityService } from '../university/university.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from './interface/repository.interface';
import { Course } from './schema/course.schema';

@Injectable()
export class CourseService {
  constructor(
    @Inject(COURSE_REPOSITORY)
    private readonly repository: ICourseRepository<Course>,
    private readonly universityService: UniversityService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateCourseDto, adminId: string): Promise<Course> {
    await this.universityService.findOneOrFail(dto.universityId);

    const existing = await this.repository.findByNameAndUniversity(
      dto.name,
      dto.universityId,
    );
    if (existing) {
      throw new ConflictException(
        'Já existe um curso com este nome nesta faculdade.',
      );
    }

    const created = await this.repository.create({
      name: dto.name,
      universityId: dto.universityId as any,
    });

    await this.auditLog.record({
      action: 'course.create',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: {
        courseId: (created as any)._id?.toString?.(),
        universityId: dto.universityId,
      },
    });

    return created;
  }

  async findAll(): Promise<Course[]> {
    return this.repository.findAll();
  }

  async findAllInactive(): Promise<Course[]> {
    return this.repository.findAllInactive();
  }

  async findByUniversity(universityId: string): Promise<Course[]> {
    await this.universityService.findOneOrFail(universityId);
    return this.repository.findByUniversity(universityId);
  }

  async findOneOrFail(id: string): Promise<Course> {
    const course = await this.repository.findById(id);
    if (!course) {
      throw new NotFoundException('Curso não encontrado.');
    }
    return course;
  }

  async update(
    id: string,
    dto: UpdateCourseDto,
    adminId: string,
  ): Promise<Course> {
    const current = await this.findOneOrFail(id);

    if (dto.name) {
      const universityId = (current as any).universityId?._id?.toString?.()
        ?? (current as any).universityId?.toString?.();

      const existing = await this.repository.findByNameAndUniversity(
        dto.name,
        universityId,
      );
      if (existing && (existing as any)._id?.toString?.() !== id) {
        throw new ConflictException(
          'Já existe um curso com este nome nesta faculdade.',
        );
      }
    }

    const updated = await this.repository.update(id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
    });

    if (!updated) {
      throw new NotFoundException('Curso não encontrado.');
    }

    await this.auditLog.record({
      action: 'course.update',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { courseId: id },
      metadata: { fields: Object.keys(dto) },
    });

    return updated;
  }

  async deactivate(id: string, adminId: string): Promise<{ message: string }> {
    await this.findOneOrFail(id);

    const result = await this.repository.deactivate(id);
    if (!result) {
      throw new NotFoundException('Curso não encontrado.');
    }

    await this.auditLog.record({
      action: 'course.deactivate',
      outcome: 'success',
      actor: { id: adminId, role: 'admin' },
      target: { courseId: id },
    });

    return { message: 'Curso desativado com sucesso.' };
  }
}