export const LICENSE_REPOSITORY = 'LICENSE_REPOSITORY';

export interface ILicenseRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findAll(): Promise<T[]>;
  findOne(id: string): Promise<T | null>;
  remove(id: string): Promise<void>;
}