/*
  Roles Guard eh responsavel por verificar se o usuario tem a role necessaria para acessar determinada rota.
  Ele depende do user injetado no request pelo SessionAuthGuard.
  Se o usuario nao tiver a role necessaria, retorna ForbiddenException.
*/

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AUTH_ERROR_MESSAGES, IS_PUBLIC_KEY } from '../constants/auth.constants';
import { UserRole } from '../../common/interfaces/user-roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.error(
        'User not found in request context. Ensure SessionAuthGuard is applied before RolesGuard.',
      );
      throw new ForbiddenException(AUTH_ERROR_MESSAGES.FORBIDDEN);
    }

    const hasRole = requiredRoles.includes(user.role as UserRole);

    if (!hasRole) {
      this.logger.warn(
        `User ${user.identifier} with role ${user.role} attempted to access route requiring roles: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException(AUTH_ERROR_MESSAGES.FORBIDDEN);
    }

    return true;
  }
}