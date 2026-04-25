import { IsMongoId, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCourseDto {
  @ApiProperty({ example: 'Psicologia', description: 'Nome do curso' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({ example: '6650a2f...', description: 'ID da faculdade à qual o curso pertence' })
  @IsMongoId()
  @IsNotEmpty()
  universityId: string;
}

export class UpdateCourseDto extends PartialType(
  OmitType(CreateCourseDto, ['universityId'] as const),
) {}