import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import {
  LicenseRequest,
  LicenseRequestStatus,
  LicenseRequestType,
} from '../schemas/license-request.schema';
import { ILicenseRequestRepository } from '../interfaces/repository.interface';

@Injectable()
export class LicenseRequestRepository implements ILicenseRequestRepository<LicenseRequest> {
  private readonly logger = new Logger(LicenseRequestRepository.name);
  private indexesReady?: Promise<void>;

  constructor(
    @InjectModel(LicenseRequest.name)
    private readonly model: Model<LicenseRequest>,
  ) {
    // Start index creation and keep a promise so callers can await index readiness
    this.indexesReady = this.model.createIndexes().then(() => undefined).catch((err) => {
      this.logger.warn('Failed to create indexes for LicenseRequest model: ' + (err as Error).message);
    });
  }

  async create(data: Partial<LicenseRequest>, session?: import('mongoose').ClientSession): Promise<LicenseRequest> {
    // Ensure indexes exist before attempting to insert to avoid race conditions
    // on fresh DBs (useful for tests that create models dynamically).
    if (this.indexesReady) {
      try {
        await this.indexesReady;
      } catch {
        // ignore
      }
    }

    const doc = new this.model(data);
    return doc.save({ session });
  }

  async findById(id: string): Promise<LicenseRequest | null> {
    return this.model
      .findById(id)
      .lean()
      .exec() as Promise<LicenseRequest | null>;
  }

  async findByStudentId(studentId: string, session?: ClientSession): Promise<LicenseRequest[]> {
    const query = this.model
      .find({ studentId })
      .sort({ createdAt: -1 })
      .lean();

    if (session) query.session(session);
    return query.exec() as Promise<LicenseRequest[]>;
  }

  async findPendingByStudentId(
    studentId: string,
    session?: ClientSession,
  ): Promise<LicenseRequest | null> {
    const query = this.model
      .findOne({ studentId, status: LicenseRequestStatus.PENDING })
      .lean();

    if (session) query.session(session);
    return query.exec() as Promise<LicenseRequest | null>;
  }

  async hasActiveDemandForBusAndUniversity(
    busId: string,
    universityId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    const query = this.model.countDocuments({
      accessBusIdentifiers: busId,
      universityId,
      status: { $in: [LicenseRequestStatus.PENDING, LicenseRequestStatus.WAITLISTED] },
    });

    if (session) query.session(session);
    const count = await query.exec();

    return (count ?? 0) > 0;
  }

  async findPendingOrWaitlistedInitial(
    studentId: string,
    session?: ClientSession,
  ): Promise<LicenseRequest | null> {
    const query = this.model
      .findOne({
        studentId,
        type: LicenseRequestType.INITIAL,
        status: { $in: [LicenseRequestStatus.PENDING, LicenseRequestStatus.WAITLISTED] },
      })
      .sort({ createdAt: 1 })
      .lean();

    if (session) query.session(session);
    return query.exec() as Promise<LicenseRequest | null>;
  }

  async findWaitlistedByEnrollmentPeriod(
    enrollmentPeriodId: string,
    session?: ClientSession,
  ): Promise<LicenseRequest[]> {
    const query = this.model
      .find({
        enrollmentPeriodId,
        status: LicenseRequestStatus.WAITLISTED,
      })
      .sort({ createdAt: 1 })
      .lean();

    if (session) query.session(session);
    return query.exec() as Promise<LicenseRequest[]>;
  }

  async countWaitlistedByEnrollmentPeriod(enrollmentPeriodId: string, session?: ClientSession): Promise<number> {
    const query = this.model.countDocuments({
      enrollmentPeriodId,
      status: LicenseRequestStatus.WAITLISTED,
    });

    if (session) query.session(session);
    const count = await query.exec();

    return count ?? 0;
  }

  async findWaitlistedByEnrollmentPeriodAndBus(
    enrollmentPeriodId: string,
    busId: string,
  ): Promise<LicenseRequest[]> {
    return this.model
      .find({
        enrollmentPeriodId,
        accessBusIdentifiers: busId,
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
        accessBusIdentifiers: busId,
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
    // busId now refers to the bus identifier snapshot exposed to employees
    return this.model
      .find({
        enrollmentPeriodId,
        status: { $in: [LicenseRequestStatus.PENDING, LicenseRequestStatus.WAITLISTED] },
        accessBusIdentifiers: busId,
      })
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
    const pipeline = [
      {
        $match: {
          enrollmentPeriodId,
          status: { $in: [LicenseRequestStatus.PENDING, LicenseRequestStatus.WAITLISTED] },
        },
      },
      { $unwind: '$accessBusIdentifiers' },
      {
        $group: {
          _id: { busId: '$accessBusIdentifiers', universityId: '$universityId' },
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
      // FIFO: older requests first
      .sort({ createdAt: 1 })
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
