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
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './dto/create-employee.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/interfaces/user-roles.enum';
import { MongoObjectIdPipe } from '../common/pipes/mongo-object-id.pipe';
import { ApiBody, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employee')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @ApiOperation({ summary: 'Create employee (admin only)' })
  @ApiBody({ type: CreateEmployeeDto })
  @ApiResponse({ status: 201, description: 'Employee created.' })
  @ApiResponse({ status: 409, description: 'Email or matricula already exists.' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeeService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all employees' })
  @ApiResponse({ status: 200, description: 'List of employees.' })
  findAll() {
    return this.employeeService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find employee by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Employee data.' })
  @ApiResponse({ status: 400, description: 'Invalid ID.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  findOne(@Param('id', MongoObjectIdPipe) id: string) {
    return this.employeeService.findOneOrFail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update employee by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiBody({ type: UpdateEmployeeDto })
  @ApiResponse({ status: 200, description: 'Employee updated.' })
  @ApiResponse({ status: 400, description: 'Invalid data or ID.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  update(
    @Param('id', MongoObjectIdPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeeService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate employee (soft delete)' })
  @ApiParam({ name: 'id', description: 'MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Employee deactivated.' })
  @ApiResponse({ status: 400, description: 'Invalid ID.' })
  @ApiResponse({ status: 404, description: 'Not found.' })
  deactivate(@Param('id', MongoObjectIdPipe) id: string) {
    return this.employeeService.deactivate(id);
  }
}