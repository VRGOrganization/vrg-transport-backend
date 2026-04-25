import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { MongoObjectIdPipe } from '../common/pipes/mongo-object-id.pipe';
import {
  ApproveLicenseRequestDto,
  RejectLicenseRequestDto,
} from './dto/license-request.dto';
import { LicenseRequestService } from './license-request.service';

@ApiTags('LicenseRequests')
@Controller('license-request')
export class LicenseRequestController {
  constructor(private readonly service: LicenseRequestService) {}

  @Get('/all')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  findAll() {
    return this.service.findAll();
  }

  @Get('/pending')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  findPending() {
    return this.service.findPending();
  }

  @Get('/me')
  @Roles(UserRole.STUDENT)
  findMine(@Req() req: Request) {
    return this.service.findMyLatest(req.sessionPayload!.userId);
  }

  @Get('/student/:studentId')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  findByStudent(@Param('studentId', MongoObjectIdPipe) studentId: string) {
    return this.service.findByStudentId(studentId);
  }

  @Patch('/approve/:id')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  approve(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: ApproveLicenseRequestDto,
    @Req() req: Request,
  ) {
    return this.service.approve(id, req.sessionPayload!.userId, dto);
  }

  @Patch('/reject/:id')
  @Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
  reject(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: RejectLicenseRequestDto,
    @Req() req: Request,
  ) {
    return this.service.reject(id, req.sessionPayload!.userId, dto.reason);
  }
}
