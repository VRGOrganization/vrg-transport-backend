import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { LicenseService } from './license.service';
import { CreateLicenseDto } from './dto/create-license.dto';
import { UpdateLicenseDto } from './dto/update-license.dto';

@Controller('license')
export class LicenseController {
  constructor(
    private readonly licenseService: LicenseService
  ) {}

  @Post()
  create(@Body() createLicenseDto: CreateLicenseDto) {
    try{
      const l = this.licenseService.create(createLicenseDto);
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

  @Get()
  findAll() {
    return this.licenseService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.licenseService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLicenseDto: UpdateLicenseDto) {
    return this.licenseService.update(+id, updateLicenseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.licenseService.remove(+id);
  }

  


}
