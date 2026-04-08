import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UserType } from './session.schema';
import { SESSION_STORE } from './session-store.interface';
import type {
  CreateSessionDto,
  ISessionStore,
  SessionPayload,
} from './session-store.interface';

@Injectable()
export class SessionService {
  private readonly sessionTtlMs: number;

  constructor(
    @Inject(SESSION_STORE) private readonly store: ISessionStore,
    private readonly config: ConfigService,
  ) {
    // SESSION_TTL_DAYS padrão: 7 dias — mesmo tempo do refresh token atual
    const days = this.config.get<number>('SESSION_TTL_DAYS') ?? 7;
    this.sessionTtlMs = days * 24 * 60 * 60 * 1000;
  }

  /**
   * Cria sessão para um usuário autenticado.
   * Chamado após login/verify-email bem sucedidos.
   */
  async createSession(
    userId: string,
    userType: UserType,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<SessionPayload> {
    const expiresAt = new Date(Date.now() + this.sessionTtlMs);

    const dto: CreateSessionDto = {
      userId,
      userType,
      expiresAt,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
    };

    return this.store.create(dto);
  }

  /**
   * Valida um sessionId (vem do cookie "sid" do BFF).
   * Retorna o payload se válida, null caso contrário.
   */
  async validateSession(sessionId: string): Promise<SessionPayload | null> {
    const session = await this.store.findById(sessionId);
    if (!session) return null;

    // Touch assíncrono — não bloqueia a resposta
    void this.store.touch(sessionId);

    return session;
  }

  /**
   * Revoga sessão específica (logout de um device).
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.store.revoke(sessionId);
  }

  /**
   * Revoga todas as sessões do usuário (logout global / troca de senha).
   */
  async revokeAllSessions(userId: string, userType: UserType): Promise<void> {
    await this.store.revokeAllForUser(userId, userType);
  }

  /**
   * Lista sessões ativas (para UI de "dispositivos conectados" futuramente).
   */
  async listActiveSessions(userId: string, userType: UserType): Promise<SessionPayload[]> {
    return this.store.listActiveForUser(userId, userType);
  }
}