import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PhotoType } from '../types/photoType.enum';

export class CreateImageDto {
  @ApiProperty({
    example: '65f1c2a9e8b4f1a2c3d4e5f6',
    description: 'ID do estudante',
  })
  @IsMongoId({ message: 'studentId inválido' })
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    enum: PhotoType,
    example: 'PROFILE_PHOTO',
    description: 'Tipo da imagem',
  })
  @IsEnum(PhotoType, { message: 'photoType inválido' })
  @IsNotEmpty()
  photoType: PhotoType;

  @ApiPropertyOptional({
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    description:
      'Imagem 3x4 em base64. Obrigatória quando photoType = ProfilePhoto',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_000_000, {
    message: 'Imagem muito grande (máx ~1.5MB)',
  })
  @Matches(/^data:image\/(jpeg|jpg|png|webp);base64,/, {
    message: 'Formato de imagem inválido',
  })
  photo3x4?: string;

  @ApiPropertyOptional({
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    description:
      'Imagem de documento em base64. Obrigatória quando photoType = EnrollmentProof ou CourseSchedule',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_000_000, {
    message: 'Imagem muito grande (máx ~1.5MB)',
  })
  @Matches(/^data:(image\/(jpeg|jpg|png|webp)|application\/pdf);base64,/, {
    message: 'Formato de documento inválido',
  })
  documentImage?: string;
}

export class UploadMyDocumentDto {
  @ApiProperty({
    enum: PhotoType,
    example: 'EnrollmentProof',
    description: 'Tipo do documento enviado pelo estudante',
  })
  @IsEnum(PhotoType, { message: 'photoType inválido' })
  @IsNotEmpty()
  photoType: PhotoType;

  @ApiProperty({
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    description: 'Arquivo em base64 (JPEG, PNG ou WEBP)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000_000, { message: 'Arquivo muito grande (máx ~1.5MB)' })
  @Matches(/^data:image\/(jpeg|jpg|png|webp);base64,/, {
    message: 'Formato inválido — envie JPEG, PNG ou WEBP em base64',
  })
  photo3x4: string;
}

export class UpdateImageDto {
  @ApiPropertyOptional({
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    description: 'Nova imagem 3x4 em base64',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_000_000, {
    message: 'Imagem muito grande (máx ~1.5MB)',
  })
  @Matches(/^data:image\/(jpeg|jpg|png|webp);base64,/, {
    message: 'Formato de imagem inválido',
  })
  photo3x4?: string;

  @ApiPropertyOptional({
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    description: 'Nova imagem de documento em base64',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_000_000, {
    message: 'Imagem muito grande (máx ~1.5MB)',
  })
  @Matches(/^data:(image\/(jpeg|jpg|png|webp)|application\/pdf);base64,/, {
    message: 'Formato de documento inválido',
  })
  documentImage?: string;
}
