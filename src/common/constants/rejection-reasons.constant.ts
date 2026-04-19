export const REJECTION_REASONS = [
  'Foto inadequada ou ilegível',
  'Comprovante de matrícula inválido',
  'Grade horária não corresponde aos documentos',
  'Documentos ilegíveis ou corrompidos',
  'Informações inconsistentes',
] as const;

export type RejectionReason = typeof REJECTION_REASONS[number];
