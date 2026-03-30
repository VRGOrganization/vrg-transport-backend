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

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const { sub, role, identifier, tokenUse } = payload;

    //Rejeita qualquer token que não seja de acesso, impede uso direto de refresh tokens (ex: refresh tokens)
    if(tokenUse !== 'access') throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);

    //Valida o usuário com base no papel e identificador (email/matrícula/username)
    try {
      switch (role) {
        //Valida o estudante, verifica se o status é ativo e se o email corresponde ao do token
        case UserRole.STUDENT: {
          const student = await this.studentService.findById(sub)
          if (
            !student || 
            student.status !== StudentStatus.ACTIVE || 
            student.email !== identifier
          ) {
            throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
          }
          break;
        }

        //Valida o funcionário, verifica se a matrícula corresponde ao do token e se o funcionário está ativo
        case UserRole.EMPLOYEE: {
          const employee = await this.employeeService.findById(sub);
          if (
            !employee || 
            !employee.active ||
            employee.registrationId !== identifier
          ) {
            throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_TOKEN);
          }
          break;
        }

        //Valida o admin, verifica se o username corresponde ao do token
        case UserRole.ADMIN: {
          const admin = await this.adminService.findById(sub);
          if (!admin || admin.username !== identifier) {
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
