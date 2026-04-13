import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CourseDocument = HydratedDocument<Course>;

@Schema({ timestamps: true, collection: 'courses' })
export class Course {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'University', required: true })
  universityId: Types.ObjectId;

  @Prop({ default: true })
  active: boolean;
}

export const CourseSchema = SchemaFactory.createForClass(Course);

// Impede curso duplicado (case-insensitive) dentro da mesma faculdade, apenas para cursos ativos
CourseSchema.index(
  { name: 1, universityId: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
    collation: { locale: 'pt', strength: 2 },
  },
);