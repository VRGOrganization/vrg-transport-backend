import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType, OmitType } from '@nestjs/mapped-types';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  degree: string;

  @IsString()
  @IsNotEmpty()
  shift: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[\d\s\-()]{10,15}$/, { message: 'Telefone inválido' })
  telephone: string;

  @IsString()
  @IsNotEmpty()
  bloodType: string;

  @IsString()
  @IsNotEmpty()
  buss: string;

  @IsOptional()
  @IsString()
  photo?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

// Update não permite alterar campos de auth via StudentController
export class UpdateStudentDto extends PartialType(
  OmitType(CreateStudentDto, [] as const),
) {}
