import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BloodType, Shift } from '../../common/interfaces/student-attributes.enum';

export class CreateLicenseDto {
  @ApiProperty({
    example: '65f1c2a9e8b4f1a2c3d4e5f6',
    description: 'ID do estudante',
  })
  @IsMongoId({ message: 'id do student inválido' })
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    example: 'João Silva',
    description: 'Nome completo do estudante (idealmente vindo do banco)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
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
    example: 'Universidade Federal Fluminense',
    description: 'Instituição de ensino',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  institution: string;

  @ApiProperty({
    enum: Shift,
    enumName: 'Shift',
    example: 'MORNING',
    description: 'Turno do estudante',
  })
  @IsEnum(Shift, {
    message: `shift inválido. Valores aceitos: ${Object.values(Shift).join(', ')}`,
  })
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
    description: 'Tipo sanguíneo',
  })
  @IsEnum(BloodType, {
    message: `blood_type inválido. Valores aceitos: ${Object.values(BloodType).join(', ')}`,
  })
  @IsNotEmpty()
  blood_type: BloodType;

  @ApiProperty({
    example: '05',
    description: 'Linha de ônibus utilizada',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bus: string;

  @ApiProperty({
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    description:
      'Foto do estudante em base64 (jpeg, png, webp). Máx ~1.5MB',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000_000, {
    message: 'Foto muito grande. Máximo ~1.5MB em base64.',
  })
  @Matches(/^data:image\/(jpeg|jpg|png|webp);base64,/, {
    message: 'photo deve ser base64 válido (jpeg, jpg, png ou webp)',
  })
  photo: string;
}
