import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UniversityDocument = HydratedDocument<University>;

@Schema({ timestamps: true, collection: 'universities' })
export class University {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true, unique: true, uppercase: true })
  acronym: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ default: true })
  active: boolean;
}

export const UniversitySchema = SchemaFactory.createForClass(University);