import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/auth.constants';

/**
 * Marca uma rota como pública — o SessionAuthGuard deixa passar sem validar sessão.
 *
 * Uso:
 * @Public()
 * @Post('login')
 * async login(...) {}
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);