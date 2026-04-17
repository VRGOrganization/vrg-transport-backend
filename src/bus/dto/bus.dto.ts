import { IsInt, IsMongoId, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBusDto {
  @ApiProperty({ example: 'Ônibus 03', description: 'Identificador único do ônibus' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  identifier: string;

  @ApiProperty({ example: 48, description: 'Capacidade máxima de passageiros' })
  @IsInt()
  @Min(1)
  capacity: number;
}

export class UpdateBusDto extends PartialType(CreateBusDto) {}

export class LinkUniversityDto {
  @ApiProperty({ example: '6650a2f...', description: 'ID da faculdade' })
  @IsMongoId()
  @IsNotEmpty()
  universityId: string;
}