import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EnrollmentPeriodDocument = EnrollmentPeriod & Document;

@Schema({ timestamps: true, collection: 'enrollment_periods' })
export class EnrollmentPeriod {
  @Prop({ type: Date, required: true })
  dataInicio: Date;

  @Prop({ type: Date, required: true })
  dataFim: Date;

  @Prop({ type: Number, required: true, min: 1 })
  qtdVagasTotais: number;

  @Prop({ type: Number, default: 0, min: 0 })
  qtdVagasPreenchidas: number;

  @Prop({ type: Number, default: 0, min: 0 })
  waitlistSequence: number;

  @Prop({ type: Number, default: 0, min: 0 })
  qtdFilaEncerrada: number;

  @Prop({ type: Date, default: null })
  filaEncerradaEm: Date | null;

  @Prop({ type: Number, required: true, min: 1 })
  validadeCarteirinhaMeses: number;

  @Prop({ type: Boolean, default: true })
  ativo: boolean;

  @Prop({ type: String, required: true })
  criadoPorAdminId: string;

  @Prop({ type: String, default: null })
  encerradoPorAdminId: string | null;

  @Prop({ type: Date, default: null })
  encerradoEm: Date | null;
}

export const EnrollmentPeriodSchema =
  SchemaFactory.createForClass(EnrollmentPeriod);

EnrollmentPeriodSchema.index(
  { ativo: 1 },
  { unique: true, partialFilterExpression: { ativo: true } },
);
