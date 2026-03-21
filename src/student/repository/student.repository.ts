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
      .select('+password +verificationCode +verificationCodeExpiresAt')
      .exec();
  }

  async update(id: string, data: Partial<Student>): Promise<Student | null> {
    return this.studentModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.studentModel
      .findByIdAndUpdate(id, { active: false }, { new: true })
      .exec();
    return !!result;
  }
}
