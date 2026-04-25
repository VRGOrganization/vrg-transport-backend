import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserType = 'student' | 'employee' | 'admin';

export type SessionDocument = Session & Document;

@Schema({ collection: 'sessions', timestamps: false })
export class Session {
  // _id gerado pelo Mongo vira o sessionId opaco enviado ao browser como "sid"
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, enum: ['student', 'employee', 'admin'] })
  userType!: UserType;

  // Metadados de contexto (para auditoria futura)
  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  @Prop({ required: true })
  createdAt!: Date;

  @Prop({ required: true })
  expiresAt!: Date;

  // Atualizado a cada uso — útil para sliding expiration futuramente
  @Prop({ required: true })
  lastSeenAt!: Date;

  @Prop({ default: false, index: true })
  revoked!: boolean;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ default: 0 })
  version!: number;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Index composto para queries de "todas as sessões ativas de um usuário"
SessionSchema.index({ userId: 1, userType: 1, revoked: 1 });

// TTL index: Mongo deleta automaticamente documentos expirados
// expiresAt define quando a sessão morre — sem cron job manual
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });