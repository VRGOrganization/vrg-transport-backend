import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LicenseService } from './license.service';
import { CreateLicenseDto } from './dto/create-license.dto';
import { UpdateLicenseDto } from './dto/update-license.dto';

@Controller('license')
export class LicenseController {
  constructor(
    private readonly licenseService: LicenseService
  ) {}

  @Post('/create')
  async create(@Body() createLicenseDto: CreateLicenseDto) {
    try{
      const l = await this.licenseService.create(createLicenseDto);
      if(!l){
        return {
          statusCode: 400,
          message: 'Failed to create license'
        }
      }
      return {
        statusCode: 201,
        message: 'License created successfully',
        data: l
      }
    }
    catch(error){
      return {
        statusCode: 500,
        message: 'Internal server error',
        error: error.message
      }
    }
    
  }

  @Get('health')
  checkHealth() {
    return this.licenseService.checkHealth();
  }

  
  


}
