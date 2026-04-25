import { ClientSession } from 'mongoose';

export const BUS_REPOSITORY = 'BUS_REPOSITORY';

export interface IBusRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findAll(): Promise<T[]>;
  findAllInactive(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findByIdentifier(identifier: string): Promise<T | null>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  deactivate(id: string): Promise<boolean>;

  // Novos métodos para UniversitySlot e lógica de prioridade
  findAllActive(): Promise<T[]>;
  // Retorna todos os ônibus que contêm a universityId nos seus slots.
  findByUniversityId(universityId: string): Promise<T[]>;
  incrementUniversityFilledSlots(busId: string, universityId: string, session?: ClientSession): Promise<void>;
  decrementUniversityFilledSlots(busId: string, universityId: string, session?: ClientSession): Promise<void>;
  resetAllFilledSlots(): Promise<void>;
  resetUniversityFilledSlots(busId: string, quantity?: number, session?: ClientSession): Promise<number>;
  findAllWithQueueCounts(): Promise<any[]>; // Tipar depois
}