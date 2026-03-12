import { IsString, Length, IsIn, IsNotEmpty } from 'class-validator';

export class CreateStudentDto {
    @IsString()
    @IsNotEmpty()
    @Length(3, 100)
    name: string;  
  
    @IsString()
    @IsNotEmpty()
    degree: string;
  
    @IsString()
    @IsNotEmpty()
    institution: string;
  
    @IsString()
    @IsNotEmpty()
    @IsIn(['Matutino', 'Vespertino', 'Noturno', 'Integral'])
    shift: string;
  
    @IsString()
    @IsNotEmpty()
    telephone: string;
  
    @IsString()
    @IsNotEmpty()
    @IsIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    blood_type: string;
}