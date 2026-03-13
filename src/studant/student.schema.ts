import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StudentDocument = HydratedDocument<Student>;

@Schema({ timestamps: true })
export class Student {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  degree: string;

  @Prop({ required: true })
  institution: string;

  @Prop({ 
    required: true,
    enum: ['Matutino', 'Vespertino', 'Noturno', 'Integral'] // ADICIONADO
  })
  shift: string;

  @Prop({ required: true })
  telephone: string;

  @Prop({ 
    required: true,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] // ADICIONADO
  })
  blood_type: string;
}

export const StudentSchema = SchemaFactory.createForClass(Student);