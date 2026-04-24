import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { StudentModule } from './student/student.module';
import { EmployeeModule } from './employee/employee.module';
import { AdminModule } from './admin/admin.module';
import { LicenseModule } from './license/license.module';
import { ImagesModule } from './image/image.module';
import { MailModule } from './mail/mail.module';
import { SessionModule } from './auth/session/session.module';
import { LicenseRequestModule } from './license-request/license-request.module';
import { EnrollmentPeriodModule } from './enrollment-period/enrollment-period.module';

import { SessionAuthGuard } from './auth/guards/session-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { RateLimitGuard } from './auth/guards/rate-limit.guard';
import { CommonModule } from './common/common.module';
import { validateSecurityConfig } from './common/config/security.validation';


import { UniversityModule } from './university/university.module';
import { CourseModule } from './course/course.module';
import { BusModule } from './bus/bus.module';
import { BusRouteModule } from './bus-route/bus-route.module';
import { SchedulerModule } from './scheduler/scheduler.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
      validate: validateSecurityConfig,
      ignoreEnvFile: process.env.IGNORE_ENV_FILE === 'true',
    }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        uri: c.getOrThrow('MONGODB_URI'),
      }),
    }),
    MongooseModule.forRootAsync({
      connectionName: 'images',
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        uri: c.getOrThrow('MONGODB_URI_IMAGE'),
      }),
    }),
    AuthModule,
    StudentModule,
    EmployeeModule,
    AdminModule,
    LicenseModule,
    ImagesModule,
    MailModule,
    SessionModule,
    LicenseRequestModule,
    EnrollmentPeriodModule,
    SchedulerModule,
    CommonModule,
    UniversityModule,
    CourseModule,
    BusModule,
    BusRouteModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guards globais
    // Ordem importa: RateLimitGuard deve rodar primeiro; SessionAuthGuard antes do RolesGuard.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    // RolesGuard verifica o role apenas nas rotas com @Roles().
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
