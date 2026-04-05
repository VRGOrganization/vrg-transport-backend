import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './services/token.service';
import { CookieService } from './services/cookie.service';

import { StudentModule } from '../student/student.module';
import { EmployeeModule } from '../employee/employee.module';
import { AdminModule } from '../admin/admin.module';
import { MailModule } from '../mail/mail.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    CommonModule,
    StudentModule,
    EmployeeModule,
    AdminModule,
    MailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // JwtModule configurado apenas para access tokens.
    // O refresh token usa secret e expiresIn separados,
    // passados diretamente no signAsync() dentro do TokenService.
    // Isso garante que os dois tokens nunca compartilhem o mesmo secret.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.getOrThrow<string>('JWT_EXPIRES_IN') as StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Serviços especializados — separação de responsabilidades:
    // TokenService: emissão e verificação de JWTs
    // CookieService: ciclo de vida do cookie HTTP-only
    TokenService,
    CookieService,
  ],
  exports: [
    JwtModule,
    // Exporta CookieService caso outros módulos precisem limpar o cookie
    // (ex: um futuro módulo de admin que force logout de usuários)
    CookieService,
  ],
})
export class AuthModule {}