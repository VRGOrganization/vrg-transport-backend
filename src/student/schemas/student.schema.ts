import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

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
  password: string; // bcrypt hash — nunca retornar ao client

  @Prop({ required: true, trim: true })
  degree: string;

  @Prop({ required: true, trim: true })
  shift: string;

  @Prop({ required: true, trim: true })
  telephone: string;

  @Prop({ required: true, trim: true })
  bloodType: string;

  @Prop({ required: true, trim: true })
  buss: string;

  @Prop({ type: String, default: null })
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
    return ret;
  },
});
