import { IsArray, IsIn, IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Shift } from '../../common/interfaces/student-attributes.enum';
import { BUS_PERIODS } from '../schema/bus.schema';

export class CreateBusDto {
  @ApiProperty({ example: 'Ônibus 03', description: 'Identificador único do ônibus' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  identifier: string;

  @ApiProperty({ example: 48, description: 'Capacidade máxima de passageiros', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({
    enum: BUS_PERIODS,
    enumName: 'BusPeriod',
    example: Shift.MORNING,
    description: 'Período principal do ônibus',
  })
  @IsOptional()
  @IsIn(BUS_PERIODS, { message: 'Período do ônibus inválido' })
  shift?: (typeof BUS_PERIODS)[number];
}

export class UpdateBusDto extends PartialType(CreateBusDto) {}

export class LinkUniversityDto {
  @ApiProperty({ example: '6650a2f...', description: 'ID da faculdade' })
  @IsMongoId()
  @IsNotEmpty()
  universityId: string;
}

export class UniversitySlotDto {
  @ApiProperty({ example: '6650a2f...', description: 'ID da faculdade' })
  @IsMongoId()
  @IsNotEmpty()
  universityId: string;

  @ApiProperty({ example: 1, description: 'Ordem de prioridade (1 = maior)' })
  @IsInt()
  @Min(1)
  priorityOrder: number;
}

export class UpdateUniversitySlotsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UniversitySlotDto)
  slots: UniversitySlotDto[];
}
