import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';
import { Student, StudentStatus } from './schemas/student.schema';
import { STUDENT_REPOSITORY } from './interfaces/repository.interface';
import type { IStudentRepository } from './interfaces/repository.interface';

@Injectable()
export class StudentService {
  constructor(
    @Inject(STUDENT_REPOSITORY)
    private readonly studentRepository: IStudentRepository<Student>,
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

  async update(id: string, dto: UpdateStudentDto): Promise<Student> {
    const student = await this.studentRepository.update(id, dto);
    if (!student) throw new NotFoundException(`Student ${id} não encontrado`);
    return student;
  }

  async activate(id: string): Promise<void> {
    await this.studentRepository.update(id, {
      status: StudentStatus.ACTIVE,
      verificationCode: null,
      verificationCodeExpiresAt: null,
    });
  }

  async updateVerificationCode(
    id: string,
    code: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.studentRepository.update(id, {
      verificationCode: code,
      verificationCodeExpiresAt: expiresAt,
    });
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.studentRepository.remove(id);
    if (!result) throw new NotFoundException(`Student ${id} não encontrado`);
    return { message: 'Student removido com sucesso' };
  }
}
