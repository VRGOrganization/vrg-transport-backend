/**
 * RedisSessionStore — pronto para uso quando você adicionar Redis.
 *
 * HOW TO ACTIVATE:
 * 1. yarn add ioredis
 * 2. Adicione REDIS_URL no .env
 * 3. No SessionModule, troque o provider SESSION_STORE de MongoSessionStore
 *    para RedisSessionStore (uma linha de config).
 *
 * O resto do sistema (SessionService, guards, BFF) não muda nada.
 */

import { Injectable, Inject } from '@nestjs/common';
import { UserType } from './session.schema';
import {
  CreateSessionDto,
  ISessionStore,
  SessionPayload,
} from './session-store.interface';

// Tipo mínimo para não forçar instalação do ioredis agora
type RedisClient = {
  set(key: string, value: string, exArg: 'EX', seconds: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(...keys: string[]): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  sadd(key: string, ...members: string[]): Promise<unknown>;
  srem(key: string, ...members: string[]): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
};

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Injectable()
export class RedisSessionStore implements ISessionStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  // Prefixos de chave
  private sessionKey(id: string) { return `session:${id}`; }
  private userSetKey(userId: string, userType: string) {
    return `user_sessions:${userType}:${userId}`;
  }

  async create(dto: CreateSessionDto): Promise<SessionPayload> {
    // Gera ID compatível com ObjectId hex (24 chars) para uniformidade
    const sessionId = this.generateId();
    const now = new Date();
    const ttlSeconds = Math.floor((dto.expiresAt.getTime() - now.getTime()) / 1000);

    const payload: SessionPayload = {
      sessionId,
      userId: dto.userId,
      userType: dto.userType,
      expiresAt: dto.expiresAt,
      lastSeenAt: now,
      revoked: false,
    };

    // Persiste sessão com TTL automático
    await this.redis.set(
      this.sessionKey(sessionId),
      JSON.stringify(payload),
      'EX',
      ttlSeconds,
    );

    // Mantém set de sessões por usuário para revokeAllForUser
    const setKey = this.userSetKey(dto.userId, dto.userType);
    await this.redis.sadd(setKey, sessionId);
    await this.redis.expire(setKey, ttlSeconds);

    return payload;
  }

  async findById(sessionId: string): Promise<SessionPayload | null> {
    const raw = await this.redis.get(this.sessionKey(sessionId));
    if (!raw) return null;

    const payload: SessionPayload = JSON.parse(raw);
    if (payload.revoked) return null;
    if (new Date(payload.expiresAt) <= new Date()) return null;

    return { ...payload, expiresAt: new Date(payload.expiresAt), lastSeenAt: new Date(payload.lastSeenAt) };
  }

  async touch(sessionId: string): Promise<void> {
    const raw = await this.redis.get(this.sessionKey(sessionId));
    if (!raw) return;

    const payload: SessionPayload = JSON.parse(raw);
    payload.lastSeenAt = new Date();

    const ttlSeconds = Math.max(
      0,
      Math.floor((new Date(payload.expiresAt).getTime() - Date.now()) / 1000),
    );
    await this.redis.set(this.sessionKey(sessionId), JSON.stringify(payload), 'EX', ttlSeconds);
  }

  async revoke(sessionId: string): Promise<void> {
    const raw = await this.redis.get(this.sessionKey(sessionId));
    if (!raw) return;

    const payload: SessionPayload = JSON.parse(raw);
    payload.revoked = true;
    // Mantém por mais 60s para logging, depois o TTL original limpa
    await this.redis.set(this.sessionKey(sessionId), JSON.stringify(payload), 'EX', 60);
  }

  async revokeAllForUser(userId: string, userType: UserType): Promise<void> {
    const ids = await this.redis.smembers(this.userSetKey(userId, userType));
    await Promise.all(ids.map((id) => this.revoke(id)));
  }

  async listActiveForUser(userId: string, userType: UserType): Promise<SessionPayload[]> {
    const ids = await this.redis.smembers(this.userSetKey(userId, userType));
    const results = await Promise.all(ids.map((id) => this.findById(id)));
    return results.filter((s): s is SessionPayload => s !== null);
  }

  private generateId(): string {
    // Gera 12 bytes aleatórios → 24 hex chars (mesmo formato que ObjectId)
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    return Array.from(array).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}