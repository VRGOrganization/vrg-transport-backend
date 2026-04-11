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
  private readonly studentSessionTtlMs: number;
  private readonly staffSessionTtlMs: number;

  constructor(
    @Inject(SESSION_STORE) private readonly store: ISessionStore,
    private readonly config: ConfigService,
  ) {
    const legacyDays = this.config.get<number>('SESSION_TTL_DAYS');
    const studentDays = this.config.get<number>('SESSION_TTL_STUDENT_DAYS') ?? legacyDays ?? 7;
    const staffDays = this.config.get<number>('SESSION_TTL_STAFF_DAYS') ?? legacyDays ?? 7;

    this.studentSessionTtlMs = studentDays * 24 * 60 * 60 * 1000;
    this.staffSessionTtlMs = staffDays * 24 * 60 * 60 * 1000;
  }

  private getSessionTtlMs(userType: UserType): number {
    return userType === 'student' ? this.studentSessionTtlMs : this.staffSessionTtlMs;
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
    const expiresAt = new Date(Date.now() + this.getSessionTtlMs(userType));

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