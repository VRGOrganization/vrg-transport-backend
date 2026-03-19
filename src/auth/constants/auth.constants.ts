export const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const AUTH_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'E-mail ou senha inválidos',
  USER_NOT_FOUND: 'Usuário não encontrado',
  EMAIL_ALREADY_EXISTS: 'Já existe um usuário com este e-mail',
  UNAUTHORIZED: 'Você não está autorizado a acessar este recurso',
  INVALID_TOKEN: 'Token inválido ou expirado',
  FORBIDDEN: 'Você não tem permissão para acessar este recurso',
} as const;

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';