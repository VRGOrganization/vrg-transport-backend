import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EnrollmentPeriodDocument = EnrollmentPeriod & Document;

@Schema({ timestamps: true, collection: 'enrollment_periods' })
export class EnrollmentPeriod {
  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({ type: Number, required: true, min: 1 })
  totalSlots: number;

  @Prop({ type: Number, default: 0, min: 0 })
  filledSlots: number;

  @Prop({ type: Number, default: 0, min: 0 })
  waitlistSequence: number;

  @Prop({ type: Number, default: 0, min: 0 })
  closedWaitlistCount: number;

  @Prop({ type: Date, default: null })
  waitlistClosedAt: Date | null;

  @Prop({ type: Number, required: true, min: 1 })
  licenseValidityMonths: number;

  @Prop({ type: Boolean, default: true })
  active: boolean;

  @Prop({ type: String, required: true })
  createdByAdminId: string;

  @Prop({ type: String, default: null })
  closedByAdminId: string | null;

  @Prop({ type: Date, default: null })
  closedAt: Date | null;
}

export const EnrollmentPeriodSchema =
  SchemaFactory.createForClass(EnrollmentPeriod);

EnrollmentPeriodSchema.index(
  { active: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
