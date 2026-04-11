import { LicenseRequest } from '../schemas/license-request.schema';
import { LicenseRequestStatus } from '../schemas/license-request.schema';

export const LICENSE_REQUEST_REPOSITORY = 'LICENSE_REQUEST_REPOSITORY';

export interface ILicenseRequestRepository<T> {
  create(data: Partial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findByStudentId(studentId: string): Promise<T[]>;
  findPendingByStudentId(studentId: string): Promise<T | null>;
  findWaitlistedByEnrollmentPeriod(enrollmentPeriodId: string): Promise<T[]>;
  cancelWaitlistedByEnrollmentPeriod(
    enrollmentPeriodId: string,
    cancellationReason: string,
  ): Promise<number>;
  promoteWaitlistedForPeriod(id: string, enrollmentPeriodId: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  findAllByStatus(status: LicenseRequestStatus): Promise<T[]>;
  update(id: string, data: Partial<T>): Promise<T | null>;
}
