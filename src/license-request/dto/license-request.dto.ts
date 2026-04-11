import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const REJECTION_REASONS = [
  'Foto inadequada ou ilegível',
  'Comprovante de matrícula inválido',
  'Grade horária não corresponde aos documentos',
  'Documentos ilegíveis ou corrompidos',
  'Informações inconsistentes',
] as const;

export class RejectLicenseRequestDto {
  @ApiProperty({ enum: REJECTION_REASONS })
  @IsString()
  @IsNotEmpty()
  @IsIn([...REJECTION_REASONS], { message: 'Motivo de recusa inválido' })
  reason: string;
}

export class ApproveLicenseRequestDto {
  @ApiProperty({ description: 'Linha de ônibus' })
  @IsString()
  @IsNotEmpty()
  bus: string;

  @ApiProperty({ description: 'Instituição de ensino' })
  @IsString()
  @IsNotEmpty()
  institution: string;

  @ApiPropertyOptional({ description: 'Foto do estudante em base64' })
  @IsOptional()
  @IsString()
  photo?: string;
}
