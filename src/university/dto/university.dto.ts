import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUniversityDto {
  @ApiProperty({ example: 'Universidade Federal Fluminense', description: 'Nome completo da faculdade' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: 'UFF', description: 'Sigla da faculdade (será salva em maiúsculas)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(({ value }) => value?.trim().toUpperCase())
  acronym: string;

  @ApiProperty({ example: 'Rua Miguel de Frias, 9 - Icaraí, Niterói - RJ', description: 'Endereço da faculdade' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  address: string;
}

export class UpdateUniversityDto extends PartialType(CreateUniversityDto) {}