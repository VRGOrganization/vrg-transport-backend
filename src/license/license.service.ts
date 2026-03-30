import {
  Inject,
  Injectable,
  NotFoundException,
  BadGatewayException,
  Logger,
  GatewayTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ILicenseRepository } from './interfaces/repository.interface';
import { LICENSE_REPOSITORY } from './interfaces/repository.interface';
import { CreateLicenseDto } from './dto/create-license.dto';
import { License, LicenseStatus } from './schemas/license.schema';
import { nowInBR, addMonthsBR } from '../common/utils/date.utils';
import { StudentService } from 'src/student/student.service';
import { AuditLogService } from '../common/audit/audit-log.service';


@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    @Inject(LICENSE_REPOSITORY)
    private readonly licenseRepository: ILicenseRepository<License>,
    private readonly studentService: StudentService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {
    this.apiUrl = this.configService.getOrThrow<string>('LICENSE_API_URL');
    this.apiKey = this.configService.getOrThrow<string>('LICENSE_API_KEY');
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
    const student = await this.studentService.findOneOrFail(dto.id);
    if(!student) {
      throw new NotFoundException('Student não encontrado')
    }

    const studentId = (student as any)._id.toString();

    const payload = {
      id: studentId,
      employee_id: employeeId,
      name: student.name,
      degree: student.degree,
      institution: dto.institution,
      shift: student.shift,
      telephone: student.telephone,
      blood_type: student.bloodType,
      bus: student.bus,
      photo: dto.photo,      
    }

    const data = await this.callLicenseApi(payload);
    await this.auditLog.record({
      action: 'license.create',
      outcome: 'success',
      actor: { id: employeeId, role: 'employee' },
      target: { studentId },
    })
    
    return this.licenseRepository.create({
      studentId,
      employeeId, 
      imageLicense: data.license_image_url,
      status: LicenseStatus.ACTIVE,
      existing: true,
      expirationDate: addMonthsBR(nowInBR(), 7),
    })
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
    const newLicense = await this.create(dto, employeeId);

    try {
      await this.remove(id);
      return newLicense;
    } catch (error) {
      await this.licenseRepository.remove((newLicense as any)._id.toString()).catch(() => undefined);
      throw error;
    }
  }


  private async callLicenseApi(payload: Record<string, unknown>){
    const timeout = this.configService.get('LICENSE_API_TIMEOUT_MS', 5000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try{
      const response = await fetch(`${this.apiUrl}/api/v1/license/create`,{
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        this.logger.error(`License API error: ${response.status} ${response.statusText}`);
        throw new BadGatewayException('Erro ao comunicar com o serviço de licenças');
      }
      return response.json();
    }catch(err){
      if(err instanceof Error && err.name === 'AbortError') {
        throw new GatewayTimeoutException('Serviço de licenças indisponível');
      }
      throw new BadGatewayException('Erro ao comunicar com o serviço de licenças');
    }finally{
      clearTimeout(timer);
    }
  }
}