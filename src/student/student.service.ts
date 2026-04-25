import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import type { ClientSession } from 'mongoose';
import { BusService } from '../bus/bus.service';
import {
  DayPeriodDto,
  SubmitLicenseRequestFormDto,
  UpdateStudentProfileDto,
  UpdateStudentDto,
} from './dto/student.dto';
import { Student, StudentStatus } from './schemas/student.schema';
import { STUDENT_REPOSITORY } from './interfaces/repository.interface';
import type { IStudentRepository } from './interfaces/repository.interface';
import { AuditLogService } from '../common/audit/audit-log.service';
import { ImagesService } from '../image/image.service';
import { PhotoType } from '../image/types/photoType.enum';
import { CreateImageDto } from '../image/dto/image.dto';
import { Shift } from '../common/interfaces/student-attributes.enum';
import { StudentDashboardStats } from './interfaces/student-stats.interface';
import { StudentStatsVisitor } from './visitor/student-stats.visitor';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
};
@Injectable()
export class StudentService {
  constructor(
    @Inject(STUDENT_REPOSITORY)
    private readonly studentRepository: IStudentRepository<Student>,
    private readonly auditLog: AuditLogService,
    private readonly imagesService: ImagesService,
    @Inject(forwardRef(() => BusService))
    private readonly busService: BusService,
  ) {}

  async create(data: Partial<Student>): Promise<Student> {
    return this.studentRepository.create(data);
  }

  async findAll(): Promise<Student[]> {
    return this.studentRepository.findAll();
  }

  async findAllInactive(): Promise<Student[]> {
    return this.studentRepository.findAllInactive();
  }

  async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<{ data: Student[]; total: number; page: number; limit: number }> {
    return this.studentRepository.findAllPaginated(page, limit);
  }

  async findById(id: string): Promise<Student | null> {
    return this.studentRepository.findById(id);
  }

  async findByEmail(email: string): Promise<Student | null> {
    return this.studentRepository.findByEmail(email);
  }

  async findByEmailWithSensitiveFields(email: string): Promise<Student | null> {
    return this.studentRepository.findByEmailWithSensitiveFields(email);
  }

  async findByCpfHash(cpfHash: string): Promise<Student | null> {
    return this.studentRepository.findByCpfHash(cpfHash);
  }

  async findOneOrFail(id: string): Promise<Student> {
    const student = await this.studentRepository.findById(id);
    if (!student) throw new NotFoundException(`Estudante ${id} não encontrado`);
    return student;
  }

  async update(
    id: string,
    dto: UpdateStudentDto | Partial<Student>,
    session?: ClientSession,
  ): Promise<Student> {
    const allowedFields = { ...dto } as Record<string, unknown>;
    // Remove campos que não devem ser atualizados diretamente
    delete allowedFields['active'];
    delete allowedFields['photo'];
    delete allowedFields['status'];
    delete allowedFields['password'];
    delete allowedFields['verificationCode'];
    delete allowedFields['verificationCodeExpiresAt'];
    delete allowedFields['verificationCodeAttempts'];
    delete allowedFields['verificationCodeLockedUntil'];
    delete allowedFields['verificationCodeLastSentAt'];

    const student = await this.studentRepository.update(
      id,
      allowedFields as Partial<Student>,
      session,
    );
    if (!student) throw new NotFoundException(`Estudante ${id} não encontrado`);

    await this.auditLog.record({
      action: 'student.update',
      outcome: 'success',
      target: { studentId: id },
      metadata: { fields: Object.keys(allowedFields) },
    });

    return student;
  }

  async updateSchedule(
    id: string,
    selections: DayPeriodDto[],
  ): Promise<Student> {
    const inferredShift = this.inferShiftFromSchedule(selections);

    const student = await this.studentRepository.update(id, {
      schedule: selections,
      ...(inferredShift ? { shift: inferredShift } : {}),
    });
    if (!student) throw new NotFoundException(`Estudante ${id} não encontrado`);

    await this.auditLog.record({
      action: 'update_student_schedule',
      outcome: 'success',
      target: { studentId: id },
      metadata: {
        selectionsCount: selections.length,
        inferredShift: inferredShift ?? null,
      },
    });

    return student;
  }

  async submitLicenseRequest(
    id: string,
    dto: SubmitLicenseRequestFormDto,
    files: {
      ProfilePhoto?: UploadedImageFile[];
      EnrollmentProof?: UploadedImageFile[];
      CourseSchedule?: UploadedImageFile[];
      GovernmentId?: UploadedImageFile[];
      ProofOfResidence?: UploadedImageFile[];
    },
    session?: ClientSession,
  ): Promise<Student> {
    const currentStudent = await this.findOneOrFail(id);
    if (!currentStudent.hasCompletedInitialEnrollment) {
      this.assertInitialEnrollmentDocuments(files);
    }

    const inferredShift = this.inferShiftFromSchedule(dto.schedule);

    const profileDto: UpdateStudentProfileDto = {
      institution: dto.institution,
      degree: dto.degree,
      shift: inferredShift ?? dto.shift,
      bloodType: dto.bloodType,
      schedule: dto.schedule,
    };

    const student = await this.update(id, profileDto, session);

    const profileFile = files.ProfilePhoto?.[0];
    const enrollmentFile = files.EnrollmentProof?.[0];
    const scheduleFile = files.CourseSchedule?.[0];
    const governmentIdFile = files.GovernmentId?.[0];
    const proofOfResidenceFile = files.ProofOfResidence?.[0];

    if (profileFile) {
      await this.createOrUpdateImage(id, PhotoType.ProfilePhoto, profileFile, session);
    }

    if (enrollmentFile) {
      await this.createOrUpdateImage(
        id,
        PhotoType.EnrollmentProof,
        enrollmentFile,
        session,
      );
    }

    if (scheduleFile) {
      await this.createOrUpdateImage(
        id,
        PhotoType.CourseSchedule,
        scheduleFile,
        session,
      );
    }

    if (governmentIdFile) {
      await this.createOrUpdateImage(
        id,
        PhotoType.GovernmentId,
        governmentIdFile,
        session,
      );
    }

    if (proofOfResidenceFile) {
      await this.createOrUpdateImage(
        id,
        PhotoType.ProofOfResidence,
        proofOfResidenceFile,
        session,
      );
    }

    await this.auditLog.record({
      action: 'student.submit_license_request',
      outcome: 'success',
      target: { studentId: id },
      metadata: {
        uploadedTypes: [
          profileFile ? PhotoType.ProfilePhoto : null,
          enrollmentFile ? PhotoType.EnrollmentProof : null,
          scheduleFile ? PhotoType.CourseSchedule : null,
          governmentIdFile ? PhotoType.GovernmentId : null,
          proofOfResidenceFile ? PhotoType.ProofOfResidence : null,
        ].filter(Boolean),
        scheduleCount: dto.schedule.length,
      },
    });

    return student;
  }

  async updateProfilePhoto(
    studentId: string,
    file: UploadedImageFile,
  ): Promise<{ message: string; photo: string | null }> {
    await this.findOneOrFail(studentId);
    await this.createOrUpdateImage(studentId, PhotoType.ProfilePhoto, file);

    await this.auditLog.record({
      action: 'student.update_profile_photo',
      outcome: 'success',
      target: { studentId },
    });

    const photo = await this.getProfilePhotoOrNull(studentId);
    return { message: 'Foto de perfil atualizada com sucesso', photo };
  }

  async removeProfilePhoto(studentId: string): Promise<{ message: string }> {
    await this.findOneOrFail(studentId);

    const profilePhoto = await this.imagesService.findProfilePhoto(studentId);
    const imageId = (
      profilePhoto as unknown as { _id: { toString(): string } }
    )._id.toString();

    await this.imagesService.remove(imageId);

    await this.auditLog.record({
      action: 'student.remove_profile_photo',
      outcome: 'success',
      target: { studentId },
    });

    return { message: 'Foto de perfil removida com sucesso' };
  }

  async getProfilePhotoOrNull(studentId: string): Promise<string | null> {
    try {
      const profilePhoto = await this.imagesService.findProfilePhoto(studentId);
      return (
        (profilePhoto as unknown as { photo3x4?: string | null }).photo3x4 ??
        null
      );
    } catch {
      return null;
    }
  }

  async createOrUpdateImage(
    studentId: string,
    photoType: PhotoType,
    file: UploadedImageFile,
    session?: ClientSession,
  ): Promise<void> {
    const dataUrl = await this.toDocumentDataUrl(file, photoType);
    const allImages = await this.imagesService.findByStudentId(studentId);
    const existing = allImages.find((image) => image.photoType === photoType);

    if (!existing) {
      const createDto: CreateImageDto = {
        studentId,
        photoType,
      };

      if (photoType === PhotoType.ProfilePhoto) {
        createDto.photo3x4 = dataUrl;
      } else {
        createDto.documentImage = dataUrl;
      }

      await this.imagesService.create(createDto, session);
      return;
    }

    const imageId = (
      existing as unknown as { _id: { toString(): string } }
    )._id.toString();

    await this.imagesService.update(imageId, {
      ...(photoType === PhotoType.ProfilePhoto
        ? { photo3x4: dataUrl }
        : { documentImage: dataUrl }),
    }, session);
  }

  private async toDocumentDataUrl(
    file: UploadedImageFile,
    photoType: PhotoType,
  ): Promise<string> {
    const mimeType = file.mimetype?.toLowerCase() ?? '';
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(file.buffer);
    const detectedMimeType = detected?.mime?.toLowerCase() ?? '';
    const allowedImageMimeTypes = ['image/jpeg', 'image/png'];

    const acceptsPdf =
      photoType === PhotoType.EnrollmentProof ||
      photoType === PhotoType.CourseSchedule;

    const isAllowedImage = allowedImageMimeTypes.includes(detectedMimeType);
    
    const isAllowedPdf = acceptsPdf && detectedMimeType === 'application/pdf';

    if (!isAllowedImage && !isAllowedPdf) {
      const message = acceptsPdf
        ? 'Arquivo inválido: envie imagem ou PDF para este documento'
        : 'Arquivo inválido: a foto 3x4 deve ser uma imagem';

      throw new BadRequestException(message);
    }

    const base64 = file.buffer.toString('base64');
    const outputMimeType = isAllowedPdf ? 'application/pdf' : (detectedMimeType || mimeType);
    return `data:${outputMimeType};base64,${base64}`;
  }

  private assertInitialEnrollmentDocuments(files: {
    GovernmentId?: UploadedImageFile[];
    ProofOfResidence?: UploadedImageFile[];
  }): void {
    if (!files.GovernmentId?.[0]) {
      throw new BadRequestException('Envie o documento de identidade para a primeira inscrição.');
    }

    if (!files.ProofOfResidence?.[0]) {
      throw new BadRequestException('Envie o comprovante de residência para a primeira inscrição.');
    }
  }

  private inferShiftFromSchedule(
    selections: DayPeriodDto[],
  ): Shift | undefined {
    if (!selections?.length) return undefined;

    const periods = new Set(selections.map((item) => item.period));
    if (periods.size >= 2) {
      return Shift.FULL_TIME;
    }

    const onlyPeriod = selections[0].period;
    if (onlyPeriod === 'Manhã') return Shift.MORNING;
    if (onlyPeriod === 'Tarde') return Shift.AFTERNOON;
    if (onlyPeriod === 'Noite') return Shift.NIGHT;

    return undefined;
  }

  async activate(id: string): Promise<void> {
    await this.studentRepository.update(id, {
      status: StudentStatus.ACTIVE,
      verificationCode: null,
      verificationCodeExpiresAt: null,
      verificationCodeAttempts: 0,
      verificationCodeLockedUntil: null,
      verificationCodeLastSentAt: null,
    });
  }

  async updateVerificationCode(
    id: string,
    codeHash: string,
    expiresAt: Date,
    lastSentAt: Date,
  ): Promise<void> {
    await this.studentRepository.update(id, {
      verificationCode: codeHash,
      verificationCodeExpiresAt: expiresAt,
      verificationCodeAttempts: 0,
      verificationCodeLockedUntil: null,
      verificationCodeLastSentAt: lastSentAt,
    });
  }

  async recordVerificationFailure(
    id: string,
    attempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    await this.studentRepository.update(id, {
      verificationCodeAttempts: attempts,
      verificationCodeLockedUntil: lockedUntil,
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.studentRepository.remove(id);
    if (!result) throw new NotFoundException(`Estudante ${id} não encontrado`);

    await this.auditLog.record({
      action: 'student.remove',
      outcome: 'success',
      target: { studentId: id },
    });

    return { message: 'Estudante removido com sucesso' };
  }
  async getDashboardStats(): Promise<StudentDashboardStats> {
    const students = await this.studentRepository.findAll(); // já filtra active: true

    const visitor = new StudentStatsVisitor();
    for (const student of students) {
      visitor.visit(student);
    }

    return visitor.getResult();
  }

  async findByBus(busIdentifier: string): Promise<Student[]> {
    const bus = await this.busService.findByIdentifier(busIdentifier);
    if (!bus) return [];

    const busId = (bus as any)._id?.toString?.();
    if (!busId) return [];

    return this.studentRepository.findByBus(busId);
  }

  async findByBusId(busId: string): Promise<Student[]> {
    const bus = await this.busService.findOneOrFail(busId);
    const resolvedBusId = (bus as any)._id?.toString?.();
    if (!resolvedBusId) return [];
    return this.studentRepository.findByBus(resolvedBusId);
  }

  async updatePassword(id: string, hashedPassword: string): Promise<Student | null> {
    const student = await this.studentRepository.update(id, { password: hashedPassword } as Partial<Student>);

    if (student) {
      await this.auditLog.record({
        action: 'student.updatePassword',
        outcome: 'success',
        target: { studentId: id },
      });
    }

    return student;
  }
}
