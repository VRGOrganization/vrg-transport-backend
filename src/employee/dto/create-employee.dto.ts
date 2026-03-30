import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmployeeDto {
  @ApiProperty({
    example: 'Maria Souza',
    description: 'Nome completo do funcionário',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({
    example: 'maria@empresa.com',
    description: 'E-mail do funcionário',
  })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    example: 'EMP123456',
    description: 'Matrícula única do funcionário',
  })
  @IsString()
  @IsNotEmpty({ message: 'Registration ID is required' })
  @Transform(({ value }) => value?.trim())
  registrationId: string;

  @ApiProperty({
    example: 'Senha123',
    description:
      'Senha forte (mín. 8 caracteres, com letras maiúsculas, minúsculas e números)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, {
    message: 'Password must be at least 8 characters long',
  })
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain lowercase letters, uppercase letters, and numbers',
  })
  password: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}
