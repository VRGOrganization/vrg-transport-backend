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
import { UpdateLicenseDto } from './dto/update-license.dto';

@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Post('/create')
  async create(@Body() createLicenseDto: CreateLicenseDto) {
    try {
      const l = await this.licenseService.create(createLicenseDto);
      if (!l) {
        return {
          statusCode: 400,
          message: 'Failed to create license',
        };
      }
      return {
        statusCode: 201,
        message: 'License created successfully',
        data: l,
      };
    } catch (error) {
      return {
        statusCode: 500,
        message: 'Internal server error',
        error: error.message,
      };
    }
  }

  @Get('/health')
  checkHealth() {
    return this.licenseService.checkHealth();
  }

  @Get('/all')
  async getAllLicenses() {
    try {
      const licenses = await this.licenseService.getAll();
      return {
        statusCode: 200,
        message: 'Licenses retrieved successfully',
        data: licenses,
      };
    } catch (error) {
      return {
        statusCode: 500,
        message: 'Internal server error',
        error: error.message,
      };
    }
  }

  @Get('/search/:id')
  async findLicenseByStudent(@Param('id') id: string) {
    try {
      const l = await this.licenseService.getLicenseByStudentId(id);
      return {
        statusCode: 200,
        message: 'License found successfully',
        data: l,
      };
    } catch (error) {
      return {
        statusCode: 404,
        message: 'License not found for student ID: ' + id,
      };
    }
  }

  @Delete('/remove/:id')
  async removeLicense(@Param('id') id: string) {
    try {
      const result = await this.licenseService.remove(id);
      if (result) {
        return {
          statusCode: 200,
          message: 'License removed successfully',
        };
      } else {
        return {
          statusCode: 404,
          message: 'License not found for ID: ' + id,
        };
      }
    } catch (error) {
      return {
        statusCode: 500,
        message: 'Internal server error',
        error: error.message,
      };
    }
  }


  @Patch('/update/:id')
  async updateLicense(@Param('id') id: string, @Body() CreateLicenseDto: CreateLicenseDto) {
    try {
      const result = await this.licenseService.update(id, CreateLicenseDto);
      if (result) {
        return {
          statusCode: 200,
          message: 'License updated successfully',
          data: result,
        };
      } else {
        return {
          statusCode: 404,
          message: 'License not found for ID: ' + id,
        };
      }
    } catch (error) {
      return {
        statusCode: 500,
        message: 'Internal server error',
        error: error.message,
      };
    }
  }
}
