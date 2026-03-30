import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BloodType, Shift } from '../../common/interfaces/student-attributes.enum';

export type StudentDocument = HydratedDocument<Student>;

export enum StudentStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
}

@Schema({ timestamps: true, collection: 'students' })
export class Student {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: false, trim: true })
  degree: string;

  @Prop({ required: false, trim: true, enum: Object.values(Shift) })
  shift: Shift;

  @Prop({ required: true, trim: true })
  telephone: string;

  @Prop({ required: false, trim: true, enum: Object.values(BloodType) })
  bloodType: BloodType;

  @Prop({ required: false, trim: true })
  bus: string;

  @Prop({ required: false, type: String, default: null })
  photo: string | null;

  @Prop({
    type: String,
    enum: Object.values(StudentStatus),
    default: StudentStatus.PENDING,
  })
  status: StudentStatus;

  @Prop({ default: false })
  isInstitutionalEmail: boolean;

  @Prop({ type: String, default: null, select: false })
  verificationCode: string | null;

  @Prop({ type: Date, default: null, select: false })
  verificationCodeExpiresAt: Date | null;

  @Prop({ type: Number, default: 0, select: false })
  verificationCodeAttempts: number;

  @Prop({ type: Date, default: null, select: false })
  verificationCodeLockedUntil: Date | null;

  @Prop({ type: Date, default: null, select: false })
  verificationCodeLastSentAt: Date | null;

  @Prop({ type: String, default: null, select: false })
  refreshTokenHash: string | null;

  @Prop({ type: Number, default: 0, select: false })
  refreshTokenVersion: number;

  @Prop({ default: true })
  active: boolean;
}

export const StudentSchema = SchemaFactory.createForClass(Student);
StudentSchema.index({ name: 1 });

// Remove password e campos sensíveis de qualquer serialização JSON
StudentSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.password;
    delete ret.verificationCode;
    delete ret.verificationCodeExpiresAt;
    delete ret.verificationCodeAttempts;
    delete ret.verificationCodeLockedUntil;
    delete ret.verificationCodeLastSentAt;
    delete ret.refreshTokenHash;
    delete ret.refreshTokenVersion;
    return ret;
  },
});
