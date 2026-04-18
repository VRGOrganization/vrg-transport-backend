import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PhotoType } from '../../image/types/photoType.enum';

export enum LicenseRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  WAITLISTED = 'waitlisted',
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

  @Prop({ type: [{ photoType: String, dataUrl: String }], default: [] })
  pendingImages: { photoType: string; dataUrl: string }[];

  @Prop({
    type: [String],
    enum: Object.values(PhotoType),
    default: [],
  })
  changedDocuments: PhotoType[];

  @Prop({ type: String, default: null })
  enrollmentPeriodId: string | null;

  @Prop({ type: Number, default: null })
  filaPosition: number | null;

  // Ônibus determinado na inscrição. Imutável após criação.
  @Prop({ type: Types.ObjectId, ref: 'Bus', default: null })
  busId: Types.ObjectId | null;

  // Snapshot da universidade do aluno na inscrição.
  @Prop({ type: Types.ObjectId, ref: 'University', default: null })
  universityId: Types.ObjectId | null;

  createdAt?: Date;

  updatedAt?: Date;
}

export const LicenseRequestSchema =
  SchemaFactory.createForClass(LicenseRequest);

LicenseRequestSchema.index({ studentId: 1 });
LicenseRequestSchema.index({ status: 1 });
LicenseRequestSchema.index({ enrollmentPeriodId: 1, status: 1, createdAt: 1 });
