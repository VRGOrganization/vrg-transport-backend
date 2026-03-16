import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { TraceService } from './trace.service';
import { requestContext } from './request-context';

@Injectable()
export class TraceInterceptor implements NestInterceptor {
  constructor(private readonly traceService: TraceService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const response = http.getResponse();
    const request = http.getRequest();
    const store = requestContext.getStore();

    this.traceService.addLog('info', 'Request', 'start', {
      method: request?.method,
      path: request?.originalUrl ?? request?.url,
    });

    return next.handle().pipe(
      finalize(() => {
        const statusCode = response?.statusCode;
        const durationMs = store ? Date.now() - store.startTime : undefined;

        this.traceService.addLog('info', 'Request', 'end', {
          statusCode,
          durationMs,
        });
      }),
    );
  }
}
