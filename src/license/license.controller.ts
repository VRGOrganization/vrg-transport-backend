import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { LicenseService } from './license.service';
import { CreateLicenseDto } from './dto/create-license.dto';

@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Post('/create')
  async create(@Body() createLicenseDto: CreateLicenseDto) {
    return await this.licenseService.create(createLicenseDto);
    
  }

  @Get('/health')
  checkHealth() {
    return this.licenseService.checkHealth();
  }

  @Get('/all')
  async getAllLicenses() {
    return this.licenseService.getAll();
  }

  @Get('/search/:id')
  async findLicenseByStudent(@Param('id') id: string) {
    return this.licenseService.getLicenseByStudentId(id);

  }

  @Delete('/remove/:id')
  async removeLicense(@Param('id') id: string) {
    return this.licenseService.remove(id);
    
  }

  @Patch('/update/:id')
  async updateLicense(@Param('id') id: string, @Body() CreateLicenseDto: CreateLicenseDto) {
    return this.licenseService.update(id, CreateLicenseDto);
  }
}
