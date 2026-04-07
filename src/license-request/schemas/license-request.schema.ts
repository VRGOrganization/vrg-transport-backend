import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum LicenseRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export type LicenseRequestDocument = LicenseRequest & Document;

@Schema({ timestamps: true, collection: 'license_requests' })
export class LicenseRequest {
  @Prop({ required: true })
  studentId: string;

  @Prop({
    required: true,
    enum: Object.values(LicenseRequestStatus),
    default: LicenseRequestStatus.PENDING,
  })
  status: LicenseRequestStatus;

  @Prop({ type: String, default: null })
  rejectionReason: string | null;

  @Prop({ type: Date, default: null })
  rejectedAt: Date | null;

  @Prop({ type: String, default: null })
  approvedByEmployeeId: string | null;

  @Prop({ type: String, default: null })
  rejectedByEmployeeId: string | null;

  @Prop({ type: String, default: null })
  licenseId: string | null;
}

export const LicenseRequestSchema =
  SchemaFactory.createForClass(LicenseRequest);

LicenseRequestSchema.index({ studentId: 1 });
LicenseRequestSchema.index({ status: 1 });
