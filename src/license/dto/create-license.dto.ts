import { validate } from 'class-validator';
import { Student } from 'src/student/entities/student.entity';

export class CreateLicenseDto {
    student: Student;
}
