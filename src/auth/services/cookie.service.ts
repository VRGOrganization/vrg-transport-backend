import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

/**
 * CookieService
 *
 * Responsabilidade única: gerenciar o ciclo de vida do cookie HTTP-only
 * que carrega o refresh token.
 *
 * Por que centralizar aqui?
 * - O nome do cookie, as opções e o caminho são usados em pelo menos 3 lugares
 *   (login, refresh, logout). Duplicar isso é fonte de bugs silenciosos.
 * - Garante que as opções de segurança (httpOnly, secure, sameSite) sejam
 *   aplicadas de forma consistente em todo o sistema.
 * - Facilita testes: basta mockar este serviço.
 */
@Injectable()
export class CookieService {
  private readonly logger = new Logger(CookieService.name);

  /**
   * Nome canônico do cookie.
   * Centralizado aqui para evitar typos espalhados pelo código.
   */
  static readonly COOKIE_NAME = 'refresh_token' as const;

  /**
   * Path restrito ao endpoint de refresh.
   * O browser só envia este cookie para POST /auth/refresh e POST /auth/logout.
   * Isso reduz a superfície de exposição: nenhuma outra rota recebe o cookie.
   */
  private static readonly COOKIE_PATH_REFRESH = '/auth/refresh';
  private static readonly COOKIE_PATH_LOGOUT = '/auth/logout';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Escreve o refresh token como HTTP-only cookie na resposta.
   *
   * Opções de segurança:
   * - httpOnly: JavaScript não consegue ler (mitiga XSS)
   * - secure: apenas HTTPS em produção
   * - sameSite: 'strict' bloqueia envio cross-site (mitiga CSRF)
   * - path: restrito a /auth/refresh — o browser não envia em outras rotas
   * - maxAge: alinhado com JWT_REFRESH_EXPIRES_IN (7 dias em ms)
   */
  setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const maxAgeMs = this.parseExpiresInToMs(
      this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
    );

    // Cookie para o endpoint de refresh
    res.cookie(CookieService.COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: CookieService.COOKIE_PATH_REFRESH,
      maxAge: maxAgeMs,
    });

    // Segundo cookie idêntico para o endpoint de logout
    // Necessário porque path é exato: um cookie com path=/auth/refresh
    // não é enviado para /auth/logout
    res.cookie(CookieService.COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: CookieService.COOKIE_PATH_LOGOUT,
      maxAge: maxAgeMs,
    });

    this.logger.debug('Refresh token cookie set (httpOnly, path-restricted)');
  }

  /**
   * Invalida o cookie nos dois paths registrados.
   * Usar maxAge: 0 é mais confiável que clearCookie() isolado
   * porque garante que o path correto seja sobrescrito.
   */
  clearRefreshTokenCookie(res: Response): void {
    const baseOptions = {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict' as const,
      maxAge: 0,
    };

    res.cookie(CookieService.COOKIE_NAME, '', {
      ...baseOptions,
      path: CookieService.COOKIE_PATH_REFRESH,
    });

    res.cookie(CookieService.COOKIE_NAME, '', {
      ...baseOptions,
      path: CookieService.COOKIE_PATH_LOGOUT,
    });

    this.logger.debug('Refresh token cookies cleared');
  }

  /**
   * Extrai o refresh token bruto do objeto de cookies do request.
   * Retorna null em vez de lançar para permitir tratamento no service.
   */
  extractRefreshToken(cookies: Record<string, string> | undefined): string | null {
    return cookies?.[CookieService.COOKIE_NAME] ?? null;
  }

  // ─── Helpers privados ────────────────────────────────────────────────────────

  /**
   * Converte strings no formato do pacote `ms` para milissegundos.
   * Suporta: "7d", "15m", "1h", "30s".
   * Valores desconhecidos retornam 7 dias como fallback seguro.
   */
  private parseExpiresInToMs(value: string): number {
    const units: Record<string, number> = {
      s: 1_000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };

    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) {
      this.logger.warn(
        `JWT_REFRESH_EXPIRES_IN "${value}" não reconhecido. Usando fallback de 7 dias.`,
      );
      return 7 * units['d'];
    }

    return parseInt(match[1], 10) * units[match[2]];
  }
}