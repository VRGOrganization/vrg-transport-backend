import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Student, StudentDocument } from './schemas/student.schema';
import { IStudentRepository } from './interfaces/repository.interface';

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