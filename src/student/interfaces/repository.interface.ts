import { ClientSession } from 'mongoose';

export const STUDENT_REPOSITORY = 'STUDENT_REPOSITORY';

export interface IStudentRepository<T> {
  create(data: Partial<T>, session?: ClientSession): Promise<T>;
  findAll(): Promise<T[]>;
  findAllInactive(): Promise<T[]>;
  findAllPaginated(
    page: number,
    limit: number,
  ): Promise<{ data: T[]; total: number; page: number; limit: number }>;
  findById(id: string): Promise<T | null>;
  findByEmail(email: string): Promise<T | null>;
  findByEmailWithSensitiveFields(email: string): Promise<T | null>;
  findByCpfHash(cpfHash: string): Promise<T | null>;
  update(id: string, data: Partial<T>, session?: ClientSession): Promise<T | null>;
  remove(id: string): Promise<boolean>;
  findByBus(busIdentifier: string): Promise<T[]>;
}
