/*
  Validacao de configuracao de seguranca, como chaves secretas, conexao com banco de dados, etc.
  A funcao validateSecurityConfig recebe um objeto de configuracao e verifica se as chaves necessarias estao presentes e sao validas.
  Ela verifica se as chaves JWT_SECRET, JWT_REFRESH_SECRET, OTP_PEPPER, 
  MONGODB_URI, MONGODB_URI_IMAGE, ALLOWED_ORIGINS, LICENSE_API_URL, LICENSE_API_KEY, EMAIL_HOST, EMAIL_PORT,
   EMAIL_USER e EMAIL_PASS estao presentes e tem o formato correto.
  Se alguma chave estiver faltando ou for invalida, a funcao lancara um erro. Caso contrario, ela retornara o objeto de configuracao com os valores validados.

*/

export function validateSecurityConfig(config: Record<string, unknown>) {
  const requiredString = (key: string, minLength = 1) => {
    const value = config[key];
    if (typeof value !== 'string' || value.trim().length < minLength) {
      throw new Error(`Missing required config value for key: ${key}`);
    }
    return value.trim();
  };

  const jwtSecret = requiredString('JWT_SECRET', 32);
  const jwtRefreshSecret = requiredString('JWT_REFRESH_SECRET', 32);
  const otpPepper = requiredString('OTP_PEPPER', 16);
  const mongodbUri = requiredString('MONGODB_URI');
  const mongodbUriImage = requiredString('MONGODB_URI_IMAGE');
  const allowedOrigins = requiredString('ALLOWED_ORIGINS');
  const licenseApiUrl = requiredString('LICENSE_API_URL');
  const licenseApiKey = requiredString('LICENSE_API_KEY');
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
    JWT_SECRET:           jwtSecret,
    JWT_REFRESH_SECRET:   jwtRefreshSecret,
    OTP_PEPPER:           otpPepper,
    MONGODB_URI:          mongodbUri,
    MONGODB_URI_IMAGE:    mongodbUriImage,
    ALLOWED_ORIGINS:      allowedOrigins,
    BASE_URL_API_LICENSE: licenseApiUrl,
    X_API_KEY:            licenseApiKey,
    /* EMAIL_HOST:           emailHost,
    EMAIL_PORT:           emailPort,
    EMAIL_USER:           emailUser,
    EMAIL_PASS:           emailPass */
  }
}
