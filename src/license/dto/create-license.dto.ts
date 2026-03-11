import { IsNotEmpty, IsObject } from 'class-validator';
import { Student } from 'src/student/entities/student.entity';

export class CreateLicenseDto {
    @IsNotEmpty()
    @IsObject()
    student: Student;
}
