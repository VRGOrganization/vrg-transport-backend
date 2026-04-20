import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { MongoObjectIdPipe } from '../common/pipes/mongo-object-id.pipe';
import { CreateEnrollmentPeriodDto, UpdateEnrollmentPeriodDto } from './dto/enrollment-period.dto';
import { EnrollmentPeriodService } from './enrollment-period.service';

@ApiTags('EnrollmentPeriods')
@Controller('enrollment-period')
export class EnrollmentPeriodController {
  constructor(private readonly service: EnrollmentPeriodService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateEnrollmentPeriodDto, @Req() req: Request) {
    return this.service.create(dto, req.sessionPayload!.userId);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.service.findAll();
  }

  @Get('/active')
  @Roles(UserRole.ADMIN, UserRole.EMPLOYEE, UserRole.STUDENT)
  findActive() {
    return this.service.getActiveOrFail();
  }

  @Patch('/:id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: UpdateEnrollmentPeriodDto,
  ) {
    return this.service.update(id, dto);
  }

  @Patch('/:id/close')
  @Roles(UserRole.ADMIN)
  close(@Param('id', MongoObjectIdPipe) id: string, @Req() req: Request) {
    return this.service.close(id, req.sessionPayload!.userId);
  }

  @Patch('/:id/reopen')
  @Roles(UserRole.ADMIN)
  reopen(@Param('id', MongoObjectIdPipe) id: string) {
    return this.service.reopen(id);
  }

  @Get('/:id/waitlist')
  @Roles(UserRole.ADMIN)
  getWaitlist(@Param('id', MongoObjectIdPipe) id: string) {
    return this.service.findWaitlisted(id);
  }

  // Release and promotion are now handled per-bus via PATCH /bus/:id/release-slots
}
