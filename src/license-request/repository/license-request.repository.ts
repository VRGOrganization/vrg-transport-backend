import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  LicenseRequest,
  LicenseRequestStatus,
  LicenseRequestType,
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
        type: LicenseRequestType.INITIAL,
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

  async findWaitlistedByEnrollmentPeriodAndBus(
    enrollmentPeriodId: string,
    busId: string,
  ): Promise<LicenseRequest[]> {
    return this.model
      .find({
        enrollmentPeriodId,
        busId: typeof busId === 'string' ? new Types.ObjectId(busId) : busId,
        status: LicenseRequestStatus.WAITLISTED,
      })
      .sort({ createdAt: 1 })
      .lean()
      .exec() as Promise<LicenseRequest[]>;
  }

  async countWaitlistedByEnrollmentPeriodAndBus(
    enrollmentPeriodId: string,
    busId: string,
  ): Promise<number> {
    const count = await this.model
      .countDocuments({
        enrollmentPeriodId,
        busId: typeof busId === 'string' ? new Types.ObjectId(busId) : busId,
        status: LicenseRequestStatus.WAITLISTED,
      })
      .exec();

    return count ?? 0;
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

  async findByEnrollmentPeriodId(enrollmentPeriodId: string): Promise<LicenseRequest[]> {
    // enrollmentPeriodId is stored as string in the schema, keep it as-is
    return this.model
      .find({ enrollmentPeriodId })
      .sort({ createdAt: -1 })
      .lean()
      .exec() as Promise<LicenseRequest[]>;
  }

  async findByEnrollmentPeriodAndBus(enrollmentPeriodId: string, busId: string): Promise<LicenseRequest[]> {
    // enrollmentPeriodId is a string in the schema; busId is an ObjectId
    const busMatch = typeof busId === 'string' ? new Types.ObjectId(busId) : busId;
    return this.model
      .find({ enrollmentPeriodId, busId: busMatch })
      .lean()
      .exec() as Promise<LicenseRequest[]>;
  }

  async reorderWaitlistedPositions(requestIds: string[]): Promise<number> {
    if (!requestIds.length) {
      return 0;
    }

    const bulkOps = requestIds.map((id, index) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(id) },
        update: { $set: { filaPosition: index + 1 } },
      },
    }));

    const result = await this.model.bulkWrite(bulkOps);
    return result.modifiedCount ?? requestIds.length;
  }

  async findByEnrollmentPeriodAndBusGrouped(enrollmentPeriodId: string): Promise<any[]> {
    // enrollmentPeriodId is stored as string in the schema, match by the string value
    const pipeline = [
      { $match: { enrollmentPeriodId } },
      {
        $group: {
          _id: { busId: '$busId', universityId: '$universityId' },
          pending: { $sum: { $cond: [{ $eq: ['$status', LicenseRequestStatus.PENDING] }, 1, 0] } },
          waitlisted: { $sum: { $cond: [{ $eq: ['$status', LicenseRequestStatus.WAITLISTED] }, 1, 0] } },
        },
      },
      {
        $group: {
          _id: '$_id.busId',
          perUniversity: {
            $push: {
              universityId: '$_id.universityId',
              pending: '$pending',
              waitlisted: '$waitlisted',
            },
          },
          pending: { $sum: '$pending' },
          waitlisted: { $sum: '$waitlisted' },
        },
      },
      {
        $project: {
          _id: 1,
          pending: 1,
          waitlisted: 1,
          perUniversity: 1,
        },
      },
    ];

    return this.model.aggregate(pipeline).exec();
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
      .session(session ?? null)
      .exec() as Promise<LicenseRequest | null>;
  }
}
