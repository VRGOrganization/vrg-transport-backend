import { Module } from '@nestjs/common';
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
  ],
  exports: [AuditLogService],
})
export class CommonModule {}
