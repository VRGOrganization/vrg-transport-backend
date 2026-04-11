import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Student, StudentDocument } from '../schemas/student.schema';
import { IStudentRepository } from '../interfaces/repository.interface';

@Injectable()
export class StudentRepository implements IStudentRepository<Student> {
  constructor(
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
  ) {}

  async create(data: Partial<Student>): Promise<Student> {
    const student = new this.studentModel(data);
    return student.save();
  }

  async findAll(): Promise<Student[]> {
    return this.studentModel.find({ active: true }).exec();
  }

  async findAllPaginated(
    page: number,
    limit: number,
  ): Promise<{ data: Student[]; total: number; page: number; limit: number }> {
    const filter = { active: true };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.studentModel.find(filter).skip(skip).limit(limit).exec(),
      this.studentModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Student | null> {
    return this.studentModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<Student | null> {
    // select: false nos campos sensíveis — não retorna password/código aqui
    return this.studentModel.findOne({ email }).exec();
  }

  /**
   * Usado exclusivamente no login e verificação de código.
   * Força a inclusão de campos com select: false (password, verificationCode).
   */
   async findByEmailWithSensitiveFields(email: string): Promise<Student | null> {
    return this.studentModel
      .findOne({ email })
      .select(
        '+password ' +
        '+verificationCode ' +
        '+verificationCodeExpiresAt ' +
        '+verificationCodeAttempts ' +
        '+verificationCodeLockedUntil ' +
          '+verificationCodeLastSentAt',
      )
      .exec();
  }

  async findByCpfHash(cpfHash: string): Promise<Student | null> {
    return this.studentModel.findOne({ cpfHash }).select('+cpfHash').exec();
  }

  async update(id: string, data: Partial<Student>): Promise<Student | null> {
  return this.studentModel
    .findByIdAndUpdate(id, { $set: data }, { new: true })
    .exec();
}

  async remove(id: string): Promise<boolean> {
    const result = await this.studentModel
      .findByIdAndUpdate(id, { $set: { active: false } }, { new: true })
      .exec();
    return !!result;
  }
}
