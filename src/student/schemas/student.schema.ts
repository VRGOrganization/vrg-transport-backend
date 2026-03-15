import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StudentDocument = HydratedDocument<Student>;

@Schema({ timestamps: true, collection: 'students' })
export class Student {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  degree: string;

  @Prop({ required: true })
  shift: string;

  @Prop({ required: true })
  telephone: string;

  @Prop({ required: true })
  bloodType: string;

  @Prop({ required: true })
  buss: string;

  @Prop({ type: String, default: null })
  photo: string | null;

  @Prop({ default: true })
  active: boolean;
}

export const StudentSchema = SchemaFactory.createForClass(Student);

// Índices para melhor performance
StudentSchema.index({ name: 1 });