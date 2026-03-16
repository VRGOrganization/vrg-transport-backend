import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { HttpAdapterHost } from '@nestjs/core';
import { requestContext } from './request-context';
import { TraceService } from './trace.service';

@Catch()
export class TraceExceptionFilter extends BaseExceptionFilter {
  constructor(
    private readonly traceService: TraceService,
    httpAdapterHost: HttpAdapterHost,
  ) {
    super(httpAdapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest();
    const store = requestContext.getStore();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode, message: 'Internal server error' };

    if (store) {
      // Isso aqui ta triste de ver
      store.ip = request?.ip ?? store.ip;
      store.userAgent = request?.headers?.['user-agent'] ?? store.userAgent;
      const userId =
        typeof request?.user?.id === 'string'
          ? request.user.id
          : request?.user?.id?.toString?.();
      if (userId) {
        store.userId = userId;
      }
    }

    this.traceService.addLog(
      'error',
      'ExceptionFilter',
      'Unhandled exception',
      {
        statusCode,
        method: request?.method,
        path: request?.originalUrl ?? request?.url,
        response: responseBody,
      },
    );

    if (statusCode >= 400) {
      const details =
        typeof responseBody === 'object' && responseBody !== null
          ? (responseBody as Record<string, unknown>)
          : { response: responseBody };
      this.traceService.setError(exception, statusCode, details);
    }

    void this.traceService.finalize(statusCode).catch(() => undefined);

    super.catch(exception, host);
  }
}
