import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'crypto';
import { AuditEvent, AuditEventDocument } from './audit-event.schema';

export interface AuditActor {
  id?: string;
  role?: string;
  identifier?: string;
}

export interface AuditEventPayload {
  action: string;
  outcome: 'success' | 'failure';
  actor?: AuditActor | null;
  target?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEYS = new Set([
  'email',
  'username',
  'identifier',
  'registrationId',
  'telephone',
  'phone',
  'code',
  'password',
  'refreshToken',
  'refresh_token',
]);

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function redact(value: unknown, key?: string): unknown {
  if (typeof value === 'string' && key && SENSITIVE_KEYS.has(key)) {
    return `hash:${hashValue(value)}`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        redact(v, k),
      ]),
    );
  }

  return value;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectModel(AuditEvent.name)
    private readonly auditEventModel: Model<AuditEventDocument>,
  ) {}

  async record(event: AuditEventPayload): Promise<void> {
    const payload = redact(event) as Record<string, unknown>;

    // 🔒 Persistência real (principal)
    await this.auditEventModel.create(payload);

    // 🔍 Log auxiliar
    this.logger.log(JSON.stringify(payload));
  }
}
