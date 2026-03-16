import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { requestContext, RequestContextStore } from './request-context';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const headerValue = req.headers['x-correlation-id'];
    let correlationId: string | undefined;

    if (Array.isArray(headerValue)) {
      correlationId = headerValue[0];
    } else if (typeof headerValue === 'string' && headerValue.trim() !== '') {
      correlationId = headerValue;
    }

    if (!correlationId) {
      correlationId = randomUUID();
    }

    res.setHeader('x-correlation-id', correlationId);

    const store: RequestContextStore = {
      correlationId,
      startTime: Date.now(),
      method: req.method,
      path: req.originalUrl ?? req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      logs: [],
    };

    requestContext.run(store, () => next());
  }
}
