import { Inject, Injectable } from '@nestjs/common';
import type { ILicenseRepository } from './interfaces/repository.interface';
import { LICENSE_REPOSITORY } from './interfaces/repository.interface';
import { CreateLicenseDto } from './dto/create-license.dto';
import { License } from './schemas/license.schema';


@Injectable()
export class LicenseService {
  constructor(
    @Inject(LICENSE_REPOSITORY)
    private readonly licenseRepository: ILicenseRepository<License>,
  ) {}

  async create(createLicenseDto: CreateLicenseDto) {
    try {
      const response = await fetch(
        `${process.env.BASE_URL_API_LICENSE}/api/v1/license/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': '3401ecac7c12ab3ee5bb3d04b4d325c1',
          },
          body: JSON.stringify(createLicenseDto),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to create license: ${response.statusText}`);
      }

      const data = await response.json();
      
      const dataLicense = {
        studentId: "asdasd",
        employeeId: "asdasdasd",
        imageLicense: data.image,
        status: 'active',
        existing: true,
        expirationDate: new Date(),
      }

      const r = await this.licenseRepository.create(dataLicense);
      if(!r){
        throw new Error('Failed to save license in database');
      }
      return r;
    } catch (error) {
      console.error('Error creating license:', error);
      throw error;
    }
  }

  async checkHealth() {
    try {
      const res = await fetch(`${process.env.BASE_URL_API_LICENSE}/health`);
      const data = await res.json();
      return data;
    } catch (error) {
      return { status: 'error', message: 'License API is not healthy' };
    }
  }
}