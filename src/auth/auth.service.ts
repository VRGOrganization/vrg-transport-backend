import { 
  Injectable, 
  UnauthorizedException, 
  ConflictException,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload, LoginResponse } from './interfaces/auth.interface';
import { AUTH_ERROR_MESSAGES } from './constants/auth.constants';
import { UserRole } from '../common/interfaces/user-roles.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 10;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    try {
      this.logger.debug(`Validating user with email: ${email}`);
      
      // Busca o usuário pelo email
      const users = await this.usersService.findAll();
      const user = users.find(u => u.email === email);
      
      if (!user) {
        this.logger.warn(`User not found with email: ${email}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error validating user: ${error.message}`);
      throw error;
    }
  }

  async login(loginDto: LoginDto): Promise<LoginResponse> {
    try {
      this.logger.log(`Login attempt for email: ${loginDto.email}`);

      // Valida as credenciais do usuário
      const user = await this.validateUser(loginDto.email, loginDto.password);
      
      if (!user) {
        this.logger.warn(`Failed login attempt for email: ${loginDto.email}`);
        throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
      }

      // Cria o payload do JWT
      const payload: JwtPayload = {
        
        email: user.email,
        role: user.role || UserRole.STUDENT, // Role padrão se não existir
      };

      // Gera o token JWT
      const access_token = this.jwtService.sign(payload);

      this.logger.log(`User logged in successfully: ${user.email} (${payload.role})`);

      // Retorna a resposta formatada
      return {
        access_token,
        user: {
          email: user.email,
          name: user.name,
          role: payload.role,
        },
      };
    } catch (error) {
      this.logger.error(`Login error: ${error.message}`);
      throw error;
    }
  }

  async register(registerDto: RegisterDto): Promise<LoginResponse> {
    try {
      this.logger.log(`Registration attempt for email: ${registerDto.email}`);

      // Verifica se o email já está em uso
      const existingUsers = await this.usersService.findAll();
      const userExists = existingUsers.some(u => u.email === registerDto.email);
      
      if (userExists) {
        this.logger.warn(`Registration failed - email already exists: ${registerDto.email}`);
        throw new ConflictException(AUTH_ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(registerDto.password, this.SALT_ROUNDS);

      // Define o role padrão se não fornecido
      const userRole = registerDto.role || UserRole.STUDENT;

      // Cria o objeto do usuário para salvar
      const userToCreate = {
        name: registerDto.name,
        email: registerDto.email,
        password: hashedPassword,
        role: userRole,
        createdAt: new Date(),
      };

      // Salva o usuário no banco
      const createdUser = await this.usersService.create(userToCreate as any);

      this.logger.log(`User registered successfully: ${createdUser.email} (${userRole})`);

      // Cria o payload do JWT
      const payload: JwtPayload = {
        email: createdUser.email,
        role: userRole,
      };

      // Gera o token JWT
      const access_token = this.jwtService.sign(payload);

      // Retorna a resposta formatada com o usuário criado
      return {
        access_token,
        user: {
          email: createdUser.email,
          name: createdUser.name,
          role: userRole,
        },
      };
    } catch (error) {
      this.logger.error(`Registration error: ${error.message}`);
      
      // Se já é uma exceção conhecida, apenas repassa
      if (error instanceof ConflictException || error instanceof UnauthorizedException) {
        throw error;
      }
      
      // Para outros erros, lança uma exceção genérica
      throw new Error('Error during registration. Please try again.');
    }
  }
}