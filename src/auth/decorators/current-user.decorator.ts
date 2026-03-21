import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/auth.interface';

/**
 * Injeta o usuário autenticado no parâmetro da rota.
 *
 * Uso básico — retorna o objeto completo:
 *   @CurrentUser() user: AuthenticatedUser
 *
 * Uso com campo específico — retorna só aquele campo:
 *   @CurrentUser('id')   id: string
 *   @CurrentUser('role') role: UserRole
 *
 * Requer que a rota esteja protegida pelo JwtAuthGuard
 * (global via APP_GUARD no AppModule ou explícito com @UseGuards).
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) return null;

    return field ? user[field] : user;
  },
);
