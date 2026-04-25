import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  RateLimit,
  RateLimitOptions,
  SKIP_RATE_LIMIT_KEY,
} from '../decorators/rate-limit.decorator';

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  private readonly buckets = new Map<string, Bucket>();

  // 🔧 Controle de limpeza (evita loop pesado a cada request)
  private lastCleanupAt = 0;
  private readonly cleanupIntervalMs = 60_000; // 1 minuto

  canActivate(context: ExecutionContext): boolean {
    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipRateLimit) return true;

    const limit = this.reflector.getAllAndOverride<
      RateLimitOptions | undefined
    >(RateLimit, [context.getHandler(), context.getClass()]);

    if (!limit) return true;

    const request = context.switchToHttp().getRequest<Request>();

    const ip = this.extractIp(request);
    const route = `${context.getClass().name}:${context.getHandler().name}`;
    const key = `${limit.keyPrefix ?? route}:${ip}`;

    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + limit.windowMs,
      });

      this.cleanup(now);
      return true;
    }

    bucket.count++;

    if (bucket.count > limit.points) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);

      throw new HttpException(
        `You have exceeded the maximum of ${limit.points} requests. Try again in ${retryAfter} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.cleanup(now);
    return true;
  }

  /**
   * 🔒 Extrai IP de forma SEGURA
   *
   * NÃO usa X-Forwarded-For manualmente.
   * Depende do Express com:
   *
   * app.set('trust proxy', N)
   *
   * Assim o request.ip já vem correto e validado.
   */
  private extractIp(request: Request): string {
    const userId = (request as any).sessionPayload?.userId;
    if (userId) {
      return `user:${userId}`;
    }

    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';

    if (!this.isValidIp(ip)) {
      return 'invalid';
    }

    return `ip:${ip}`;
  }

  private isValidIp(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  private cleanup(now: number): void {
    if (now - this.lastCleanupAt < this.cleanupIntervalMs) return;

    this.lastCleanupAt = now;

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
