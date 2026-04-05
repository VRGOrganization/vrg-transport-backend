import { UserRole } from '../../common/interfaces/user-roles.enum';

// ─── JWT ─────────────────────────────────────────────────────────────────────

/**
 * Payload do access token.
 * tokenUse: 'access' garante que o JwtStrategy rejeite refresh tokens
 * usados diretamente em rotas protegidas.
 */
export interface JwtPayload {
  sub: string;
  role: UserRole;
  identifier: string;
  tokenUse: 'access' | 'refresh';
}

/**
 * Payload do refresh token — estende JwtPayload com tokenVersion.
 *
 * tokenVersion é a chave da detecção de reuse attack:
 * cada rotação incrementa a versão no banco. Se um token com versão
 * antiga chegar, sabemos que foi reutilizado após rotação.
 */
export interface RefreshPayload extends JwtPayload {
  tokenUse: 'refresh';
  tokenVersion: number;
}

// ─── Usuário autenticado ──────────────────────────────────────────────────────

/**
 * Shape do objeto `request.user` após validação pelo JwtStrategy.
 *
 * Interface (não classe): AuthenticatedUser é um shape de dados puro,
 * nunca instanciado via `new`. O decorator @CurrentUser() usa
 * `keyof AuthenticatedUser` para tipagem — funciona perfeitamente
 * com interface. Usar class aqui causaria erro de strictPropertyInitialization.
 */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  identifier: string;
  name: string;
}
// ─── Tokens internos ─────────────────────────────────────────────────────────

/**
 * Par de tokens emitido pelo TokenService.
 * Usado internamente: o refresh_token NUNCA é retornado no body da resposta HTTP.
 * Ele vai direto para o cookie via CookieService.
 */
export interface IssuedTokens {
  access_token: string;
  refresh_token: string;
}

// ─── Respostas HTTP públicas ──────────────────────────────────────────────────

/**
 * O que o cliente recebe no body após login/refresh/verify.
 *
 * Importante: refresh_token NÃO está aqui.
 * Ele é escrito como HTTP-only cookie pelo CookieService antes
 * de o controller retornar esta estrutura.
 */
export interface LoginResponse {
  access_token: string;
  user: AuthenticatedUser;
}

/**
 * Sessão carregada do banco para validação do refresh token.
 * Usada internamente no AuthService.refreshToken().
 */
export interface RefreshSession {
  refreshTokenHash: string;
  refreshTokenVersion: number;
  isActive: boolean;
}