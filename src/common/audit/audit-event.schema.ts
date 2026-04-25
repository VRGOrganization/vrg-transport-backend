import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditEventDocument = AuditEvent & Document;

@Schema({
  timestamps: true,
  collection: 'audit_events',
})
export class AuditEvent {
  @Prop({ required: true })
  action: string;

  @Prop({ required: true, enum: ['success', 'failure'] })
  outcome: 'success' | 'failure';

  @Prop({ type: Object, default: null })
  actor?: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  target?: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  metadata?: Record<string, unknown> | null;
}

export const AuditEventSchema = SchemaFactory.createForClass(AuditEvent);
