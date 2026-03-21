import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { PhotoType } from '../types/photoType.enum';

export class CreateImageDto {
  @IsMongoId({ message: 'studentId inválido' })
  @IsNotEmpty()
  studentId: string;

  @IsEnum(PhotoType, { message: 'photoType inválido' })
  @IsNotEmpty()
  photoType: PhotoType;

  // Base64 da foto 3x4 — obrigatório para ProfilePhoto
  @IsOptional()
  @IsString()
  @Matches(/^data:image\/(jpeg|jpg|png|webp);base64,/, {
    message: 'photo3x4 deve ser uma string base64 válida (jpeg, jpg, png ou webp)',
  })
  photo3x4?: string;
}

export class UpdateImageDto {
  @IsOptional()
  @IsString()
  @Matches(/^data:image\/(jpeg|jpg|png|webp);base64,/, {
    message: 'photo3x4 deve ser uma string base64 válida (jpeg, jpg, png ou webp)',
  })
  photo3x4?: string;
}