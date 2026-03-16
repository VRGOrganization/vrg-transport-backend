import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateStudentDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  degree: string;

  @IsNotEmpty()
  @IsString()
  shift: string;

  @IsNotEmpty()
  @IsString()
  telephone: string;

  @IsNotEmpty()
  @IsString()
  bloodType: string;

  @IsNotEmpty()
  @IsString()
  buss: string;

  @IsOptional()
  @IsString()
  photo?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}