import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LicenseDocument = License & Document;

@Schema({ timestamps: true })
export class License {

  @Prop({ required: true })
  studentId: string;

  @Prop({ required: true })
  employeeId: string;

  @Prop({ required: true })
  imageLicense: string;

  @Prop({ required: true, enum: ['active', 'inactive', 'expired'], default: 'active' })
  status: string;

  @Prop({ default: true })
  existing: boolean;

  @Prop({ required: true })
  expirationDate: Date;
}

export const LicenseSchema = SchemaFactory.createForClass(License);