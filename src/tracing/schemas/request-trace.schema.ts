import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RequestTraceDocument = RequestTrace & Document;

@Schema({ _id: false })
export class RequestTraceLog {
  @Prop({ required: true })
  timestamp: Date;

  @Prop({ required: true })
  level: string;

  @Prop({ required: true })
  layer: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object })
  extra?: Record<string, unknown>;
}

export const RequestTraceLogSchema = SchemaFactory.createForClass(RequestTraceLog);

@Schema({ _id: false })
export class RequestTraceError {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  message: string;

  @Prop()
  stack?: string;

  @Prop()
  statusCode?: number;

  @Prop({ type: Object })
  details?: Record<string, unknown>;
}

export const RequestTraceErrorSchema =
  SchemaFactory.createForClass(RequestTraceError);

@Schema({ timestamps: true, collection: 'request_traces' })
export class RequestTrace {
  @Prop({ required: true })
  correlationId: string;

  @Prop()
  method?: string;

  @Prop()
  path?: string;

  @Prop()
  ip?: string;

  @Prop()
  userAgent?: string;

  @Prop()
  userId?: string;

  @Prop()
  statusCode?: number;

  @Prop()
  durationMs?: number;

  @Prop({ type: [RequestTraceLogSchema], default: [] })
  logs: RequestTraceLog[];

  @Prop({ type: RequestTraceErrorSchema })
  error?: RequestTraceError;
}

export const RequestTraceSchema = SchemaFactory.createForClass(RequestTrace);

RequestTraceSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 },
);
