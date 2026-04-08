import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PhotoType } from '../../image/types/photoType.enum';

export enum LicenseRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export type LicenseRequestDocument = LicenseRequest & Document;

@Schema({ timestamps: true, collection: 'license_requests' })
export class LicenseRequest {
  @Prop({ required: true })
  studentId: string;

  @Prop({
    type: String,
    enum: ['initial', 'update'],
    default: 'initial',
    required: true,
  })
  type: string;

  @Prop({
    required: true,
    enum: Object.values(LicenseRequestStatus),
    default: LicenseRequestStatus.PENDING,
  })
  status: LicenseRequestStatus;

  @Prop({ type: String, default: null })
  rejectionReason: string | null;

  @Prop({ type: String, default: null })
  cancellationReason: string | null;

  @Prop({ type: Date, default: null })
  rejectedAt: Date | null;

  @Prop({ type: String, default: null })
  approvedByEmployeeId: string | null;

  @Prop({ type: String, default: null })
  rejectedByEmployeeId: string | null;

  @Prop({ type: String, default: null })
  licenseId: string | null;

  @Prop({
    type: [String],
    enum: Object.values(PhotoType),
    default: [],
  })
  changedDocuments: PhotoType[];
}

export const LicenseRequestSchema =
  SchemaFactory.createForClass(LicenseRequest);

LicenseRequestSchema.index({ studentId: 1 });
LicenseRequestSchema.index({ status: 1 });
