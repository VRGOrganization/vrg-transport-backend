import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { TraceExceptionFilter } from './trace-exception.filter';
import { TraceInterceptor } from './trace.interceptor';
import { TraceService } from './trace.service';
import {
  RequestTrace,
  RequestTraceSchema,
} from './schemas/request-trace.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RequestTrace.name, schema: RequestTraceSchema },
    ]),
  ],
  providers: [
    TraceService,
    CorrelationIdMiddleware,
    {
      provide: APP_INTERCEPTOR,
      useClass: TraceInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: TraceExceptionFilter,
    },
  ],
  exports: [TraceService, CorrelationIdMiddleware],
})
export class TracingModule {}
