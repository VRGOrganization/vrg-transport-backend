import { Module } from '@nestjs/common';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionModule } from './session/session.module';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { ServiceSecretGuard } from './guards/service-secret.guard';

import { StudentModule } from '../student/student.module';
import { EmployeeModule } from '../employee/employee.module';
import { AdminModule } from '../admin/admin.module';
import { MailModule } from '../mail/mail.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    CommonModule,
    StudentModule,
    EmployeeModule,
    AdminModule,
    MailModule,
    SessionModule,
    PasswordResetModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ServiceSecretGuard,
  ],
  exports: [SessionModule],
})
export class AuthModule {}
