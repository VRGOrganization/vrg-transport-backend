export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
export const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;

export function getPasswordPolicyViolation(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Senha deve ter no m?nimo ${PASSWORD_MIN_LENGTH} caracteres`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Senha deve ter no m?ximo ${PASSWORD_MAX_LENGTH} caracteres`;
  }

  if (!/[a-z]/.test(password)) {
    return 'Senha deve conter letras min?sculas';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Senha deve conter letras mai?sculas';
  }

  if (!/\d/.test(password)) {
    return 'Senha deve conter n?meros';
  }

  if (!/[^A-Za-z\d]/.test(password)) {
    return 'Senha deve conter ao menos um caractere especial';
  }

  return null;
}

export const PASSWORD_POLICY_DESCRIPTION =
  'Senha forte (m?n. 8 caracteres, com mai?scula, min?scula, n?mero e caractere especial)';
