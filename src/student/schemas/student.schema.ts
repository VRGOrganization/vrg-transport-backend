import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
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

  @Prop({ required: true, unique: true, select: false })
  cpfHash: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: false, trim: true })
  degree: string;

  @Prop({ type: String, required: false, trim: true, enum: Object.values(Shift) })
  shift: Shift;

  @Prop({ required: true, trim: true })
  telephone: string;

  @Prop({ type: String, required: false, trim: true, enum: Object.values(BloodType) })
  bloodType: BloodType;


  // Referência à universidade (ObjectId). Preenchido na inscrição.
  @Prop({ type: Types.ObjectId, ref: 'University', required: false })
  universityId: Types.ObjectId;

  // Nome da instituição para exibição/carteirinha.
  @Prop({ required: false, trim: true })
  institution: string;

  // Ônibus secundário para alunos Integral (opcional).
  @Prop({ type: Types.ObjectId, ref: 'Bus', default: null })
  secondaryBusId: Types.ObjectId | null;

  @Prop({ required: false, type: String, default: null })
  photo: string | null;

  @Prop({ type: [{ day: String, period: String }], default: [] })
  schedule: { day: string; period: string }[];

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

  @Prop({ default: false })
  hasCompletedInitialEnrollment: boolean;

  @Prop({ default: true })
  active: boolean;
}

export const StudentSchema = SchemaFactory.createForClass(Student);
StudentSchema.index({ name: 1 });

// Remove password e campos sensíveis de qualquer serialização JSON
StudentSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    delete ret.cpfHash;
    delete ret.password;
    delete ret.verificationCode;
    delete ret.verificationCodeExpiresAt;
    delete ret.verificationCodeAttempts;
    delete ret.verificationCodeLockedUntil;
    delete ret.verificationCodeLastSentAt;
    return ret;
  },
});
