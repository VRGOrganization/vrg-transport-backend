import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ImageDocument = HydratedDocument<Image>;

@Schema({ timestamps: true })
export class Image {
  @Prop({ required: true, index: true })
  studentId: string;

  @Prop({ required: true })
  photo3x4: string;

  @Prop({ required: true })
  studentCard: string;
}

export const ImageSchema = SchemaFactory.createForClass(Image);
