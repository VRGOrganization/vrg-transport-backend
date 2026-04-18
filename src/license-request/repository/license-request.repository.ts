import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  LicenseRequest,
  LicenseRequestStatus,
} from '../schemas/license-request.schema';
import { ILicenseRequestRepository } from '../interfaces/repository.interface';

@Injectable()
export class LicenseRequestRepository implements ILicenseRequestRepository<LicenseRequest> {
  constructor(
    @InjectModel(LicenseRequest.name)
    private readonly model: Model<LicenseRequest>,
  ) {}

  async create(data: Partial<LicenseRequest>, session?: import('mongoose').ClientSession): Promise<LicenseRequest> {
    const doc = new this.model(data);
    return doc.save({ session });
  }

  async findById(id: string): Promise<LicenseRequest | null> {
    return this.model
      .findById(id)
      .lean()
      .exec() as Promise<LicenseRequest | null>;
  }

  async findByStudentId(studentId: string): Promise<LicenseRequest[]> {
    return this.model
      .find({ studentId })
      .sort({ createdAt: -1 })
      .lean()
      .exec() as Promise<LicenseRequest[]>;
  }

  async findPendingByStudentId(
    studentId: string,
  ): Promise<LicenseRequest | null> {
    return this.model
      .findOne({ studentId, status: LicenseRequestStatus.PENDING })
      .lean()
      .exec() as Promise<LicenseRequest | null>;
  }

  async hasActiveDemandForBusAndUniversity(
    busId: string,
    universityId: string,
  ): Promise<boolean> {
    const count = await this.model
      .countDocuments({
        busId,
        universityId,
        status: { $in: [LicenseRequestStatus.PENDING, LicenseRequestStatus.WAITLISTED] },
      })
      .exec();

    return (count ?? 0) > 0;
  }

  async findPendingOrWaitlistedInitial(
    studentId: string,
  ): Promise<LicenseRequest | null> {
    return this.model
      .findOne({
        studentId,
        type: 'initial',
        status: { $in: [LicenseRequestStatus.PENDING, LicenseRequestStatus.WAITLISTED] },
      })
      .sort({ createdAt: 1 })
      .lean()
      .exec() as Promise<LicenseRequest | null>;
  }

  async findWaitlistedByEnrollmentPeriod(
    enrollmentPeriodId: string,
  ): Promise<LicenseRequest[]> {
    return this.model
      .find({
        enrollmentPeriodId,
        status: LicenseRequestStatus.WAITLISTED,
      })
      .sort({ createdAt: 1 })
      .lean()
      .exec() as Promise<LicenseRequest[]>;
  }

  async promoteWaitlistedForPeriod(
    id: string,
    enrollmentPeriodId: string,
  ): Promise<LicenseRequest | null> {
    return this.model
      .findOneAndUpdate(
        {
          _id: id,
          enrollmentPeriodId,
          status: LicenseRequestStatus.WAITLISTED,
        },
        {
          $set: {
            status: LicenseRequestStatus.PENDING,
            filaPosition: null,
          },
        },
        { returnDocument: 'after' },
      )
      .lean()
      .exec() as Promise<LicenseRequest | null>;
  }

  async cancelWaitlistedByEnrollmentPeriod(
    enrollmentPeriodId: string,
    cancellationReason: string,
  ): Promise<number> {
    const result = await this.model
      .updateMany(
        {
          enrollmentPeriodId,
          status: LicenseRequestStatus.WAITLISTED,
        },
        {
          $set: {
            status: LicenseRequestStatus.CANCELLED,
            cancellationReason,
            filaPosition: null,
          },
        },
      )
      .exec();

    return result.modifiedCount ?? 0;
  }

  async findAll(): Promise<LicenseRequest[]> {
    return this.model.find().sort({ createdAt: -1 }).lean().exec() as Promise<
      LicenseRequest[]
    >;
  }

  async findAllByStatus(
    status: LicenseRequestStatus,
  ): Promise<LicenseRequest[]> {
    return this.model
      .find({ status })
      .sort({ createdAt: -1 })
      .lean()
      .exec() as Promise<LicenseRequest[]>;
  }

  async update(
    id: string,
    data: Partial<LicenseRequest>,
    session?: import('mongoose').ClientSession,
  ): Promise<LicenseRequest | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', session })
      .lean()
      .session(session ?? undefined)
      .exec() as Promise<LicenseRequest | null>;
  }
}
