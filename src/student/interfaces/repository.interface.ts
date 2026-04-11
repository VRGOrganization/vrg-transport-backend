export const STUDENT_REPOSITORY = 'STUDENT_REPOSITORY';

export interface IStudentRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findAll(): Promise<T[]>;
  findAllPaginated(
    page: number,
    limit: number,
  ): Promise<{ data: T[]; total: number; page: number; limit: number }>;
  findById(id: string): Promise<T | null>;
  findByEmail(email: string): Promise<T | null>;
  findByEmailWithSensitiveFields(email: string): Promise<T | null>;
  findByCpfHash(cpfHash: string): Promise<T | null>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  remove(id: string): Promise<boolean>;
}
