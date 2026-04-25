import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SessionService } from '../session/session.service';
import { SessionPayload } from '../session/session-store.interface';
import { UserRole } from '../../common/interfaces/user-roles.enum';
import type { AuthenticatedUser } from '../interfaces/auth.interface';
import { IS_PUBLIC_KEY } from '../constants/auth.constants';

// Extensão do tipo Request para carregar o usuário da sessão
declare module 'express' {
  interface Request {
    sessionPayload?: SessionPayload;
    user?: AuthenticatedUser;
  }
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Rotas marcadas com @Public() passam sem auth
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = this.extractSessionId(request);

    if (!sessionId) {
      throw new UnauthorizedException('Sessão não encontrada.');
    }

    const session = await this.sessionService.validateSession(sessionId);

    if (!session) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    // Injeta payload na request para os controllers usarem
    request.sessionPayload = session;
    request.user = {
      id: session.userId,
      role: session.userType as UserRole,
      identifier: session.userId,
      name: session.userId,
    };

    return true;
  }

  /**
   * Extrai o sessionId do header x-session-id.
   *
   * O BFF (Next.js) nunca expõe esse header ao browser.
   * Ele lê o cookie httpOnly "sid" e passa como header server-to-server.
   *
   * Isso significa que o browser nunca vê o sessionId — só o BFF.
   */
  private extractSessionId(request: Request): string | null {
    const sessionId = request.headers['x-session-id'];
    if (!sessionId || typeof sessionId !== 'string') return null;
    return sessionId;
  }
}