export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
export const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;

export function getPasswordPolicyViolation(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres`;
  }

  if (!/[a-z]/.test(password)) {
    return 'Senha deve conter letras minúsculas';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Senha deve conter letras maiúsculas';
  }

  if (!/\d/.test(password)) {
    return 'Senha deve conter números';
  }

  if (!/[^A-Za-z\d]/.test(password)) {
    return 'Senha deve conter ao menos um caractere especial';
  }

  return null;
}

export const PASSWORD_POLICY_DESCRIPTION =
  'Senha forte (mín. 8 caracteres, com maiúscula, minúscula, número e caractere especial)';
