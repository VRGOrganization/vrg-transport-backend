/*
  Validação central de env vars obrigatórias para segurança e runtime.
  Se qualquer chave obrigatória estiver ausente/inválida, o bootstrap falha
  imediatamente (fail-fast) para evitar comportamento parcial em produção.
*/

export function validateSecurityConfig(config: Record<string, unknown>) {
  const requiredString = (key: string, minLength = 1) => {
    const value = config[key];
    if (typeof value !== 'string' || value.trim().length < minLength) {
      throw new Error(`Missing required config value for key: ${key}`);
    }
    return value.trim();
  };

  const requiredPositiveInt = (key: string) => {
    const raw = requiredString(key);
    const value = Number(raw);

    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Invalid required config value for key: ${key} (must be a positive integer)`);
    }

    return value;
  };

  
  const otpPepper = requiredString('OTP_PEPPER', 16);
  const cpfHmacSecret = requiredString('CPF_HMAC_SECRET', 16);
  const mongodbUri = requiredString('MONGODB_URI');
  const mongodbUriImage = requiredString('MONGODB_URI_IMAGE');
  const allowedOrigins = requiredString('ALLOWED_ORIGINS');
  const licenseApiUrl = requiredString('LICENSE_API_URL');
  const licenseApiKey = requiredString('LICENSE_API_KEY');
  const qrCodeBaseUrl = requiredString('QR_CODE_BASE_URL');
  const brevoApiKey = requiredString('BREVO_API_KEY', 16);
  const mailFromAddress = requiredString('MAIL_FROM_ADDRESS', 3);
  const serviceSecret = requiredString('SERVICE_SECRET', 32);
  const sessionTtlDays = requiredPositiveInt('SESSION_TTL_DAYS');
  /* const emailHost = requiredString('EMAIL_HOST');
  const emailPort = requiredString('EMAIL_PORT');
  const emailUser = requiredString('EMAIL_USER');
  const emailPass = requiredString('EMAIL_PASS');
 */
  if(
    allowedOrigins === '*' ||
    allowedOrigins.split(',').some((o) => o.trim() === '*')
  ){
    throw new Error('ALLOWED_ORIGINS cannot contain wildcard');
  }

  return{
    ...config,
    OTP_PEPPER:           otpPepper,
    CPF_HMAC_SECRET:      cpfHmacSecret,
    MONGODB_URI:          mongodbUri,
    MONGODB_URI_IMAGE:    mongodbUriImage,
    ALLOWED_ORIGINS:      allowedOrigins,
    BASE_URL_API_LICENSE: licenseApiUrl,
    X_API_KEY:            licenseApiKey,
    QR_CODE_BASE_URL:     qrCodeBaseUrl,
    BREVO_API_KEY:        brevoApiKey,
    MAIL_FROM_ADDRESS:    mailFromAddress,
    SERVICE_SECRET:       serviceSecret,
    SESSION_TTL_DAYS:     sessionTtlDays,
    /* EMAIL_HOST:           emailHost,
    EMAIL_PORT:           emailPort,
    EMAIL_USER:           emailUser,
    EMAIL_PASS:           emailPass */
  }
}
