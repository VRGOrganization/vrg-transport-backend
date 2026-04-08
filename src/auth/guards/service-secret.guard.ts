import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Protege endpoints de session management (create, validate, revoke).
 * Apenas o BFF (Next.js server-side) pode chamar esses endpoints.
 *
 * O BFF envia o header: x-service-secret: <SERVICE_SECRET do .env>
 * Nunca exposto ao browser.
 *
 * IMPORTANTE: Em produção no Render, ambos (Next.js e NestJS) têm a mesma
 * env var SERVICE_SECRET configurada no dashboard.
 */
@Injectable()
export class ServiceSecretGuard implements CanActivate {
  private readonly secret: string;

  constructor(private readonly config: ConfigService) {
    const s = this.config.get<string>('SERVICE_SECRET');
    if (!s) throw new Error('SERVICE_SECRET não definido no ambiente.');
    this.secret = s;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-service-secret'];

    if (!provided || typeof provided !== 'string') {
      throw new UnauthorizedException('Acesso negado.');
    }

    // Comparação em tempo constante para evitar timing attacks
    if (!this.timingSafeEqual(provided, this.secret)) {
      throw new UnauthorizedException('Acesso negado.');
    }

    return true;
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
      mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
  }
}