import { IsOptional, IsString, Length, IsIn } from 'class-validator';

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  name?: string;

  @IsOptional()
  @IsString()
  degree?: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Matutino', 'Vespertino', 'Noturno', 'Integral'])
  shift?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  @IsIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
  blood_type?: string;

  // garantir que pelo menos um campo foi enviado
  hasAtLeastOneField(): boolean {
    return !!(this.name || this.degree || this.institution || 
              this.shift || this.telephone || this.blood_type);
  }
}