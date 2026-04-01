/*
  Decorator para obter o usuário autenticado a partir do request. 
  Pode ser usado para obter o usuário inteiro ou um campo específico do usuário.
*/

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/auth.interface';

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;
    if (!user) return null;
    return field ? user[field] : user;
  },
);
