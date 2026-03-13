import { Student } from 'src/student/entities/student.entity';
import { IsNotEmpty, IsString, IsPhoneNumber, IsUUID } from 'class-validator';

export class CreateLicenseDto {
    @IsNotEmpty()
    @IsUUID()
    student_id: string;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    degree: string;

    @IsNotEmpty()
    @IsString()
    institution: string;

    @IsNotEmpty()
    @IsString()
    shift: string;

    @IsNotEmpty()
    @IsString()
    telephone: string;

    @IsNotEmpty()
    @IsString()
    blood_type: string;

    @IsNotEmpty()
    @IsString()
    bus_number: string;

    @IsNotEmpty()
    @IsString()
    photo: string;

    @IsNotEmpty()
    @IsUUID()
    employee_id: string;

    
}
