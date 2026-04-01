/*
    Decorator para marcar rotas como públicas, ou seja, que não requerem autenticação.
*/

import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/auth.constants';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);