import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ILicenseRepository } from './interfaces/repository.interface';
import { LICENSE_REPOSITORY } from './interfaces/repository.interface';
import { CreateLicenseDto } from './dto/create-license.dto';
import { License, LicenseStatus } from './schemas/license.schema';
import { nowInBR, addMonthsBR } from '../common/utils/date.utils';

@Injectable()
export class LicenseService {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    @Inject(LICENSE_REPOSITORY)
    private readonly licenseRepository: ILicenseRepository<License>,
    private readonly configService: ConfigService,
  ) {
    // process.env direto não é testável e não valida no boot.
    // getOrThrow lança erro na inicialização se a variável não existir.
    this.apiUrl = this.configService.getOrThrow<string>('BASE_URL_API_LICENSE');
    this.apiKey = this.configService.getOrThrow<string>('X_API_KEY');
  }

  async checkHealth() {
    const res = await fetch(`${this.apiUrl}/health`);
    return res.json();
  }

  async create(createLicenseDto: CreateLicenseDto) {
    const response = await fetch(`${this.apiUrl}/api/v1/license/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.apiKey,
      },
      body: JSON.stringify(createLicenseDto),
    });

    if (!response.ok) {
      throw new Error(`License API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // currentDate removida — era dead code, nunca foi usada
    return this.licenseRepository.create({
      studentId: createLicenseDto.id,
      employeeId: createLicenseDto.employee_id,
      imageLicense: data.image,
      status: LicenseStatus.ACTIVE,
      existing: true,
      expirationDate: addMonthsBR(nowInBR(), 7),
    });
  }

  async getLicenseByStudentId(studentId: string) {
    const license = await this.licenseRepository.findOneByStudentId(studentId);
    if (!license) {
      throw new NotFoundException(`License not found for student ID: ${studentId}`);
    }
    return license;
  }

  async getLicenseById(id: string) {
    const license = await this.licenseRepository.findOne(id);
    if (!license) {
      throw new NotFoundException(`License not found for ID: ${id}`);
    }
    return license;
  }

  async getAll() {
    return this.licenseRepository.findAll();
  }

  async remove(id: string) {
    const result = await this.licenseRepository.remove(id);
    if (!result) {
      throw new NotFoundException(`License not found for ID: ${id}`);
    }
  }

  async update(id: string, data: CreateLicenseDto) {
    // Cria primeiro — se falhar, o registro antigo continua ativo
    const newLicense = await this.create(data);
    // Só desativa o antigo após confirmar que o novo existe
    await this.remove(id);
    return newLicense;
  }
}