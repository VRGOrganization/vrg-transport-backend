import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Este filter substitui os try/catch repetidos em cada controller.
// Registrado globalmente no main.ts com app.useGlobalFilters(new HttpExceptionFilter()).
//
// Como funciona:
// - @Catch() sem argumento captura QUALQUER exceção não tratada.
// - Se for HttpException (NotFoundException, BadRequestException etc.),
//   usa o status HTTP dela.
// - Se for erro genérico (Error, falha de fetch etc.), retorna 500.
// - Loga apenas uma vez, aqui — o service não precisa mais de console.error.

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly sensitivePatterns = [
    /(password|secret|token|key|api[_-]?key)["']?\s*[:=]\s*["']?[^"'\s]{8,}/gi,
    /(mongodb:\/\/|postgres:\/\/|mysql:\/\/)[^@\s]+@/gi,
    /[a-z0-9_-]*@[a-z0-9.-]+\.[a-z]{2,}/gi,
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  ];

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      status >= 500
        ? 'Internal server error'
        : exception instanceof HttpException
          ? this.extractHttpMessage(exception)
          : 'Internal server error';

    if (status >= 500) {
      const rawStack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(
        `[${request.method}] ${request.url} → ${status}`,
        this.sanitizeStackTrace(rawStack ?? ''),
      );
    } else {
      this.logger.warn(`[${request.method}] ${request.url} → ${status}: ${message}`);
    }

    const isProduction = process.env.NODE_ENV === 'production';

    const body: Record<string, unknown> = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    }

    // path em producao para evitar expor rotas internas, mas útil em dev para debug
    if(!isProduction){
      body.path = request.url;
    }

    response.status(status).json(body);

  }

  private extractHttpMessage(exception: HttpException): string | string[] {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (response && typeof response === 'object') {
      const body = response as { message?: string | string[] };
      if (body.message) {
        return body.message;
      }
    }

    return exception.message;
  }

  private sanitizeStackTrace(stack: string): string {
    let sanitized = stack;

    for (const pattern of this.sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    return sanitized;
  }
}
