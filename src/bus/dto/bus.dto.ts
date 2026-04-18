import { IsInt, IsMongoId, IsNotEmpty, IsString, MaxLength, Min, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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