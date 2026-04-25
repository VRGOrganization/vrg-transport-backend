import { UserType } from './session.schema';

// DTO de criação — o que o chamador precisa fornecer
export interface CreateSessionDto {
  userId: string;
  userType: UserType;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
}

// O que a store retorna ao criar/buscar
export interface SessionPayload {
  sessionId: string;      // string do ObjectId — vai virar o "sid" no cookie
  userId: string;
  userType: UserType;
  expiresAt: Date;
  lastSeenAt: Date;
  revoked: boolean;
}

// Contrato da store — qualquer implementação (Mongo, Redis, etc.) deve seguir isso
export interface ISessionStore {
  /**
   * Cria uma nova sessão e retorna o payload completo.
   */
  create(dto: CreateSessionDto): Promise<SessionPayload>;

  /**
   * Busca sessão por ID. Retorna null se não existir, expirada ou revogada.
   */
  findById(sessionId: string): Promise<SessionPayload | null>;

  /**
   * Atualiza lastSeenAt (keep-alive de sessão).
   */
  touch(sessionId: string): Promise<void>;

  /**
   * Revoga uma sessão específica (logout de uma aba/device).
   */
  revoke(sessionId: string): Promise<void>;

  /**
   * Revoga TODAS as sessões de um usuário (logout global / mudança de senha).
   */
  revokeAllForUser(userId: string, userType: UserType): Promise<void>;

  /**
   * Lista sessões ativas de um usuário (para exibir devices logados futuramente).
   */
  listActiveForUser(userId: string, userType: UserType): Promise<SessionPayload[]>;
}

// Token de injeção — usado no @Inject() para desacoplar do concreto
export const SESSION_STORE = Symbol('SESSION_STORE');