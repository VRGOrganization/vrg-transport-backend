import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';
import { Student, StudentStatus } from './schemas/student.schema';
import { STUDENT_REPOSITORY } from './interfaces/repository.interface';
import type { IStudentRepository } from './interfaces/repository.interface';
import { AuditLogService } from '../common/audit/audit-log.service';
@Injectable()
export class StudentService {
  constructor(
    @Inject(STUDENT_REPOSITORY)
    private readonly studentRepository: IStudentRepository<Student>,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(data: Partial<Student>): Promise<Student> {
    return this.studentRepository.create(data);
  }

  async findAll(): Promise<Student[]> {
    return this.studentRepository.findAll();
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

  async findOneOrFail(id: string): Promise<Student> {
    const student = await this.studentRepository.findById(id);
    if (!student) throw new NotFoundException(`Student ${id} não encontrado`);
    return student;
  }

  async update(id: string, dto: UpdateStudentDto | Partial<Student>): Promise<Student> {
    const allowedFields = {...dto} as Record<string, unknown>;
    // Remove campos que não devem ser atualizados diretamente
    delete allowedFields['active'];
    delete allowedFields['photo'];
    delete allowedFields['status'];
    delete allowedFields['password'];
    delete allowedFields['refreshTokenHash'];
    delete allowedFields['refreshTokenVersion'];
    delete allowedFields['verificationCode'];
    delete allowedFields['verificationCodeExpiresAt'];
    delete allowedFields['verificationCodeAttempts'];
    delete allowedFields['verificationCodeLockedUntil'];
    delete allowedFields['verificationCodeLastSentAt'];

    const student = await this.studentRepository.update(id, allowedFields as Partial<Student>);
    if (!student) throw new NotFoundException(`Student ${id} não encontrado`);

    await this.auditLog.record({
      action: 'update_student',
      outcome: 'success',
      target: {studentId : id},
      metadata: { fields: Object.keys(allowedFields) },
    })

    return student;
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
  
  async updateRefreshToken(id: string, hash: string, version: number): Promise<void> {
    await this.studentRepository.update(id, {
      refreshTokenHash: hash,
      refreshTokenVersion: version,
    });
  }

  async clearRefreshToken(id: string): Promise<void> {
    await this.studentRepository.update(id, {
      refreshTokenHash: null,
      // Incrementa a versão mesmo no logout — invalida qualquer token em trânsito
      refreshTokenVersion: Date.now(), // valor arbitrariamente alto, nunca vai bater
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.studentRepository.remove(id);
    if (!result) throw new NotFoundException(`Student ${id} não encontrado`);

    await this.auditLog.record({
      action: 'student.remove',
      outcome: 'success',
      target: { studentId: id },
    });

    return { message: 'Student removido com sucesso' };
  }
}
