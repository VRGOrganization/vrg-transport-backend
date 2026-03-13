export interface ILicenseRepository<T> {
  create(data: T): Promise<T>;
  findAll(): Promise<T[]>;
  findOne(id: string): Promise<T | null>;
  update(id: string, data: T): Promise<T>;
  remove(id: string): Promise<void>;
}
