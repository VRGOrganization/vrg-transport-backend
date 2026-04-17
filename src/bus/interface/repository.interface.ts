export const BUS_REPOSITORY = 'BUS_REPOSITORY';

export interface IBusRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findAll(): Promise<T[]>;
  findAllInactive(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findByIdentifier(identifier: string): Promise<T | null>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  addUniversity(busId: string, universityId: string): Promise<T | null>;
  removeUniversity(busId: string, universityId: string): Promise<T | null>;
  deactivate(id: string): Promise<boolean>;
}