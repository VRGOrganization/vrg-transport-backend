import {
  Inject,
  Injectable,
  forwardRef,
  NotFoundException,
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Logger,
  GatewayTimeoutException,
  MessageEvent,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Observable, Subject } from 'rxjs';
import { isUUID } from 'class-validator';
import type { ILicenseRepository } from './interfaces/repository.interface';
import { LICENSE_REPOSITORY } from './interfaces/repository.interface';
import { CreateLicenseDto, UpdateLicenseDto } from './dto/create-license.dto';
import { License, LicenseStatus } from './schemas/license.schema';
import { nowInBR, addMonthsBR } from '../common/utils/date.utils';
import { StudentService } from '../student/student.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { AUTH_ERROR_MESSAGES } from '../auth/constants/auth.constants';
import { MailService } from '../mail/mail.service';
import { LICENSE_REQUEST_REPOSITORY } from '../license-request/interfaces/repository.interface';
import type { ILicenseRequestRepository } from '../license-request/interfaces/repository.interface';
import {
  LicenseRequest,
  LicenseRequestStatus,
} from '../license-request/schemas/license-request.schema';

type SseTicketEntry = {
  studentId: string;
  expiresAt: number;
};


@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);
  private readonly MAX_PHOTO_SIZE_BYTES = 2_097_152; // 2MB (base64 length)
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly qrCodeBaseUrl: string;
  private readonly studentStreams = new Map<string, Subject<MessageEvent>>();
  private readonly streamLastActivity = new Map<string, number>();
  private readonly STREAM_TTL_MS = 5 * 60 * 1000;
  private readonly CLEANUP_INTERVAL_MS = 60 * 1000;
  private readonly sseTickets = new Map<string, SseTicketEntry>();
  private readonly sseTicketTtlMs = 60_000;

  private readonly DAY_LABELS: Record<string, string> = {
    SEG: 'Segunda',
    TER: 'Terça',
    QUA: 'Quarta',
    QUI: 'Quinta',
    SEX: 'Sexta',
  };

  // Token bucket para limitar chamadas ao serviço de licenças (por minuto)
  private tokenBucketCapacity: number;
  private tokenBucketTokens: number;
  private tokenBucketRefillIntervalMs: number;
  private tokenBucketLastRefill: number;
  private throttleWaitMs: number;

  // Circuit-breaker simples
  private circuitFailureCount = 0;
  private circuitBreakerThreshold: number;
  private circuitOpenUntil = 0;
  private circuitOpenMs: number;

  constructor(
    @Inject(LICENSE_REPOSITORY)
    private readonly licenseRepository: ILicenseRepository<License>,
    @Inject(LICENSE_REQUEST_REPOSITORY)
    private readonly licenseRequestRepository: ILicenseRequestRepository<LicenseRequest>,
    @Inject(forwardRef(() => StudentService))
    private readonly studentService: StudentService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly mailService: MailService,
  ) {
    this.apiUrl = this.configService.getOrThrow<string>('LICENSE_API_URL');
    this.apiKey = this.configService.getOrThrow<string>('LICENSE_API_KEY');
    this.qrCodeBaseUrl = this.configService.getOrThrow<string>('QR_CODE_BASE_URL');
    const cleanupTimer = setInterval(
      () => this.cleanupStaleStreams(),
      this.CLEANUP_INTERVAL_MS,
    );
    cleanupTimer.unref?.();

    // inicializa token bucket e circuit-breaker a partir das configs (valores padrão seguros)
    this.tokenBucketCapacity = Number(this.configService.get('LICENSE_API_MAX_REQUESTS_PER_MIN', 18));
    this.tokenBucketTokens = this.tokenBucketCapacity;
    this.tokenBucketRefillIntervalMs = Number(this.configService.get('LICENSE_API_TOKEN_REFILL_MS', 60_000));
    this.tokenBucketLastRefill = Date.now();
    this.throttleWaitMs = Number(this.configService.get('LICENSE_API_THROTTLE_WAIT_MS', 2000));

    this.circuitBreakerThreshold = Number(this.configService.get('LICENSE_API_CB_THRESHOLD', 5));
    this.circuitOpenMs = Number(this.configService.get('LICENSE_API_CB_OPEN_MS', 60_000));
    this.circuitFailureCount = 0;
    this.circuitOpenUntil = 0;
  }

  // StudentService injected directly via constructor

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
    this.streamLastActivity.set(studentId, Date.now());

    return new Observable<MessageEvent>((subscriber) => {
      const streamSubscription = stream.subscribe(subscriber);

      // Evento inicial para o cliente detectar conexão ativa.
      subscriber.next({
        data: JSON.stringify({ type: 'connected', studentId, ts: Date.now() }),
      });

      const heartbeat = setInterval(() => {
        this.streamLastActivity.set(studentId, Date.now());
        subscriber.next({
          data: JSON.stringify({ type: 'heartbeat', ts: Date.now() }),
        });
      }, 25_000);

      return () => {
        clearInterval(heartbeat);
        streamSubscription.unsubscribe();

        setTimeout(() => {
          const lastActivity = this.streamLastActivity.get(studentId);
          if (!lastActivity || Date.now() - lastActivity > this.STREAM_TTL_MS) {
            this.studentStreams.delete(studentId);
            this.streamLastActivity.delete(studentId);
          }
        }, this.STREAM_TTL_MS);
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
  async create(
    dto: CreateLicenseDto,
    employeeId: string,
    licenseValidityMonths = 6,
    enrollmentPeriodId: string | null = null,
    skipApprovedRequestValidation = false,
    session?: import('mongoose').ClientSession,
    cardContext?: { cardNote?: string | null; accessBusIdentifiers?: string[] },
  ): Promise<License> {
    if (!skipApprovedRequestValidation) {
      await this.assertHasApprovedRequest(dto.id);
    }

    const student = await this.studentService.findOneOrFail(dto.id);

    const studentId = (student as any)._id.toString();

    const verificationCode = randomUUID();
    const qrCodeUrl = `${this.qrCodeBaseUrl}/${verificationCode}`;

    const normalizedPhoto = this.normalizePhotoForLicenseApi(dto.photo);
    if (normalizedPhoto && normalizedPhoto.length > this.MAX_PHOTO_SIZE_BYTES) {
      throw new BadRequestException('Foto excede o tamanho máximo permitido de 2MB');
    }

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
      photo: normalizedPhoto,
      qr_code_url: qrCodeUrl,
      card_note: cardContext?.cardNote ?? null,
      access_bus_identifiers: cardContext?.accessBusIdentifiers ?? [dto.bus],
      study_schedule: this.buildStudySchedule(student),
    };

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
      enrollmentPeriodId,
      imageLicense: data.image,
      status: LicenseStatus.ACTIVE,
      existing: true,
      expirationDate: addMonthsBR(nowInBR(), licenseValidityMonths),
      verificationCode,
      qrCodeUrl,
    }, session);

    this.emitLicenseEvent(studentId, {
      type: 'license.changed',
      reason: 'created',
    });

    return created;
  }

  async syncValidityMonthsForEnrollmentPeriod(
    enrollmentPeriodId: string,
    oldMonths: number,
    newMonths: number,
  ): Promise<number> {
    const deltaMonths = newMonths - oldMonths;
    if (deltaMonths === 0) {
      return 0;
    }

    const licenses = await this.licenseRepository.findByEnrollmentPeriodId(
      enrollmentPeriodId,
    );

    const activeExistingLicenses = licenses.filter(
      (license) => license.existing && license.status === LicenseStatus.ACTIVE,
    );

    let updatedCount = 0;
    for (const license of activeExistingLicenses) {
      const id = (license as any)._id?.toString?.();
      if (!id) {
        continue;
      }

      const updatedExpiration = addMonthsBR(
        new Date(license.expirationDate),
        deltaMonths,
      );

      const now = nowInBR();
      const isExpiredAfterAdjust = updatedExpiration.getTime() < now.getTime();

      await this.licenseRepository.update(id, {
        expirationDate: updatedExpiration,
        status: isExpiredAfterAdjust ? LicenseStatus.EXPIRED : LicenseStatus.ACTIVE,
        existing: !isExpiredAfterAdjust,
      });
      updatedCount += 1;
    }

    return updatedCount;
  }

  async deactivateExpiredLicenses(): Promise<number> {
    return this.licenseRepository.deactivateExpiredActive(nowInBR());
  }

  private async assertHasApprovedRequest(studentId: string): Promise<void> {
    const requests = await this.licenseRequestRepository.findByStudentId(
      studentId,
    );
    const hasApprovedRequest = requests.some(
      (request) => request.status === LicenseRequestStatus.APPROVED,
    );

    if (!hasApprovedRequest) {
      throw new BadRequestException(
        'Não é possível criar uma carteirinha sem uma solicitação aprovada.',
      );
    }
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

  async remove(id: string, employeeId?: string): Promise<{ message: string }> {
    const existing = await this.licenseRepository.findOne(id);
    const result = await this.licenseRepository.remove(id);
    if (!result) {
      throw new NotFoundException(`Licença ${id} não encontrada`);
    }

    await this.auditLog.record({
      action: 'license.remove',
      outcome: 'success',
      actor: employeeId ? { id: employeeId, role: 'employee' } : null,
      target: { licenseId: id, studentId: existing?.studentId },
    });

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

  async verifyByCode(rawCode: string): Promise<{ exists: boolean; valid?: boolean; status?: LicenseStatus }> {
    if (!isUUID(rawCode, '4')) {
      return { exists: false };
    }

    const license = await this.licenseRepository.findOneByVerificationCode(rawCode);
    if (!license || !license.existing) {
      return { exists: false };
    }
    return {
      exists: true,
      valid: license.status === LicenseStatus.ACTIVE,
      status: license.status,
    };
  }

  async update(
    id: string,
    dto: UpdateLicenseDto,
    employeeId: string,
    cardContext?: { cardNote?: string | null; accessBusIdentifiers?: string[] },
  ): Promise<License> {
    const existing = await this.licenseRepository.findOne(id);
    if (!existing) {
      throw new NotFoundException(`Licença ${id} não encontrada`);
    }

    const studentId = existing.studentId;
    const student = await this.studentService.findOneOrFail(studentId);

    const verificationCode = randomUUID();
    const qrCodeUrl = `${this.qrCodeBaseUrl}/${verificationCode}`;

    const normalizedPhoto = this.normalizePhotoForLicenseApi(dto.photo);
    if (normalizedPhoto && normalizedPhoto.length > this.MAX_PHOTO_SIZE_BYTES) {
      throw new BadRequestException('Foto excede o tamanho máximo permitido de 2MB');
    }

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
      photo: normalizedPhoto,
      qr_code_url: qrCodeUrl,
      card_note: cardContext?.cardNote ?? null,
      access_bus_identifiers: cardContext?.accessBusIdentifiers ?? [dto.bus],
      study_schedule: this.buildStudySchedule(student),
    };

    const data = await this.callLicenseApi(payload);

    const licenseValidityMonths = 6;

    const updated = await this.licenseRepository.update(id, {
      studentId,
      employeeId,
      imageLicense: data.image,
      status: LicenseStatus.ACTIVE,
      existing: true,
      expirationDate: addMonthsBR(nowInBR(), licenseValidityMonths),
      verificationCode,
      qrCodeUrl,
      rejectionReason: null,
      rejectedAt: null,
    });

    if (!updated) {
      throw new NotFoundException(`Licença ${id} não encontrada`);
    }

    await this.auditLog.record({
      action: 'license.update',
      outcome: 'success',
      actor: { id: employeeId, role: 'employee' },
      target: { studentId, licenseId: id },
    });

    this.emitLicenseEvent(studentId, {
      type: 'license.changed',
      reason: 'updated',
    });

    return updated;
  }

  async regenerateExistingForStudent(
    studentId: string,
    dto: { institution: string; bus: string; photo?: string },
    employeeId: string,
    licenseValidityMonths = 6,
    cardContext?: { cardNote?: string | null; accessBusIdentifiers?: string[] },
  ): Promise<License> {
    const existing = await this.licenseRepository.findOneByStudentId(studentId);
    if (!existing) {
      throw new NotFoundException(`Licença do estudante ${studentId} não encontrada`);
    }

    const student = await this.studentService.findOneOrFail(studentId);

    const verificationCode = randomUUID();
    const qrCodeUrl = `${this.qrCodeBaseUrl}/${verificationCode}`;

    const normalizedPhoto = this.normalizePhotoForLicenseApi(dto.photo);
    if (normalizedPhoto && normalizedPhoto.length > this.MAX_PHOTO_SIZE_BYTES) {
      throw new BadRequestException('Foto excede o tamanho máximo permitido de 5MB');
    }

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
      photo: normalizedPhoto,
      qr_code_url: qrCodeUrl,
      card_note: cardContext?.cardNote ?? null,
      access_bus_identifiers: cardContext?.accessBusIdentifiers ?? [dto.bus],
      study_schedule: this.buildStudySchedule(student),
    };

    const data = await this.callLicenseApi(payload);

    const existingId = (existing as any)._id.toString();
    const updated = await this.licenseRepository.update(existingId, {
      employeeId,
      imageLicense: data.image,
      status: LicenseStatus.ACTIVE,
      existing: true,
      expirationDate: addMonthsBR(nowInBR(), licenseValidityMonths),
      verificationCode,
      qrCodeUrl,
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

  emitLicenseEvent(
    studentId: string,
    payload: {
      type: 'license.changed';
      reason:
        | 'created'
        | 'updated'
        | 'removed'
        | 'rejected'
        | 'waitlist_promoted';
    },
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

    this.streamLastActivity.set(studentId, Date.now());
  }

  private buildStudySchedule(student: any): string[] | undefined {
    const selections: Array<{ day?: string; period?: string }> = student?.schedule ?? [];
    if (!Array.isArray(selections) || selections.length === 0) return undefined;

    const grouped: Record<string, Set<string>> = {};
    for (const s of selections) {
      const day = (s.day ?? '').toString();
      const period = (s.period ?? '').toString();
      if (!day) continue;
      if (!grouped[day]) grouped[day] = new Set<string>();
      grouped[day].add(period || '');
    }

    const order = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];
    const result: string[] = [];
    for (const d of order) {
      const periods = grouped[d];
      if (!periods) continue;
      const dayLabel = this.DAY_LABELS[d] ?? d;
      if (periods.size > 1) {
        result.push(`${dayLabel} Integral`);
      } else {
        const p = Array.from(periods)[0];
        if (!p) continue;
        result.push(`${dayLabel} ${p}`);
      }
    }

    return result.length > 0 ? result : undefined;
  }

  private async ensureRateLimit(): Promise<void> {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // circuito aberto? aborta rápido
    if (Date.now() < this.circuitOpenUntil) {
      throw new HttpException('Serviço de licenças temporariamente indisponível (circuit open)', 503);
    }

    const start = Date.now();
    const deadline = start + this.throttleWaitMs;

    while (Date.now() <= deadline) {
      const now = Date.now();
      // refill coarse (a cada interval)
      if (now - this.tokenBucketLastRefill >= this.tokenBucketRefillIntervalMs) {
        this.tokenBucketTokens = this.tokenBucketCapacity;
        this.tokenBucketLastRefill = now;
      }

      if (this.tokenBucketTokens > 0) {
        this.tokenBucketTokens -= 1;
        return;
      }

      const timeUntilRefill = this.tokenBucketRefillIntervalMs - (now - this.tokenBucketLastRefill);
      const wait = Math.min(Math.max(timeUntilRefill, 50), deadline - Date.now());
      if (wait > 0) await sleep(wait);
      else break;
    }

    // sem token dentro do tempo máximo de espera
    throw new HttpException('Limite de requisições local atingido, tente novamente mais tarde', 429);
  }

  private cleanupStaleStreams(): void {
    const now = Date.now();

    for (const [studentId, lastActivity] of this.streamLastActivity.entries()) {
      if (now - lastActivity > this.STREAM_TTL_MS) {
        const stream = this.studentStreams.get(studentId);
        if (stream && !stream.observed) {
          stream.complete();
          this.studentStreams.delete(studentId);
          this.streamLastActivity.delete(studentId);
        }
      }
    }
  }


  private async callLicenseApi(payload: Record<string, unknown>) {
    const maxAttempts = Number(this.configService.get('LICENSE_API_MAX_ATTEMPTS', 3));
    const baseDelay = Number(this.configService.get('LICENSE_API_RETRY_BASE_MS', 200));
    const maxDelay = Number(this.configService.get('LICENSE_API_RETRY_MAX_MS', 2000));
    const timeoutMs = Number(this.configService.get('LICENSE_API_TIMEOUT_MS', 5000));

    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

    const parseRetryAfter = (h: string | null): number | null => {
      if (!h) return null;
      const seconds = Number(h);
      if (!Number.isNaN(seconds)) return seconds * 1000;
      const t = Date.parse(h);
      if (!Number.isNaN(t)) return Math.max(0, t - Date.now());
      return null;
    };

    const idempotencyKey = randomUUID();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // aplica token-bucket e valida circuito (ensureRateLimit faz a checagem do circuito)
      await this.ensureRateLimit();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${this.apiUrl}/api/v1/license/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': this.apiKey,
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const getBodyText = async (r: any) => {
            if (!r) return '';
            try {
              if (typeof r.text === 'function') return await r.text();
              if (typeof r.json === 'function') {
                const j = await r.json();
                return typeof j === 'string' ? j : JSON.stringify(j);
              }
              if (typeof r.body === 'string') return r.body;
            } catch (_) {}
            return '';
          };

          const text = await getBodyText(response);
          let parsed: any = null;
          try {
            parsed = JSON.parse(text);
          } catch (_) {
            parsed = null;
          }

          this.logger.error(
            `License API error (attempt ${attempt}/${maxAttempts}): ${response.status} ${response.statusText} body=${text}`,
          );

          const retryableStatuses = [429, 500, 502, 503, 504];
          const isRetryable = retryableStatuses.includes(response.status);

          if (isRetryable && attempt < maxAttempts) {
            const ra = parseRetryAfter(response.headers.get('retry-after'));
            const backoff = Math.min(maxDelay, baseDelay * 2 ** (attempt - 1));
            const waitMs = ra ?? Math.floor(Math.random() * backoff);
            await sleep(waitMs);
            continue; // retry
          }

          // não retryable ou última tentativa: contabiliza falha e lança exceção mapeada
          try {
            this.circuitFailureCount += 1;
            if (this.circuitFailureCount >= this.circuitBreakerThreshold) {
              this.circuitOpenUntil = Date.now() + this.circuitOpenMs;
              this.logger.warn('Circuit-breaker ativado para License API por falhas repetidas');
            }
          } catch (_) {}

          switch (response.status) {
            case 400:
              throw new BadRequestException(parsed?.message ?? 'Requisição inválida ao serviço de licenças');
            case 401:
              throw new UnauthorizedException(parsed?.message ?? 'Não autorizado');
            case 403:
              throw new ForbiddenException(parsed?.message ?? 'Acesso negado');
            case 413:
              throw new BadRequestException(parsed?.message ?? 'Payload muito grande');
            case 429:
              throw new HttpException(parsed?.message ?? 'Limite de requisições atingido', 429);
            default:
              throw new BadGatewayException('Erro ao comunicar com o serviço de licenças');
          }
        }

        // sucesso: reseta contador do circuito e trata multipart ou JSON
        try { this.circuitFailureCount = 0; } catch (_) {}

        const getHeaderValue = (r: any, name: string) => {
          if (!r || !r.headers) return '';
          try {
            if (typeof r.headers.get === 'function') return r.headers.get(name) || '';
            if (typeof r.headers[name] === 'string') return r.headers[name];
            const hn = Object.keys(r.headers).find((k) => k.toLowerCase() === name.toLowerCase());
            if (hn) return (r.headers as any)[hn];
          } catch (_) {}
          return '';
        };

        const contentType = getHeaderValue(response, 'content-type') || '';
        if (contentType.includes('multipart/form-data')) {
          const m = contentType.match(/boundary=(?:"?)([^;\"]+)(?:"?)/i);
          const boundary = m ? m[1] : null;
          if (!boundary) {
            throw new BadGatewayException('Resposta multipart inválida do serviço de licenças');
          }

          const arrayBuf = await response.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          const boundaryBuf = Buffer.from(`--${boundary}`);

          const partStart = buf.indexOf(boundaryBuf);
          if (partStart === -1) throw new BadGatewayException('Resposta multipart inválida do serviço de licenças');

          // Move para começo da primeira parte
          let cursor = partStart + boundaryBuf.length + 2; // skip CRLF
          const headerEnd = buf.indexOf(Buffer.from('\r\n\r\n'), cursor);
          if (headerEnd === -1) throw new BadGatewayException('Resposta multipart inválida do serviço de licenças');

          const contentStart = headerEnd + 4;
          const nextBoundary = buf.indexOf(boundaryBuf, contentStart);
          if (nextBoundary === -1) throw new BadGatewayException('Resposta multipart inválida do serviço de licenças');

          const contentEnd = nextBoundary - 2; // remove trailing CRLF
          const fileBuf = buf.slice(contentStart, contentEnd);

          const base64 = fileBuf.toString('base64');
          return { image: base64 };
        }

        return response.json();
      } catch (err: any) {
        // network / timeout errors -> retry quando possível
        if ((err instanceof Error && err.name === 'AbortError') || err instanceof TypeError) {
          if (attempt < maxAttempts) {
            const backoff = Math.min(maxDelay, baseDelay * 2 ** (attempt - 1));
            const waitMs = Math.floor(Math.random() * backoff);
            await sleep(waitMs);
            continue;
          }

          if (err instanceof Error && err.name === 'AbortError') {
            try {
              this.circuitFailureCount += 1;
              if (this.circuitFailureCount >= this.circuitBreakerThreshold) {
                this.circuitOpenUntil = Date.now() + this.circuitOpenMs;
                this.logger.warn('Circuit-breaker ativado para License API por falhas repetidas');
              }
            } catch (_) {}

            throw new GatewayTimeoutException('Serviço de licenças indisponível');
          }
        }

        try {
          this.circuitFailureCount += 1;
          if (this.circuitFailureCount >= this.circuitBreakerThreshold) {
            this.circuitOpenUntil = Date.now() + this.circuitOpenMs;
            this.logger.warn('Circuit-breaker ativado para License API por falhas repetidas');
          }
        } catch (_) {}

        throw err instanceof Error ? err : new BadGatewayException('Erro ao comunicar com o serviço de licenças');
      } finally {
        clearTimeout(timer);
      }
    }

    // se atingir aqui, não foi possível comunicar após tentativas
    throw new BadGatewayException('Erro ao comunicar com o serviço de licenças');
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
