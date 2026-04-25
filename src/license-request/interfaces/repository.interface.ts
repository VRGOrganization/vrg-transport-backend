import { LicenseRequestStatus } from '../schemas/license-request.schema';
import { ClientSession } from 'mongoose';

export const LICENSE_REQUEST_REPOSITORY = 'LICENSE_REQUEST_REPOSITORY';

export interface ILicenseRequestRepository<T> {
  create(data: Partial<T>, session?: ClientSession): Promise<T>;
  findById(id: string): Promise<T | null>;
  // Allow passing an optional session for transactional reads
  findByStudentId(studentId: string, session?: ClientSession): Promise<T[]>;
  findPendingByStudentId(studentId: string, session?: ClientSession): Promise<T | null>;
  hasActiveDemandForBusAndUniversity(busId: string, universityId: string, session?: ClientSession): Promise<boolean>;
  findPendingOrWaitlistedInitial(studentId: string, session?: ClientSession): Promise<T | null>;
  findWaitlistedByEnrollmentPeriod(enrollmentPeriodId: string, session?: ClientSession): Promise<T[]>;
  countWaitlistedByEnrollmentPeriod(enrollmentPeriodId: string, session?: ClientSession): Promise<number>;
  findWaitlistedByEnrollmentPeriodAndBus(enrollmentPeriodId: string, busId: string): Promise<T[]>;
  countWaitlistedByEnrollmentPeriodAndBus(enrollmentPeriodId: string, busId: string): Promise<number>;
  cancelWaitlistedByEnrollmentPeriod(
    enrollmentPeriodId: string,
    cancellationReason: string,
  ): Promise<number>;
  promoteWaitlistedForPeriod(id: string, enrollmentPeriodId: string): Promise<T | null>;
  findByEnrollmentPeriodId(enrollmentPeriodId: string): Promise<T[]>;
  findByEnrollmentPeriodAndBusGrouped(enrollmentPeriodId: string): Promise<any[]>;
  findByEnrollmentPeriodAndBus(enrollmentPeriodId: string, busId: string): Promise<T[]>;
  reorderWaitlistedPositions(requestIds: string[]): Promise<number>;
  findAll(): Promise<T[]>;
  findAllByStatus(status: LicenseRequestStatus): Promise<T[]>;
  update(id: string, data: Partial<T>, session?: ClientSession): Promise<T | null>;
}
