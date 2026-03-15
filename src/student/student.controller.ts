import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StudentService } from './student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Controller('student')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post()
  async create(@Body() createStudentDto: CreateStudentDto) {
    try {
      const student = await this.studentService.create(createStudentDto);
      return {
        statusCode: 201,
        message: 'Student created successfully',
        data: student,
      };
    } catch (error) {
      return {
        statusCode: error.status || 400,
        message: error.message,
      };
    }
  }

  @Get()
  async findAll() {
    try {
      const students = await this.studentService.findAll();
      return {
        statusCode: 200,
        message: 'Students retrieved successfully',
        data: students,
      };
    } catch (error) {
      return {
        statusCode: 500,
        message: error.message,
      };
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const student = await this.studentService.findOne(id);
      return {
        statusCode: 200,
        message: 'Student retrieved successfully',
        data: student,
      };
    } catch (error) {
      return {
        statusCode: error.status || 404,
        message: error.message,
      };
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateStudentDto: UpdateStudentDto) {
    try {
      const student = await this.studentService.update(id, updateStudentDto);
      return {
        statusCode: 200,
        message: 'Student updated successfully',
        data: student,
      };
    } catch (error) {
      return {
        statusCode: error.status || 400,
        message: error.message,
      };
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const result = await this.studentService.remove(id);
      return {
        statusCode: 200,
        message: result.message,
      };
    } catch (error) {
      return {
        statusCode: error.status || 404,
        message: error.message,
      };
    }
  }
}