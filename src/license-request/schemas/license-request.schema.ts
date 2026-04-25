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

export enum LicenseRequestType {
  INITIAL = 'initial',
  UPDATE = 'update',
}

export type LicenseRequestDocument = LicenseRequest & Document;

@Schema({ timestamps: true, collection: 'license_requests' })
export class LicenseRequest {
  @Prop({ required: true })
  studentId: string;

  @Prop({
    type: String,
    enum: Object.values(LicenseRequestType),
    default: LicenseRequestType.INITIAL,
    required: true,
  })
  type: LicenseRequestType;

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

  // Ônibus definitivo definido somente na aprovação.
  @Prop({ type: Types.ObjectId, ref: 'Bus', default: null })
  busId: Types.ObjectId | null;

  // Snapshot da universidade do aluno na inscrição.
  @Prop({ type: Types.ObjectId, ref: 'University', default: null })
  universityId: Types.ObjectId | null;

  // Anota??o para a carteirinha.
  @Prop({ type: String, default: null })
  cardNote: string | null;

  // Ônibus elegíveis para esta solicitação antes da aprovação.
  @Prop({ type: [String], default: [] })
  accessBusIdentifiers: string[];

  createdAt?: Date;

  updatedAt?: Date;
}

export const LicenseRequestSchema =
  SchemaFactory.createForClass(LicenseRequest);

LicenseRequestSchema.index({ studentId: 1 });
LicenseRequestSchema.index(
  { studentId: 1, type: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [LicenseRequestStatus.PENDING, LicenseRequestStatus.WAITLISTED] },
    },
  },
);
LicenseRequestSchema.index({ status: 1 });
LicenseRequestSchema.index({ enrollmentPeriodId: 1, status: 1, createdAt: 1 });
// Index para buscas/contagem por período + ônibus + status (eficiente para filas por ônibus)
LicenseRequestSchema.index({ enrollmentPeriodId: 1, busId: 1, status: 1, createdAt: 1 });
