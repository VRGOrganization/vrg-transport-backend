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
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

/**
 * Gestão de employees — exclusivo para admin.
 * Employee não tem rota de auto-cadastro: é criado pelo admin.
 */

@ApiTags('Employees')
@Controller('employee')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @ApiOperation({ summary: 'Create employee', description: 'Creates a new employee. Exclusive to admin.' })
  @ApiBody({ type: CreateEmployeeDto })
  @ApiResponse({ status: 201, description: 'Employee created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid data.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires ADMIN role).' })
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeeService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List employees', description: 'Returns a list of all registered employees.' })
  @ApiResponse({ status: 200, description: 'List of employees.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires ADMIN role).' })
  findAll() {
    return this.employeeService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find employee by ID', description: 'Returns the data of a specific employee.' })
  @ApiParam({ name: 'id', description: 'Employee ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Employee data.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires ADMIN role).' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  findOne(@Param('id') id: string) {
    return this.employeeService.findOneOrFail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update employee by ID', description: 'Updates the data of a specific employee.' })
  @ApiParam({ name: 'id', description: 'Employee ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiBody({ type: UpdateEmployeeDto })
  @ApiResponse({ status: 200, description: 'Employee updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid data.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires ADMIN role).' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeeService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate employee', description: 'Deactivates (soft delete) the employee by ID.' })
  @ApiParam({ name: 'id', description: 'Employee ID (MongoDB ObjectId)', example: '6650a1f2c3d4e5f6a7b8c9d0' })
  @ApiResponse({ status: 200, description: 'Employee deactivated successfully.' })
  @ApiResponse({ status: 401, description: 'NNot authenticated.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires ADMIN role).' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  deactivate(@Param('id') id: string) {
    return this.employeeService.deactivate(id);
  }
}
