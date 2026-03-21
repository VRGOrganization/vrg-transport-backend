import {Module} from '@nestjs/common';
import {MongooseModule} from '@nestjs/mongoose';
import {AdminService} from './admin.service';
import {Admin, AdminSchema} from './schema/admin.schema';
import e from 'express';

@Module({
  imports: [MongooseModule.forFeature([{ name: Admin.name, schema: AdminSchema }])],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}