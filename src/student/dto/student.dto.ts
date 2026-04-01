import {
  IsNotEmpty,
  IsString,
  IsEnum,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
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
  name: string;

  @ApiProperty({
    example: 'Engenharia de Software',
    description: 'Curso do estudante',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  degree: string;

  @ApiProperty({
    enum: Shift,
    enumName: 'Shift',
    example: Shift.MORNING,
    description: 'Turno do estudante',
  })
  @IsEnum(Shift, { message: 'shift inválido' })
  @IsNotEmpty()
  shift: Shift;

  @ApiProperty({
    example: '+55 22 99999-9999',
    description: 'Telefone do estudante',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[\d\s\-()]{10,15}$/, {
    message: 'Telefone inválido',
  })
  telephone: string;

  @ApiProperty({
    enum: BloodType,
    enumName: 'BloodType',
    example: 'O+',
    description: 'Tipo sanguíneo do estudante',
  })
  @IsEnum(BloodType, { message: 'bloodType inválido' })
  @IsNotEmpty()
  bloodType: BloodType;

  @ApiProperty({
    example: '05',
    description: 'Linha de ônibus utilizada pelo estudante',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bus: string;
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}
