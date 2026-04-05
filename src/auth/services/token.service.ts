import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';
import { JwtPayload, RefreshPayload, IssuedTokens } from '../interfaces/auth.interface';
import { AUTH_ERROR_MESSAGES } from '../constants/auth.constants';

/**
 * TokenService
 *
 * Responsabilidade única: emitir e verificar tokens JWT.
 *
 * Por que separar do AuthService?
 * - O AuthService já tem responsabilidades demais (login, register, verify,
 *   refresh, logout, helpers de hash). Extrair a lógica de token deixa cada
 *   classe com um motivo para mudar.
 * - Facilita trocar a biblioteca de JWT (ex: jose) sem tocar no AuthService.
 * - Torna os testes do AuthService mais simples: mocka o TokenService inteiro.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Emite um par de tokens (access + refresh) de forma atômica.
   *
   * O tokenVersion é embutido no refresh JWT para detecção de reuse:
   * se um atacante roubar o refresh token e rotacioná-lo antes do usuário
   * legítimo, a versão no banco será maior que a do JWT antigo — rejeitado
   * imediatamente sem precisar de bcrypt.compare (que é lento por design).
   *
   * @param payload  Dados do usuário para o access token
   * @param tokenVersion  Versão atual + 1 (incrementada a cada rotação)
   */
  async issueTokenPair(
    payload: JwtPayload,
    tokenVersion: number,
  ): Promise<IssuedTokens> {
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    ) as StringValue;

    const refreshPayload: RefreshPayload = {
      ...payload,
      tokenUse: 'refresh',
      tokenVersion,
    };

    const [access_token, refresh_token] = await Promise.all([
      // Access token: usa secret/expiresIn do JwtModule (configurado no AuthModule)
      this.jwtService.signAsync({ ...payload, tokenUse: 'access' }),
      // Refresh token: secret e expiração separados — nunca reutiliza o mesmo secret
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    this.logger.debug(
      `Token pair issued for ${payload.identifier} (${payload.role}) — version ${tokenVersion}`,
    );

    return { access_token, refresh_token };
  }

  /**
   * Verifica e decodifica um refresh token.
   *
   * Usa o JWT_REFRESH_SECRET (diferente do access secret) para garantir que
   * um access token nunca possa ser usado como refresh token e vice-versa.
   *
   * Lança UnauthorizedException em vez de deixar o erro borbulhar bruto,
   * para que o controller receba sempre a mesma exceção tipada.
   */
  async verifyRefreshToken(rawToken: string): Promise<RefreshPayload> {
    const secret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    try {
      return await this.jwtService.verifyAsync<RefreshPayload>(rawToken, { secret });
    } catch (err) {
      this.logger.warn(`Refresh token verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.REFRESH_TOKEN_INVALID);
    }
  }
}