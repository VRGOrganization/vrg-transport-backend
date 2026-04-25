import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { IEnrollmentPeriodRepository } from '../interfaces/repository.interface';
import {
  EnrollmentPeriod,
  type EnrollmentPeriodDocument,
} from '../schemas/enrollment-period.schema';

@Injectable()
export class EnrollmentPeriodRepository
  implements IEnrollmentPeriodRepository<EnrollmentPeriod>
{
  constructor(
    @InjectModel(EnrollmentPeriod.name)
    private readonly model: Model<EnrollmentPeriodDocument>,
  ) {}

  async create(data: Partial<EnrollmentPeriod>): Promise<EnrollmentPeriod> {
    return this.model.create(data);
  }

  async findAll(): Promise<EnrollmentPeriod[]> {
    return this.model
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec() as Promise<EnrollmentPeriod[]>;
  }

  async findById(id: string): Promise<EnrollmentPeriod | null> {
    return this.model.findById(id).lean().exec() as Promise<EnrollmentPeriod | null>;
  }

  async findActive(): Promise<EnrollmentPeriod | null> {
    return this.model
      .findOne({ active: true })
      .lean()
      .exec() as Promise<EnrollmentPeriod | null>;
  }

  async update(
    id: string,
    data: Partial<EnrollmentPeriod>,
  ): Promise<EnrollmentPeriod | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' })
      .lean()
      .exec() as Promise<EnrollmentPeriod | null>;
  }

  async incrementWaitlistSequence(id: string): Promise<EnrollmentPeriod | null> {
    return this.model
      .findOneAndUpdate(
        { _id: id },
        { $inc: { waitlistSequence: 1 } },
        { returnDocument: 'after' },
      )
      .lean()
      .exec() as Promise<EnrollmentPeriod | null>;
  }

  async incrementFilledIfAvailable(id: string, session?: import('mongoose').ClientSession): Promise<EnrollmentPeriod | null> {
    return this.model
      .findOneAndUpdate(
        {
          _id: id,
          $expr: { $lt: ['$filledSlots', '$totalSlots'] },
        },
        { $inc: { filledSlots: 1 } },
        { returnDocument: 'after', session },
      )
      .lean()
      .session(session ?? null)
      .exec() as Promise<EnrollmentPeriod | null>;
  }

  async decrementFilled(id: string, session?: import('mongoose').ClientSession): Promise<EnrollmentPeriod | null> {
    return this.model
      .findOneAndUpdate(
        { _id: id, filledSlots: { $gt: 0 } },
        { $inc: { filledSlots: -1 } },
        { returnDocument: 'after', session },
      )
      .lean()
      .session(session ?? null)
      .exec() as Promise<EnrollmentPeriod | null>;
  }
}
