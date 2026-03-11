import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './user/user.module';
import { ImagesModule } from './images/images.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StudentModule } from './student/student.module';
import { EmployeeModule } from './employee/employee.module';
import { LicenseModule } from './license/license.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI ||
        `mongodb://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_HOST || 'localhost'}:${process.env.MONGODB_PORT || '27017'}/${process.env.MONGODB_DATABASE}?authSource=admin`,
    ),
    MongooseModule.forRoot(
      process.env.MONGODB_IMAGE_URI ||
        `mongodb://${process.env.MONGODB_IMAGE_USER}:${process.env.MONGODB_IMAGE_PASSWORD}@${process.env.MONGODB_IMAGE_HOST || 'localhost'}:${process.env.MONGODB_IMAGE_PORT || '27018'}/${process.env.MONGODB_IMAGE_DATABASE}?authSource=admin`,
      {
        connectionName: 'images',
      },
    ),
    ImagesModule,
    UsersModule,
    StudentModule,
    EmployeeModule,
    LicenseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
