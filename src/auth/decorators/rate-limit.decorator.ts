import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';

export interface RateLimitOptions {
    points: number; // Número de pontos (requerimentos) permitidos
    windowMs: number; // Janela de tempo em segundos

    /*
        Prefixo da chave do bucket para identificar o tipo de requisição (opcional).
        Por exemplo, 'login' para limitar tentativas de login, 'register' para limitar registros, etc.
        
    */
    keyPrefix?: string; // Prefixo para a chave de armazenamento (opcional)
}

/**
 * Aplica rate limiting a uma rota ou controlador usando express-rate-limit.
 * @example
 * @RateLimit({ points: 5, windowMs: 60 * 1000, keyPrefix: 'login' }) // Limita a 5 requisições por minuto para a rota de login
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    // Lógica de login aqui
  }
 * 
 */

export const RateLimit = Reflector.createDecorator<RateLimitOptions>();

/**
 * Ignora o RateLimitGuard global para um endpoint ou controller específico.
 * Útil para health checks, métricas internas e endpoints sem risco de abuso.
 *
 * @example
 * @SkipRateLimit()
 * @Get('health')
 * health() { ... }
 */
export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);