import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { StudentModule } from './student/student.module';
import { EmployeeModule } from './employee/employee.module';
import { AdminModule } from './admin/admin.module';
import { LicenseModule } from './license/license.module';
import { ImagesModule } from './image/image.module';
import { MailModule } from './mail/mail.module';

import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI ||
        `mongodb+srv://vrgsolutions3_db_user:${process.env.DBPASSWORD}@vrg-transport.w8zzjnd.mongodb.net/Transport-Api?appName=Vrg-Transport`,
    ),
    MongooseModule.forRoot(
      process.env.MONGODB_URI_IMAGE ||
        `mongodb+srv://vrgsolutions3_db_user:${process.env.DBPASSWORD}@vrg-transport.w8zzjnd.mongodb.net/transport-images?appName=Vrg-Transport`,
      { connectionName: 'images' },
    ),
    AuthModule,
    StudentModule,
    EmployeeModule,
    AdminModule,
    LicenseModule,
    ImagesModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guards globais: JwtAuthGuard verifica o token em todas as rotas.
    // Rotas públicas usam @Public() para sair do guard.
    // RolesGuard verifica o role apenas nas rotas com @Roles().
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
