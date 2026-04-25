export const COURSE_REPOSITORY = 'COURSE_REPOSITORY';

export interface ICourseRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findAll(): Promise<T[]>;
  findAllInactive(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findByUniversity(universityId: string): Promise<T[]>;
  findByNameAndUniversity(name: string, universityId: string): Promise<T | null>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  deactivate(id: string): Promise<boolean>;
}