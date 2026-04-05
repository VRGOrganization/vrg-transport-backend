/*
  JwtAuthGuard é responsavel por verificar se o usuario esta autenticado, ou seja, se ele possui um token valido.
  Ele deve ser aplicado antes do RolesGuard, pois ele garante que o usuario esteja presente no request,
  o que eh necessario para o RolesGuard funcionar corretamente. 
  Se o token for invalido ou expirado, ele retorna um UnauthorizedException.
*/

import { 
  Injectable, 
  ExecutionContext, 
  UnauthorizedException,
  Logger 
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../constants/auth.constants';
import { AUTH_ERROR_MESSAGES } from '../constants/auth.constants';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      // log de autenticação falhou com detalhes do erro, ?? para garantir que sempre haja uma mensagem
      this.logger.warn(
        `Authentication failed: ${info?.message ?? err?.message ?? 'unknown error'}`
      );
      
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token expired');
      }
      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }
      
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
    }
    
    return user;
  }
}