import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { StudentService } from '../../student/student.service';
import { EmployeeService } from '../../employee/employee.service';
import { AdminService } from '../../admin/admin.service';

import { JwtPayload, AuthenticatedUser } from '../interfaces/auth.interface';
import { AUTH_ERROR_MESSAGES } from '../constants/auth.constants';
import { UserRole } from '../../common/interfaces/user-roles.enum';
import { StudentStatus } from '../../student/schemas/student.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly studentService: StudentService,
    private readonly employeeService: EmployeeService,
    private readonly adminService: AdminService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const { sub, role, identifier, tokenUse } = payload;

    if (tokenUse !== 'access') {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
    }

    let displayName = '';

    try {
      switch (role) {
        case UserRole.STUDENT: {
          const student = await this.studentService.findById(sub);

          if (
            !student ||
            student.status !== StudentStatus.ACTIVE ||
            student.email !== identifier
          ) {
            throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
          }

          displayName = student.name;
          break;
        }

        case UserRole.EMPLOYEE: {
          const employee = await this.employeeService.findById(sub);

          if (
            !employee ||
            !employee.active ||
            employee.registrationId !== identifier
          ) {
            throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
          }

          displayName = employee.name;
          break;
        }

        case UserRole.ADMIN: {
          const admin = await this.adminService.findById(sub);

          if (!admin || admin.username !== identifier) {
            throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
          }

          displayName = admin.username;
          break;
        }

        default:
          throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;

      this.logger.error(
        `Unexpected error validating JWT for ${identifier} (${role}): ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
    }

    return { id: sub, role, identifier, name: displayName };
  }
}