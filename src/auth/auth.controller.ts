import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import {
  StudentLoginDto,
  EmployeeLoginDto,
  AdminLoginDto,
  RegisterStudentDto,
  VerifyEmailDto,
  ResendCodeDto,
} from './dto/auth.dto';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';

import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { RateLimit } from './decorators/rate-limit.decorator';
import { ServiceSecretGuard } from './guards/service-secret.guard';

import { UserRole } from '../common/interfaces/user-roles.enum';
import type {
  SessionAuthResponse,
  LogoutResponse,
  SessionRequestContext,
} from './interfaces/auth.interface';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(ServiceSecretGuard, RateLimitGuard)
@ApiHeader({
  name: 'x-service-secret',
  required: true,
  description: 'Segredo compartilhado entre BFF e backend. Nunca enviar pelo browser.',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @RateLimit({ points: 20, windowMs: 60_000, keyPrefix: 'auth:register' })
  @Post('student/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new student' })
  @ApiBody({ type: RegisterStudentDto })
  @ApiResponse({ status: 201, description: 'Student registered successfully.' })
  @ApiResponse({ status: 409, description: 'E-mail already registered.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  registerStudent(
    @Body() dto: RegisterStudentDto,
  ): Promise<{ message: string; isInstitutional: boolean }> {
    return this.authService.registerStudent(dto);
  }

  @Public()
  @RateLimit({ points: 5, windowMs: 60_000, keyPrefix: 'auth:verify' })
  @Post('student/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify student email via OTP and create server session' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: 'Session created. Returns sessionId for BFF cookie write.' })
  @ApiResponse({ status: 400, description: 'Account already active.' })
  @ApiResponse({ status: 401, description: 'Invalid or expired code.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  verifyStudentEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
  ): Promise<SessionAuthResponse> {
    return this.authService.verifyStudentEmail(dto, this.buildSessionContext(req));
  }

  @Public()
  @RateLimit({ points: 3, windowMs: 60_000, keyPrefix: 'auth:resend' })
  @Post('student/resend-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification code' })
  @ApiBody({ type: ResendCodeDto })
  @ApiResponse({ status: 200, description: 'Code sent if applicable.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  resendVerificationCode(
    @Body() dto: ResendCodeDto,
  ): Promise<{ message: string }> {
    return this.authService.resendVerificationCode(dto);
  }

  @Public()
  @RateLimit({ points: 5, windowMs: 60_000, keyPrefix: 'auth:student-login' })
  @Post('student/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Student login and session creation' })
  @ApiBody({ type: StudentLoginDto })
  @ApiResponse({ status: 200, description: 'Session created. Returns sessionId for BFF cookie write.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  loginStudent(
    @Body() dto: StudentLoginDto,
    @Req() req: Request,
  ): Promise<SessionAuthResponse> {
    return this.authService.loginStudent(dto, this.buildSessionContext(req));
  }

  @Public()
  @RateLimit({ points: 5, windowMs: 60_000, keyPrefix: 'auth:employee-login' })
  @Post('employee/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Employee login and session creation' })
  @ApiBody({ type: EmployeeLoginDto })
  @ApiResponse({ status: 200, description: 'Session created. Returns sessionId for BFF cookie write.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  loginEmployee(
    @Body() dto: EmployeeLoginDto,
    @Req() req: Request,
  ): Promise<SessionAuthResponse> {
    return this.authService.loginEmployee(dto, this.buildSessionContext(req));
  }

  @Public()
  @RateLimit({ points: 3, windowMs: 60_000, keyPrefix: 'auth:admin-login' })
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login and session creation' })
  @ApiBody({ type: AdminLoginDto })
  @ApiResponse({ status: 200, description: 'Session created. Returns sessionId for BFF cookie write.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Too many requests.' })
  loginAdmin(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
  ): Promise<SessionAuthResponse> {
    return this.authService.loginAdmin(dto, this.buildSessionContext(req));
  }

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user profile from session' })
  @ApiResponse({ status: 200, description: 'Session profile.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getMe(@Req() req: Request) {
    const { userId, userType } = req.sessionPayload!;
    return { userId, userType };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Idempotent logout — always returns success' })
  @ApiResponse({ status: 200, description: 'Logged out.' })
  logout(@Req() req: Request): Promise<LogoutResponse> {
    return this.authService.logout(this.extractSessionId(req));
  }

  @Get('admin/dashboard')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin dashboard — restricted' })
  @ApiResponse({ status: 200, description: 'Access granted.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  adminDashboard(@Req() req: Request): { message: string; admin: string } {
    return { message: 'Admin Dashboard', admin: req.sessionPayload!.userId };
  }

  private buildSessionContext(req: Request): SessionRequestContext {
    const userAgent = req.headers['user-agent'];

    return {
      ...(typeof userAgent === 'string' ? { userAgent } : {}),
      ...(req.ip ? { ipAddress: req.ip } : {}),
    };
  }

  private extractSessionId(req: Request): string | undefined {
    const value = req.headers['x-session-id'];
    return typeof value === 'string' && value.trim() ? value : undefined;
  }
}
