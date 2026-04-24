import { ClientSession } from 'mongoose';

export const BUS_ROUTE_REPOSITORY = 'BUS_ROUTE_REPOSITORY';

export interface IBusRouteRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findAll(): Promise<T[]>;
  findAllInactive(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findByLineNumberNormalized(lineNumberNormalized: string): Promise<T | null>;
  update(id: string, data: Partial<T>, session?: ClientSession): Promise<T | null>;
  deactivate(id: string): Promise<boolean>;
}
