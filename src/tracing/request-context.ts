import { AsyncLocalStorage } from 'async_hooks';

export type TraceLogLevel = 'info' | 'warn' | 'error';

export interface RequestTraceLogEntry {
  timestamp: Date;
  level: TraceLogLevel;
  layer: string;
  message: string;
  extra?: Record<string, unknown>;
}

export interface RequestTraceErrorInfo {
  name: string;
  message: string;
  stack?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

export interface RequestContextStore {
  correlationId: string;
  startTime: number;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  statusCode?: number;
  logs: RequestTraceLogEntry[];
  error?: RequestTraceErrorInfo;
  finalized?: boolean;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();
