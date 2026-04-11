export const ENROLLMENT_PERIOD_REPOSITORY = 'ENROLLMENT_PERIOD_REPOSITORY';

export interface IEnrollmentPeriodRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findActive(): Promise<T | null>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  incrementWaitlistSequence(id: string): Promise<T | null>;
  incrementFilledIfAvailable(id: string): Promise<T | null>;
  decrementFilled(id: string): Promise<T | null>;
}
