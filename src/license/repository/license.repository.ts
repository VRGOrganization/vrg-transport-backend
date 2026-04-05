import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { License } from '../schemas/license.schema';
import { ILicenseRepository } from '../interfaces/repository.interface';

@Injectable()
export class LicenseRepository implements ILicenseRepository<License> {

  constructor(
    @InjectModel(License.name)
    private readonly licenseModel: Model<License>
  ) {}

  async create(data: Partial<License>): Promise<License> {
    const license = new this.licenseModel(data);
    return license.save();
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

  async findOneByStudentId(studentId: string): Promise<License | null> {
    return this.licenseModel.findOne({ studentId }).exec();
  }

  async findOneByVerificationCode(code: string): Promise<License | null> {
    return this.licenseModel.findOne({ verificationCode: code }).exec();
  }
}