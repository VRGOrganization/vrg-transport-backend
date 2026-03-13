import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class License {

  @Prop()
  studentId: string;

  @Prop()
  employeeId: string;

  @Prop()
  imageLicense: string;

  @Prop()
  status: string;

  @Prop()
  existing: boolean;

  @Prop()
  expirationDate: Date;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const LicenseSchema = SchemaFactory.createForClass(License);
