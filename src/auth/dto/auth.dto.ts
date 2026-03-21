import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class StudentLoginDto {
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class EmployeeLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Matrícula é obrigatória' })
  @Transform(({ value }) => value?.trim())
  registrationId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Username é obrigatório' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class RegisterStudentDto {
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Senha deve conter letras maiúsculas, minúsculas e números',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  degree: string;

  @IsString()
  @IsNotEmpty()
  shift: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[\d\s\-()]{10,15}$/, { message: 'Telefone inválido' })
  telephone: string;

  @IsString()
  @IsNotEmpty()
  bloodType: string;

  @IsString()
  @IsNotEmpty()
  buss: string;
}

export class VerifyEmailDto {
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'Código deve ter 6 dígitos' })
  code: string;
}

export class ResendCodeDto {
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;
}
