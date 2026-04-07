export const LICENSE_REPOSITORY = 'LICENSE_REPOSITORY';

export interface ILicenseRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findAll(): Promise<T[]>;
  findOne(id: string): Promise<T | null>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  remove(id: string): Promise<boolean>;
  findOneByStudentId(studentId: string): Promise<T | null>;
  findOneByVerificationCode(code: string): Promise<T | null>;
}