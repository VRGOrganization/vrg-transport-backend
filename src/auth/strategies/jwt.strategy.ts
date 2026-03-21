import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, AuthenticatedUser } from '../interfaces/auth.interface';
import { StudentService } from '../../student/student.service';
import { EmployeeService } from '../../employee/employee.service';
import { AdminService } from '../../admin/admin.service';
import { AUTH_ERROR_MESSAGES } from '../constants/auth.constants';
import { UserRole } from '../../common/interfaces/user-roles.enum';
import { StudentStatus } from '../../student/schemas/student.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private studentService: StudentService,
    private employeeService: EmployeeService,
    private adminService: AdminService,
  ) {
    const jwtSecret = configService.getOrThrow<string>('JWT_SECRET');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const { sub, role, identifier } = payload;

    try {
      switch (role) {
        case UserRole.STUDENT: {
          const student = await this.studentService.findByEmail(identifier);
          if (!student || student.status !== StudentStatus.ACTIVE) {
            throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
          }
          break;
        }

        case UserRole.EMPLOYEE: {
          const employee = await this.employeeService.findByMatricula(identifier);
          if (!employee || !employee.active) {
            throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
          }
          break;
        }

        case UserRole.ADMIN: {
          const admin = await this.adminService.findByUsername(identifier);
          if (!admin) {
            throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
          }
          break;
        }

        default:
          throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(
        `Error validating JWT for ${identifier} (${role}): ${err.message}`,
        err.stack,
      );
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
    }

    return { id: sub, role, identifier };
  }
}
