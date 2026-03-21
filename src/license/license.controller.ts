import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LicenseService } from './license.service';
import { CreateLicenseDto } from './dto/create-license.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';

@Controller('license')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.EMPLOYEE, UserRole.ADMIN)
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Post('/create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateLicenseDto, @CurrentUser() user: any) {
    return this.licenseService.create(dto, user.id);
  }

  @Get('/health')
  @Roles(UserRole.ADMIN)
  checkHealth() {
    return this.licenseService.checkHealth();
  }

  @Get('/all')
  async findAll() {
    return this.licenseService.getAll();
  }

  @Get('/searchByStudent/:studentId')
  async findByStudent(@Param('studentId') studentId: string) {
    return this.licenseService.getLicenseByStudentId(studentId);
  }

  @Get('/:id')
  async findOne(@Param('id') id: string) {
    return this.licenseService.getLicenseById(id);
  }

  @Patch('/update/:id')
  async update(
    @Param('id') id: string,
    @Body() dto: CreateLicenseDto,
    @CurrentUser() user: any,
  ) {
    return this.licenseService.update(id, dto, user.id);
  }

  @Delete('/delete/:id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.licenseService.remove(id);
  }
}
