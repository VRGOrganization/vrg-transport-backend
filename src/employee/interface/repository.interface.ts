export const EMPLOYEE_REPOSITORY = 'EMPLOYEE_REPOSITORY';

export interface IEmployeeRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findByMatricula(matricula: string): Promise<T | null>;
  findByMatriculaWithPassword(matricula: string): Promise<T | null>;
  findByEmail(email: string): Promise<T | null>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  deactivate(id: string): Promise<boolean>;
}
