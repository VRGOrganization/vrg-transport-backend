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

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`[${request.method}] ${request.url} → ${status}: ${message}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
