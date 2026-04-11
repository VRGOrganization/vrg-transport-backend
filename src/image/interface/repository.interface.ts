import { Image } from '../schema/image.schema';
import { PhotoType } from '../types/photoType.enum';

export const IMAGE_REPOSITORY = 'IMAGE_REPOSITORY';

export interface IImageRepository {
  create(data: Partial<Image>): Promise<Image>;
  findOneByFilter(filter: Partial<Image> & { _id?: string }): Promise<Image | null>;
  findOneByStudentAndPhotoType(
    studentId: string,
    photoType: PhotoType,
  ): Promise<Image | null>;
  findAllActive(): Promise<Image[]>;
  findAllPaginatedActive(
    page: number,
    limit: number,
  ): Promise<{ data: Image[]; total: number; page: number; limit: number }>;
  findById(id: string): Promise<Image | null>;
  findByStudentIdActive(studentId: string): Promise<Image[]>;
  findProfilePhotoActive(studentId: string): Promise<Image | null>;
  updateById(id: string, data: Partial<Image>): Promise<Image | null>;
  updateProfilePhotoByStudentId(
    studentId: string,
    data: Partial<Image>,
  ): Promise<Image | null>;
  softDeleteById(id: string): Promise<boolean>;
  softDeleteByStudentId(studentId: string): Promise<number>;
  archiveImageToHistory(image: Image): Promise<void>;
}
