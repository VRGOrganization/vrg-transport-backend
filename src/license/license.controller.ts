import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpException,
  HttpStatus,
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
        throw new HttpException(
          {
            statusCode: 400,
            message: 'Failed to create license',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      return {
        statusCode: 201,
        message: 'License created successfully',
        data: l,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Internal server error';
      throw new HttpException(
        {
          statusCode: 500,
          message: 'Internal server error',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
      const errorMessage =
        error instanceof Error ? error.message : 'Internal server error';
      throw new HttpException(
        {
          statusCode: 500,
          message: 'Internal server error',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
      throw new HttpException(
        {
          statusCode: 404,
          message: 'License not found for student ID: ' + id,
        },
        HttpStatus.NOT_FOUND,
      );
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
        throw new HttpException(
          {
            statusCode: 404,
            message: 'License not found for ID: ' + id,
          },
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Internal server error';
      throw new HttpException(
        {
          statusCode: 500,
          message: 'Internal server error',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch('/update/:id')
  async updateLicense(
    @Param('id') id: string,
    @Body() CreateLicenseDto: CreateLicenseDto,
  ) {
    try {
      const result = await this.licenseService.update(id, CreateLicenseDto);
      if (result) {
        return {
          statusCode: 200,
          message: 'License updated successfully',
          data: result,
        };
      } else {
        throw new HttpException(
          {
            statusCode: 404,
            message: 'License not found for ID: ' + id,
          },
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Internal server error';
      throw new HttpException(
        {
          statusCode: 500,
          message: 'Internal server error',
          error: errorMessage,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
