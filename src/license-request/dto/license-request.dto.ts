import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { REJECTION_REASONS } from '../../common/constants/rejection-reasons.constant';
import type { RejectionReason } from '../../common/constants/rejection-reasons.constant';

export class RejectLicenseRequestDto {
  @ApiProperty({ enum: REJECTION_REASONS })
  @IsString()
  @IsNotEmpty()
  @IsIn([...REJECTION_REASONS], { message: 'Motivo de recusa inválido' })
  reason!: RejectionReason;
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
