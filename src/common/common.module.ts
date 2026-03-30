import { Module } from '@nestjs/common';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';
import { APP_GUARD } from '@nestjs/core';
import { AuditLogService } from './audit/audit-log.service';

import { MongooseModule } from '@nestjs/mongoose';
import { AuditEvent, AuditEventSchema } from './audit/audit-event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditEvent.name, schema: AuditEventSchema },
    ]),
  ],
  providers: [
    AuditLogService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
  exports: [AuditLogService],
})
export class CommonModule {}
