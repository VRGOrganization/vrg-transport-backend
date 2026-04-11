import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EmployeeDocument = HydratedDocument<Employee>;

@Schema({ timestamps: true, collection: 'employees' })
export class Employee {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, unique: true, trim: true })
  registrationId: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ default: true })
  active: boolean;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);

EmployeeSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.password;
    return ret;
  },
});