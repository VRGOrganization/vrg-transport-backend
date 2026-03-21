import {
  Inject,
  Injectable,
  NotFoundException,
  BadGatewayException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ILicenseRepository } from './interfaces/repository.interface';
import { LICENSE_REPOSITORY } from './interfaces/repository.interface';
import { CreateLicenseDto } from './dto/create-license.dto';
import { License, LicenseStatus } from './schemas/license.schema';
import { nowInBR, addMonthsBR } from '../common/utils/date.utils';

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    @Inject(LICENSE_REPOSITORY)
    private readonly licenseRepository: ILicenseRepository<License>,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.getOrThrow<string>('BASE_URL_API_LICENSE');
    this.apiKey = this.configService.getOrThrow<string>('X_API_KEY');
  }

  async checkHealth() {
    const res = await fetch(`${this.apiUrl}/health`);
    return res.json();
  }

  /**
   * @param dto        Dados da licença vindos do client
   * @param employeeId ID extraído do JWT no controller — nunca do body
   */
  async create(dto: CreateLicenseDto, employeeId: string): Promise<License> {
    const response = await fetch(`${this.apiUrl}/api/v1/license/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.apiKey,
      },
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      this.logger.error(`License API error: ${response.status} ${response.statusText}`);
      throw new BadGatewayException('Erro ao comunicar com o serviço de licenças');
    }

    const data = await response.json();

    return this.licenseRepository.create({
      studentId: dto.id,
      employeeId,
      imageLicense: data.image,
      status: LicenseStatus.ACTIVE,
      existing: true,
      expirationDate: addMonthsBR(nowInBR(), 7),
    });
  }

  async getLicenseByStudentId(studentId: string): Promise<License> {
    const license = await this.licenseRepository.findOneByStudentId(studentId);
    if (!license) {
      throw new NotFoundException(`Licença não encontrada para o student ${studentId}`);
    }
    return license;
  }

  async getLicenseById(id: string): Promise<License> {
    const license = await this.licenseRepository.findOne(id);
    if (!license) {
      throw new NotFoundException(`Licença ${id} não encontrada`);
    }
    return license;
  }

  async getAll(): Promise<License[]> {
    return this.licenseRepository.findAll();
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.licenseRepository.remove(id);
    if (!result) {
      throw new NotFoundException(`Licença ${id} não encontrada`);
    }
    return { message: 'Licença removida com sucesso' };
  }

  async update(id: string, dto: CreateLicenseDto, employeeId: string): Promise<License> {
    // Cria primeiro — se a API externa falhar, o registro antigo permanece ativo
    const newLicense = await this.create(dto, employeeId);
    await this.remove(id);
    return newLicense;
  }
}