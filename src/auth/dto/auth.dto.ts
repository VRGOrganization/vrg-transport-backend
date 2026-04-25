import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_DESCRIPTION,
  PASSWORD_POLICY_REGEX,
} from '../../common/validators/password-policy';

export class StudentLoginDto {
  @ApiProperty({
    example: 'user@email.com',
    description: 'E-mail do estudante',
  })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @ApiProperty({
    example: 'Senha123',
    description: 'Senha do estudante',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}

export class EmployeeLoginDto {
  @ApiProperty({
    example: 'EMP123456',
    description: 'Matrícula do funcionário',
  })
  @IsString()
  @IsNotEmpty({ message: 'Matrícula é obrigatória' })
  @Transform(({ value }) => value?.trim())
  registrationId!: string;

  @ApiProperty({
    example: 'Senha123',
    description: 'Senha do funcionário',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}

export class AdminLoginDto {
  @ApiProperty({
    example: 'admin',
    description: 'Username do administrador',
  })
  @IsString()
  @IsNotEmpty({ message: 'Username é obrigatório' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  username!: string;

  @ApiProperty({
    example: 'Admin123',
    description: 'Senha do administrador',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}

export class RegisterStudentDto {
  @ApiProperty({
    example: 'João Silva',
    description: 'Nome completo do estudante',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({
    example: 'joao@email.com',
    description: 'E-mail do estudante',
  })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @ApiProperty({
    example: 'Senha123!',
    description: PASSWORD_POLICY_DESCRIPTION,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_POLICY_REGEX, {
    message:
      'Senha deve conter letras maiúsculas, minúsculas, números e caractere especial',
  })
  password!: string;

  @ApiProperty({
    example: '+55 22 99999-9999',
    description: 'Telefone do estudante',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.replace(/\D/g, ''))
  @Matches(/^\d{10,13}$/, { message: 'Telefone inválido' })
  telephone!: string;

  @ApiProperty({
    example: '123.456.789-09',
    description: 'CPF do estudante (apenas dígitos ou formatado)',
  })
  @IsString()
  @IsNotEmpty({ message: 'CPF é obrigatório' })
  @Transform(({ value }) => value?.replace(/\D/g, ''))
  @Matches(/^\d{11}$/, { message: 'CPF inválido' })
  cpf!: string;
}

export class VerifyEmailDto {
  @ApiProperty({
    example: 'user@email.com',
    description: 'E-mail do usuário',
  })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;

  @ApiProperty({
    example: '123456',
    description: 'Código de verificação (6 dígitos)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'Código deve ter 6 dígitos' })
  code!: string;
}

export class ResendCodeDto {
  @ApiProperty({
    example: 'user@email.com',
    description: 'E-mail para reenvio do código',
  })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@email.com',
    description: 'E-mail do usuário',
  })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase().trim())
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'token_here',
    description: 'Token de redefinição de senha',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'NovaSenh@123',
    description: PASSWORD_POLICY_DESCRIPTION,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `Senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres`,
  })
  @Matches(PASSWORD_POLICY_REGEX, {
    message:
      'Senha deve conter letras maiúsculas, minúsculas, números e caractere especial',
  })
  password: string;
}
