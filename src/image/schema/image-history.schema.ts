import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PhotoType } from '../types/photoType.enum';
import { Image } from './image.schema';

export type ImageHistoryDocument = HydratedDocument<ImageHistory>;

@Schema({ timestamps: false, collection: 'image_history' })
export class ImageHistory {
  @Prop({ required: true, trim: true })
  studentId: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    ref: Image.name,
  })
  imageId: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(PhotoType),
  })
  photoType: PhotoType;

  @Prop({ type: String, default: null })
  photo3x4: string | null;

  @Prop({ type: String, default: null })
  documentImage: string | null;

  @Prop({ type: Date, required: true })
  replacedAt: Date;
}

export const ImageHistorySchema = SchemaFactory.createForClass(ImageHistory);

ImageHistorySchema.index({ studentId: 1 });
ImageHistorySchema.index({ imageId: 1 });
ImageHistorySchema.index({ replacedAt: -1 });
