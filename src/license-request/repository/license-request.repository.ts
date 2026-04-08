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

  async create(data: Partial<LicenseRequest>): Promise<LicenseRequest> {
    return this.model.create(data);
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
  ): Promise<LicenseRequest | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean()
      .exec() as Promise<LicenseRequest | null>;
  }
}
