import {
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OmitType, PartialType } from '@nestjs/swagger';
import { REJECTION_REASONS } from '../../common/constants/rejection-reasons.constant';
import type { RejectionReason } from '../../common/constants/rejection-reasons.constant';

export class CreateLicenseDto {
  @ApiProperty({
    example: '65f1c2a9e8b4f1a2c3d4e5f6',
    description: 'ID do estudante (MongoDB ObjectId)',
  })
  @IsMongoId({ message: 'id do student inválido' })
  @IsNotEmpty()
  id: string;

  @ApiProperty({
    example: 'Universidade Federal Fluminense',
    description: 'Instituição de ensino',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  institution: string;

  @ApiProperty({
    example: '205',
    description: 'Linha de ônibus definida pelo funcionário',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  bus: string;

  @ApiPropertyOptional({
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    description: 'Foto do estudante em base64 (jpeg, png, webp). Máx ~1.5MB',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2097152, {
    message: 'Foto muito grande. Máximo 2MB em base64.',
  })
  @Matches(/^data:image\/(jpeg|jpg|png|webp);base64,/, {
    message: 'photo deve ser base64 válido (jpeg, jpg, png ou webp)',
  })
  photo?: string;
}

export class RejectLicenseDto {
  @ApiProperty({
    enum: REJECTION_REASONS,
    description: 'Motivo da recusa da carteirinha',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([...REJECTION_REASONS], { message: 'Motivo de recusa inválido' })
  reason!: RejectionReason;
}

export class UpdateLicenseDto extends PartialType(
  OmitType(CreateLicenseDto, ['id'] as const),
) {}
