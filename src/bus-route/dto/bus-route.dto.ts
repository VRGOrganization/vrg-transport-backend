import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';

export class BusRouteDestinationDto {
  @ApiProperty({ example: 'Hospital Universitário', description: 'Nome do destino' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({ example: true, description: 'Destino ativo ou não' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateBusRouteDto {
  @ApiProperty({ example: '02', description: 'Número da linha' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Transform(({ value }) => value?.trim())
  lineNumber: string;

  @ApiProperty({
    type: [BusRouteDestinationDto],
    description: 'Lista de destinos da linha',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um destino' })
  @ValidateNested({ each: true })
  @Type(() => BusRouteDestinationDto)
  destinations: BusRouteDestinationDto[];
}

export class UpdateBusRouteDto extends PartialType(CreateBusRouteDto) {}

export class AddBusRouteDestinationDto {
  @ApiProperty({ example: 'Hospital Universitário', description: 'Nome do destino' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(({ value }) => value?.trim())
  name: string;
}
