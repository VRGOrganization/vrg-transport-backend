import {
  Inject,
  Injectable,
  NotFoundException,
  BadGatewayException,
  Logger,
  GatewayTimeoutException,
  MessageEvent,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Observable, Subject } from 'rxjs';
import type { ILicenseRepository } from './interfaces/repository.interface';
import { LICENSE_REPOSITORY } from './interfaces/repository.interface';
import { CreateLicenseDto } from './dto/create-license.dto';
import { License, LicenseStatus } from './schemas/license.schema';
import { nowInBR, addMonthsBR } from '../common/utils/date.utils';
import { StudentService } from '../student/student.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { AUTH_ERROR_MESSAGES } from '../auth/constants/auth.constants';
import { MailService } from '../mail/mail.service';

type SseTicketEntry = {
  studentId: string;
  expiresAt: number;
};


@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly qrCodeBaseUrl: string;
  private readonly studentStreams = new Map<string, Subject<MessageEvent>>();
  private readonly sseTickets = new Map<string, SseTicketEntry>();
  private readonly sseTicketTtlMs = 60_000;

  constructor(
    @Inject(LICENSE_REPOSITORY)
    private readonly licenseRepository: ILicenseRepository<License>,
    private readonly studentService: StudentService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly mailService: MailService,
  ) {
    this.apiUrl = this.configService.getOrThrow<string>('LICENSE_API_URL');
    this.apiKey = this.configService.getOrThrow<string>('LICENSE_API_KEY');
    this.qrCodeBaseUrl = this.configService.getOrThrow<string>('QR_CODE_BASE_URL');
  }

  issueSseTicket(studentId: string): { ticket: string; expiresInMs: number } {
    this.pruneExpiredSseTickets();

    const ticket = randomUUID();
    this.sseTickets.set(ticket, {
      studentId,
      expiresAt: Date.now() + this.sseTicketTtlMs,
    });

    return {
      ticket,
      expiresInMs: this.sseTicketTtlMs,
    };
  }

  consumeSseTicket(ticket: string): string {
    if (!ticket) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
    }

    this.pruneExpiredSseTickets();
    const entry = this.sseTickets.get(ticket);

    if (!entry || entry.expiresAt <= Date.now()) {
      this.sseTickets.delete(ticket);
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
    }

    // Uso único: impede reuso da URL caso ela seja exposta.
    this.sseTickets.delete(ticket);

    return entry.studentId;
  }

  private pruneExpiredSseTickets(): void {
    const now = Date.now();
    for (const [ticket, entry] of this.sseTickets.entries()) {
      if (entry.expiresAt <= now) {
        this.sseTickets.delete(ticket);
      }
    }
  }

  streamByStudent(studentId: string): Observable<MessageEvent> {
    const stream = this.ensureStream(studentId);

    return new Observable<MessageEvent>((subscriber) => {
      const streamSubscription = stream.subscribe(subscriber);

      // Evento inicial para o cliente detectar conexão ativa.
      subscriber.next({
        data: JSON.stringify({ type: 'connected', studentId, ts: Date.now() }),
      });

      const heartbeat = setInterval(() => {
        subscriber.next({
          data: JSON.stringify({ type: 'heartbeat', ts: Date.now() }),
        });
      }, 25_000);

      return () => {
        clearInterval(heartbeat);
        streamSubscription.unsubscribe();

        if (stream.observed === false) {
          this.studentStreams.delete(studentId);
        }
      };
    });
  }

  async checkHealth() {
    const res = await fetch(`${this.apiUrl}/health`);
    return res.json();
  }
  /**
   * @param dto        Dados da licença vindos do client
   * @param employeeId ID extraído da sessão no controller — nunca do body
   */
  async create(dto: CreateLicenseDto, employeeId: string): Promise<License> {
    const student = await this.studentService.findOneOrFail(dto.id);

    const studentId = (student as any)._id.toString();

    const verificationCode = randomUUID();
    const qrCodeUrl = `${this.qrCodeBaseUrl}/${verificationCode}`;

    const payload = {
      id: studentId,
      employee_id: employeeId,
      name: student.name,
      degree: student.degree,
      institution: dto.institution,
      shift: student.shift,
      telephone: student.telephone,
      blood_type: student.bloodType,
      bus: dto.bus,
      photo: this.normalizePhotoForLicenseApi(dto.photo),
      qr_code_url: qrCodeUrl,
    }

    const data = await this.callLicenseApi(payload);
    await this.auditLog.record({
      action: 'license.create',
      outcome: 'success',
      actor: { id: employeeId, role: 'employee' },
      target: { studentId },
    })

    const created = await this.licenseRepository.create({
      studentId,
      employeeId,
      imageLicense: data.image,
      status: LicenseStatus.ACTIVE,
      existing: true,
      expirationDate: addMonthsBR(nowInBR(), 7),
      verificationCode,
    });

    this.emitLicenseEvent(studentId, {
      type: 'license.changed',
      reason: 'created',
    });

    return created;
  }

  async getLicenseByStudentId(studentId: string): Promise<License> {
    const license = await this.licenseRepository.findOneByStudentId(studentId);
    if (!license) {
      throw new NotFoundException();
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
    const existing = await this.licenseRepository.findOne(id);
    const result = await this.licenseRepository.remove(id);
    if (!result) {
      throw new NotFoundException(`Licença ${id} não encontrada`);
    }

    if (existing?.studentId) {
      this.emitLicenseEvent(existing.studentId, {
        type: 'license.changed',
        reason: 'removed',
      });
    }

    return { message: 'Licença removida com sucesso' };
  }

  async reject(id: string, reason: string, employeeId: string): Promise<License> {
    const license = await this.licenseRepository.findOne(id);
    if (!license) throw new NotFoundException(`Licença ${id} não encontrada`);

    const student = await this.studentService.findOneOrFail(license.studentId);

    const updated = await this.licenseRepository.update(id, {
      status: LicenseStatus.REJECTED,
      rejectionReason: reason,
      rejectedAt: new Date(),
    });

    if (!updated) throw new NotFoundException(`Licença ${id} não encontrada`);

    await this.auditLog.record({
      action: 'license.reject',
      outcome: 'success',
      actor: { id: employeeId, role: 'employee' },
      target: { studentId: license.studentId, licenseId: id },
      metadata: { reason },
    });

    this.emitLicenseEvent(license.studentId, {
      type: 'license.changed',
      reason: 'rejected',
    });

    await this.mailService.sendLicenseRejection(
      student.email,
      student.name,
      reason,
    ).catch((err) => {
      this.logger.warn(`Email de recusa não enviado: ${err?.message}`);
    });

    return updated;
  }

  async verifyByCode(code: string): Promise<{ exists: boolean; valid?: boolean; status?: LicenseStatus }> {
    const license = await this.licenseRepository.findOneByVerificationCode(code);
    if (!license || !license.existing) {
      return { exists: false };
    }
    return {
      exists: true,
      valid: license.status === LicenseStatus.ACTIVE,
      status: license.status,
    };
  }

  async update(id: string, dto: CreateLicenseDto, employeeId: string): Promise<License> {
    const oldLicense = await this.licenseRepository.findOne(id);
    const newLicense = await this.create(dto, employeeId);

    try {
      await this.remove(id);

      if (newLicense.studentId) {
        this.emitLicenseEvent(newLicense.studentId, {
          type: 'license.changed',
          reason: 'updated',
        });
      }

      if (oldLicense?.studentId && oldLicense.studentId !== newLicense.studentId) {
        this.emitLicenseEvent(oldLicense.studentId, {
          type: 'license.changed',
          reason: 'updated',
        });
      }

      return newLicense;
    } catch (error) {
      await this.licenseRepository.remove((newLicense as any)._id.toString()).catch(() => undefined);
      throw error;
    }
  }

  async regenerateExistingForStudent(
    studentId: string,
    dto: { institution: string; bus: string; photo?: string },
    employeeId: string,
  ): Promise<License> {
    const existing = await this.licenseRepository.findOneByStudentId(studentId);
    if (!existing) {
      throw new NotFoundException(`Licença do estudante ${studentId} não encontrada`);
    }

    const student = await this.studentService.findOneOrFail(studentId);

    const verificationCode = randomUUID();
    const qrCodeUrl = `${this.qrCodeBaseUrl}/${verificationCode}`;

    const payload = {
      id: studentId,
      employee_id: employeeId,
      name: student.name,
      degree: student.degree,
      institution: dto.institution,
      shift: student.shift,
      telephone: student.telephone,
      blood_type: student.bloodType,
      bus: dto.bus,
      photo: this.normalizePhotoForLicenseApi(dto.photo),
      qr_code_url: qrCodeUrl,
    };

    const data = await this.callLicenseApi(payload);

    const existingId = (existing as any)._id.toString();
    const updated = await this.licenseRepository.update(existingId, {
      employeeId,
      imageLicense: data.image,
      status: LicenseStatus.ACTIVE,
      existing: true,
      expirationDate: addMonthsBR(nowInBR(), 7),
      verificationCode,
      rejectionReason: null,
      rejectedAt: null,
    });

    if (!updated) {
      throw new NotFoundException(`Licença ${existingId} não encontrada`);
    }

    await this.auditLog.record({
      action: 'license.update_existing',
      outcome: 'success',
      actor: { id: employeeId, role: 'employee' },
      target: { studentId, licenseId: existingId },
    });

    this.emitLicenseEvent(studentId, {
      type: 'license.changed',
      reason: 'updated',
    });

    return updated;
  }

  private ensureStream(studentId: string): Subject<MessageEvent> {
    const existing = this.studentStreams.get(studentId);
    if (existing) return existing;

    const created = new Subject<MessageEvent>();
    this.studentStreams.set(studentId, created);
    return created;
  }

  private emitLicenseEvent(
    studentId: string,
    payload: { type: 'license.changed'; reason: 'created' | 'updated' | 'removed' | 'rejected' },
  ): void {
    const stream = this.studentStreams.get(studentId);
    if (!stream) return;

    stream.next({
      data: JSON.stringify({
        ...payload,
        studentId,
        ts: Date.now(),
      }),
    });
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
        const errorBody = await response.text();
        this.logger.error(
          `License API error: ${response.status} ${response.statusText} body=${errorBody}`,
        );
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

  private normalizePhotoForLicenseApi(photo?: string): string | undefined {
    if (!photo) return undefined;

    const dataUrlMatch = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i.exec(photo);
    if (dataUrlMatch) {
      return dataUrlMatch[2];
    }

    return photo;
  }
}