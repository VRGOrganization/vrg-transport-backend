import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Student } from './schemas/student.schema';
import * as repositoryInterface from './interfaces/repository.interface';

@Injectable()
export class StudentService {
  constructor(
    @Inject(repositoryInterface.STUDENT_REPOSITORY)
    private readonly studentRepository: repositoryInterface.IStudentRepository<Student>,
  ) {}

  async create(createStudentDto: CreateStudentDto): Promise<Student> {
    try {
      const student = await this.studentRepository.create(createStudentDto);
      return student;
    } catch (error) {
      throw error;
    }
  }

  async findAll(): Promise<Student[]> {
    return this.studentRepository.findAll();
  }

  async findOne(id: string): Promise<Student> {
    const student = await this.studentRepository.findById(id);
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    return student;
  }

  async update(id: string, updateStudentDto: UpdateStudentDto): Promise<Student> {
    const student = await this.studentRepository.update(id, updateStudentDto);
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    return student;
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.studentRepository.remove(id);
    if (!result) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }
    return { message: 'Student removed successfully' };
  }
}