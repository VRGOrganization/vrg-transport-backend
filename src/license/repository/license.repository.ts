import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { License } from '../schemas/license.schema';
import { LicenseStatus } from '../schemas/license.schema';
import { ILicenseRepository } from '../interfaces/repository.interface';

@Injectable()
export class LicenseRepository implements ILicenseRepository<License> {

  constructor(
    @InjectModel(License.name)
    private readonly licenseModel: Model<License>
  ) {}

  async create(data: Partial<License>): Promise<License> {
  async create(data: Partial<License>, session?: import('mongoose').ClientSession): Promise<License> {
    const license = new this.licenseModel(data);
    return license.save({ session });
  }

  async findAll(): Promise<License[]> {
    return await this.licenseModel.find({ existing: true }).exec();
  }

  async findOne(id: string): Promise<License | null> {
    return this.licenseModel.findById(id).exec();
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.licenseModel
      .findByIdAndUpdate(id, {$set: { status: 'inactive', existing: false }}, { new: true })
      .exec();
    return !!result;
  }

  async update(id: string, data: Partial<License>): Promise<License | null> {
    return this.licenseModel.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true, context: 'query' })
    .exec();
  }

  async findByEnrollmentPeriodId(enrollmentPeriodId: string): Promise<License[]> {
    return this.licenseModel.find({ enrollmentPeriodId }).exec();
  }

  async deactivateExpiredActive(referenceDate: Date): Promise<number> {
    const result = await this.licenseModel
      .updateMany(
        {
          existing: true,
          status: LicenseStatus.ACTIVE,
          expirationDate: { $lt: referenceDate },
        },
        {
          $set: {
            status: LicenseStatus.EXPIRED,
            existing: false,
          },
        },
      )
      .exec();

    return result.modifiedCount ?? 0;
  }

  async findOneByStudentId(studentId: string): Promise<License | null> {
    return this.licenseModel.findOne({ studentId }).exec();
  }

  async findOneByVerificationCode(code: string): Promise<License | null> {
    return this.licenseModel.findOne({ verificationCode: code }).exec();
  }
}