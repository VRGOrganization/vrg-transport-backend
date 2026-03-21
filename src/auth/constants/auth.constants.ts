import { Reflector } from '@nestjs/core';
import { UserRole } from '../../common/interfaces/user-roles.enum';

export const IS_PUBLIC_KEY = 'isPublic';

// NestJS 11 requer ReflectableDecorator em vez de string key
export const ROLES_KEY = Reflector.createDecorator<UserRole[]>();

export const AUTH_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Credenciais inválidas',
  USER_NOT_FOUND: 'Usuário não encontrado',
  EMAIL_ALREADY_EXISTS: 'Já existe uma conta com este e-mail',
  MATRICULA_ALREADY_EXISTS: 'Já existe uma conta com esta matrícula',
  UNAUTHORIZED: 'Você não está autorizado a acessar este recurso',
  INVALID_TOKEN: 'Token inválido ou expirado',
  FORBIDDEN: 'Você não tem permissão para acessar este recurso',
  ACCOUNT_PENDING: 'Conta pendente de verificação. Verifique seu e-mail.',
  INVALID_CODE: 'Código de verificação inválido',
  EXPIRED_CODE: 'Código de verificação expirado',
  ACCOUNT_ALREADY_ACTIVE: 'Esta conta já foi verificada',
} as const;