import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PhotoType } from '../types/photoType.enum';

export type ImageDocument = HydratedDocument<Image>;

@Schema({ timestamps: true, collection: 'images' })
export class Image {
  // Presente em todos os tipos — identifica o dono da imagem
  @Prop({ required: true, trim: true })
  studentId: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(PhotoType),
  })
  photoType: PhotoType;

  // Foto de perfil (3x4) — usado em ProfilePhoto
  @Prop({ type: String, default: null })
  photo3x4: string | null;

  // Imagem de documento (matrícula, grade horária, etc.)
  @Prop({ type: String, default: null })
  documentImage: string | null;

  // Imagem da carteirinha — reservado para LicenseImage
  @Prop({ type: String, default: null })
  studentCard: string | null;

  @Prop({ default: true })
  active: boolean;
}

export const ImageSchema = SchemaFactory.createForClass(Image);

ImageSchema.index({ studentId: 1 });
ImageSchema.index({ studentId: 1, photoType: 1 }, { unique: true });