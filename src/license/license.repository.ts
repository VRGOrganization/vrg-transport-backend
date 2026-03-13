import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { License } from './schemas/license.schema';
import { ILicenseRepository } from './interfaces/repository.interface';

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
    return this.licenseModel.find().exec();
  }

  async findOne(id: string): Promise<License | null> {
    return this.licenseModel.findById(id).exec();
  }

  async remove(id: string): Promise<void> {
    await this.licenseModel.findByIdAndDelete(id).exec();
  }
}