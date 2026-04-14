import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PasswordResetService } from './password-reset.service';
import { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
import { PasswordResetToken, PasswordResetTokenSchema } from './schemas/password-reset-token.schema';
import { StudentModule } from '../../student/student.module';
import { SessionModule } from '../session/session.module';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PasswordResetToken.name, schema: PasswordResetTokenSchema },
    ]),
    StudentModule,
    SessionModule,
    MailModule,
  ],
  providers: [PasswordResetService, PasswordResetTokenRepository],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
