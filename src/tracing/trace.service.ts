import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  RequestTraceErrorInfo,
  RequestTraceLogEntry,
  requestContext,
} from './request-context';
import {
  RequestTrace,
  RequestTraceDocument,
} from './schemas/request-trace.schema';

@Injectable()
export class TraceService {
  private readonly logger = new Logger(TraceService.name);

  constructor(
    @InjectModel(RequestTrace.name)
    private readonly requestTraceModel: Model<RequestTraceDocument>,
  ) {}

  addLog(
    level: RequestTraceLogEntry['level'],
    layer: string,
    message: string,
    extra?: Record<string, unknown>,
  ) {
    const store = requestContext.getStore();
    if (!store) {
      return;
    }

    store.logs.push({
      timestamp: new Date(),
      level,
      layer,
      message,
      extra,
    });
  }

  setError(
    error: unknown,
    statusCode?: number,
    details?: Record<string, unknown>,
  ) {
    const store = requestContext.getStore();
    if (!store) {
      return;
    }

    const errorInfo: RequestTraceErrorInfo = {
      name: 'Error',
      message: 'Unknown error',
      statusCode,
    };

    if (error instanceof Error) {
      errorInfo.name = error.name;
      errorInfo.message = error.message;
      errorInfo.stack = error.stack;
    } else if (typeof error === 'string') {
      errorInfo.message = error;
    }

    if (details) {
      errorInfo.details = details;
    }

    store.error = errorInfo;
    store.statusCode = statusCode ?? store.statusCode;
  }

  async finalize(statusCode?: number) {
    const store = requestContext.getStore();
    if (!store) {
      return;
    }

    if (store.finalized) {
      return;
    }

    if (typeof statusCode === 'number') {
      store.statusCode = statusCode;
    }

    const shouldPersist =
      !!store.error ||
      (typeof store.statusCode === 'number' && store.statusCode >= 400);

    if (!shouldPersist) {
      return;
    }

    store.finalized = true;
    const durationMs = Date.now() - store.startTime;

    try {
      await this.requestTraceModel.create({
        correlationId: store.correlationId,
        method: store.method,
        path: store.path,
        ip: store.ip,
        userAgent: store.userAgent,
        userId: store.userId,
        statusCode: store.statusCode,
        durationMs,
        logs: store.logs,
        error: store.error,
      });
    } catch (_error) {
      this.logger.error('Failed to persist request trace', _error as Error);
    }
  }
}
