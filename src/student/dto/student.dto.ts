import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
  Matches,
  IsArray,
  ValidateNested,
  IsIn,
  ArrayMinSize,
  IsMongoId,
} from 'class-validator';
import { plainToInstance, Transform, Type } from 'class-transformer';
import { OmitType, PartialType } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BloodType, Shift } from '../../common/interfaces/student-attributes.enum';

export class CreateStudentDto {
  @ApiProperty({
    example: 'João Silva',
    description: 'Nome completo do estudante',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({
    example: 'Engenharia de Software',
    description: 'Curso do estudante',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  degree?: string;

  @ApiProperty({
    enum: Shift,
    enumName: 'Shift',
    example: Shift.MORNING,
    description: 'Turno do estudante',
  })
  @IsEnum(Shift, { message: 'shift inválido' })
  @IsNotEmpty()
  shift?: Shift;

  @ApiProperty({
    example: '+55 22 99999-9999',
    description: 'Telefone do estudante',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[\d\s\-()]{10,15}$/, {
    message: 'Telefone inválido',
  })
  telephone!: string;

  @ApiProperty({
    enum: BloodType,
    enumName: 'BloodType',
    example: 'O+',
    description: 'Tipo sanguíneo do estudante',
  })
  @IsEnum(BloodType, { message: 'bloodType inválido' })
  @IsNotEmpty()
  bloodType?: BloodType;

  @ApiProperty({
    example: 'Universidade Federal',
    description: 'Instituição de ensino',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  institution?: string;

  @ApiProperty({
    example: '05',
    description: 'Linha de ônibus utilizada pelo estudante',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bus?: string;
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}

// ── Schedule ──────────────────────────────────────────────────

export const VALID_DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'] as const;
export const VALID_PERIODS = ['Manhã', 'Tarde', 'Noite'] as const;

export class DayPeriodDto {
  @ApiProperty({ example: 'SEG', description: 'Dia da semana' })
  @IsString()
  @IsIn(VALID_DAYS, { message: 'Dia inválido' })
  day!: string;

  @ApiProperty({ example: 'Manhã', description: 'Período' })
  @IsString()
  @IsIn(VALID_PERIODS, { message: 'Período inválido' })
  period!: string;
}

export class SubmitScheduleDto {
  @ApiProperty({ type: [DayPeriodDto], description: 'Grade horária selecionada' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione ao menos um período' })
  @ValidateNested({ each: true })
  @Type(() => DayPeriodDto)
  selections!: DayPeriodDto[];
}

export class UpdateStudentProfileDto extends OmitType(
  PartialType(CreateStudentDto),
  ['bus'] as const,
) {
  @ApiPropertyOptional({
    example: '64a7f1e2b5d6c2f9a0e12345',
    description: 'MongoDB ObjectId da universidade selecionada (opcional)',
  })
  @IsOptional()
  @IsMongoId({ message: 'universityId inválido' })
  universityId?: string;
  @ApiPropertyOptional({
    type: [DayPeriodDto],
    description: 'Grade horária selecionada',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione ao menos um período' })
  @ValidateNested({ each: true })
  @Type(() => DayPeriodDto)
  schedule?: DayPeriodDto[];
}

export class SubmitLicenseRequestFormDto {
  @ApiPropertyOptional({
    example: 'Universidade Federal',
    description: 'Instituição de ensino',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => value?.trim())
  institution?: string;

  @ApiPropertyOptional({
    example: 'Engenharia de Software',
    description: 'Curso do estudante',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  degree?: string;

  @ApiPropertyOptional({
    enum: Shift,
    enumName: 'Shift',
    example: Shift.MORNING,
    description: 'Turno do estudante',
  })
  @IsOptional()
  @IsEnum(Shift, { message: 'shift inválido' })
  shift?: Shift;

  @ApiPropertyOptional({
    enum: BloodType,
    enumName: 'BloodType',
    example: 'O+',
    description: 'Tipo sanguíneo do estudante',
  })
  @IsOptional()
  @IsEnum(BloodType, { message: 'bloodType inválido' })
  bloodType?: BloodType;

  @ApiProperty({
    description:
      'Grade horária serializada em JSON dentro do FormData. Ex.: [{"day":"SEG","period":"Manhã"}]',
    example: '[{"day":"SEG","period":"Manhã"}]',
  })
  @IsNotEmpty()
  @Transform(({ value }) => {
    const parsed = (() => {
      if (Array.isArray(value)) return value;
      if (typeof value !== 'string') return value;

      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    })();

    if (!Array.isArray(parsed)) {
      return parsed;
    }

    return parsed.map((item) => plainToInstance(DayPeriodDto, item));
  })
  @IsArray({ message: 'schedule deve ser um JSON de array válido' })
  @ArrayMinSize(1, { message: 'Selecione ao menos um período' })
  @ValidateNested({ each: true })
  @Type(() => DayPeriodDto)
  schedule!: DayPeriodDto[];
}
