export const UNIVERSITY_REPOSITORY = 'UNIVERSITY_REPOSITORY';

export interface IUniversityRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findAll(): Promise<T[]>;
  findAllInactive(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findByAcronym(acronym: string): Promise<T | null>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  deactivate(id: string): Promise<boolean>;
}