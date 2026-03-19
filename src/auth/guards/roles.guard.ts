import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../constants/auth.constants';
import { AUTH_ERROR_MESSAGES } from '../constants/auth.constants';
import { UserRole } from 'src/common/interfaces/user-roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.error('Usuário não encontrado na requisição');
      throw new ForbiddenException(AUTH_ERROR_MESSAGES.FORBIDDEN);
    }

    const hasRole = requiredRoles.some((role) => user.role === role);
    
    if (!hasRole) {
      this.logger.warn(`Usuário ${user.email} com função ${user.role} tentou acessar rota que requer as funções: ${requiredRoles.join(', ')}`);
      throw new ForbiddenException(AUTH_ERROR_MESSAGES.FORBIDDEN);
    }

    return true;
  }
}