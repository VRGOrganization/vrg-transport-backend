import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  StudentLoginDto,
  EmployeeLoginDto,
  AdminLoginDto,
  RegisterStudentDto,
  VerifyEmailDto,
  ResendCodeDto,
  RefreshTokenDto,
} from './dto/auth.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { UserRole } from '../common/interfaces/user-roles.enum';
import type { AuthenticatedUser } from './interfaces/auth.interface';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RateLimit } from './decorators/rate-limit.decorator';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @RateLimit({ points: 3, windowMs: 60_000, keyPrefix: 'auth:register' })
  @Post('student/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new student' })
  @ApiBody({ type: RegisterStudentDto })
  @ApiResponse({ status: 201, description: 'Student registered successfully.' })
  @ApiResponse({ status: 409, description: 'E-mail already registered.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  registerStudent(@Body() dto: RegisterStudentDto) {
    return this.authService.registerStudent(dto);
  }

  @Public()
  @RateLimit({ points: 5, windowMs: 60_000, keyPrefix: 'auth:verify' })
  @Post('student/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify student email via OTP' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: 'Email verified.' })
  @ApiResponse({ status: 401, description: 'Invalid or expired code.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  verifyStudentEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyStudentEmail(dto);
  }

  @Public()
  @RateLimit({ points: 3, windowMs: 60_000, keyPrefix: 'auth:resend' })
  @Post('student/resend-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification code' })
  @ApiBody({ type: ResendCodeDto })
  @ApiResponse({ status: 200, description: 'Code sent if applicable.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  resendVerificationCode(@Body() dto: ResendCodeDto) {
    return this.authService.resendVerificationCode(dto);
  }

  @Public()
  @RateLimit({ points: 5, windowMs: 60_000, keyPrefix: 'auth:student-login' })
  @Post('student/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Student login' })
  @ApiBody({ type: StudentLoginDto })
  @ApiResponse({ status: 200, description: 'Login successful.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  loginStudent(@Body() dto: StudentLoginDto) {
    return this.authService.loginStudent(dto);
  }

  @Public()
  @RateLimit({ points: 5, windowMs: 60_000, keyPrefix: 'auth:employee-login' })
  @Post('employee/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Employee login' })
  @ApiBody({ type: EmployeeLoginDto })
  @ApiResponse({ status: 200, description: 'Login successful.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  loginEmployee(@Body() dto: EmployeeLoginDto) {
    return this.authService.loginEmployee(dto);
  }

  @Public()
  @RateLimit({ points: 3, windowMs: 60_000, keyPrefix: 'auth:admin-login' })
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login' })
  @ApiBody({ type: AdminLoginDto })
  @ApiResponse({ status: 200, description: 'Login successful.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  loginAdmin(@Body() dto: AdminLoginDto) {
    return this.authService.loginAdmin(dto);
  }

  @Public()
  @RateLimit({ points: 10, windowMs: 60_000, keyPrefix: 'auth:refresh' })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh session tokens' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'New token pair issued.' })
  @ApiResponse({ status: 401, description: 'Invalid or revoked refresh token.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — revokes refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user);
  }

  @Get('admin/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin dashboard — restricted' })
  @ApiResponse({ status: 200, description: 'Access granted.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  adminDashboard(@CurrentUser() user: AuthenticatedUser) {
    return { message: 'Admin Dashboard', admin: user.identifier };
  }
}