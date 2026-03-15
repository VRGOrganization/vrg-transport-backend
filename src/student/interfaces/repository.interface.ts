export const STUDENT_REPOSITORY = 'STUDENT_REPOSITORY';

export interface IStudentRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findOneByStudentId(studentId: string): Promise<T | null>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  updateByStudentId(studentId: string, data: Partial<T>): Promise<T | null>;
  remove(id: string): Promise<boolean>;
  removeByStudentId(studentId: string): Promise<boolean>;
}