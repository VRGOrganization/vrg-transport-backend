import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './user/user.module';
import { ImagesModule } from './image/image.module';
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
      process.env.MONGODB_URI || `mongodb+srv://vrgsolutions3_db_user:${process.env.DBPASSWORD}@vrg-transport.w8zzjnd.mongodb.net/Transport-Api?appName=Vrg-Transport`,
        
    ),
    MongooseModule.forRoot(
      process.env.MONGODB_URI_IMAGE || `mongodb+srv://vrgsolutions3_db_user:${process.env.DBPASSWORD}@vrg-transport.w8zzjnd.mongodb.net/transport-images?appName=Vrg-Transport`,
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
