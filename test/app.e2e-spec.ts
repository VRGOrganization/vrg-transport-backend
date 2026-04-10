import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import {
  AuthMeResponseSchema,
  HttpErrorResponseSchema,
} from '../src/contracts/auth.contract';
import { Session, SessionDocument } from '../src/auth/session/session.schema';
import { Employee, EmployeeDocument } from '../src/employee/schema/employee.schema';
import { clearTestDB, closeTestDB, connectTestDB } from './setup/mongo-memory';

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn().mockResolvedValue({
    mime: 'image/jpeg',
    ext: 'jpg',
  }),
}), { virtual: true });

jest.setTimeout(120000);

describe('App security e contracts (e2e)', () => {
  let app: INestApplication<App>;
  let sessionModel: Model<SessionDocument>;
  let employeeModel: Model<EmployeeDocument>;

  const serviceSecret = 'test-service-secret-32-chars-minimum';

  const setRequiredEnv = (mongoUri: string) => {
    process.env.NODE_ENV = 'test';
    process.env.OTP_PEPPER = 'otp-pepper-secret-1234';
    process.env.CPF_HMAC_SECRET = 'cpf-hmac-secret-1234';
    process.env.MONGODB_URI = mongoUri;
    process.env.MONGODB_URI_IMAGE = mongoUri;
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001';
    process.env.LICENSE_API_URL = 'http://localhost:4000';
    process.env.LICENSE_API_KEY = 'license-api-key';
    process.env.QR_CODE_BASE_URL = 'http://localhost:3000/verify';
    process.env.BREVO_API_KEY = 'brevo-api-key-123456';
    process.env.MAIL_FROM_ADDRESS = 'noreply@test.local';
    process.env.SERVICE_SECRET = serviceSecret;
    process.env.SESSION_TTL_DAYS = '7';
  };

  const createSession = async (
    userType: 'admin' | 'employee' | 'student',
    userId: string,
  ): Promise<Types.ObjectId> => {
    const sessionId = new Types.ObjectId();
    const now = new Date();

    await sessionModel.create({
      _id: sessionId,
      userId,
      userType,
      userAgent: 'jest-e2e',
      ipAddress: '127.0.0.1',
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      lastSeenAt: now,
      revoked: false,
      revokedAt: null,
      version: 0,
    });

    return sessionId;
  };

  beforeAll(async () => {
    const mongoUri = await connectTestDB();
    setRequiredEnv(mongoUri);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppModule } = require('./../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    sessionModel = moduleFixture.get<Model<SessionDocument>>(
      getModelToken(Session.name),
    );
    employeeModel = moduleFixture.get<Model<EmployeeDocument>>(
      getModelToken(Employee.name),
    );
  });

  afterEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await closeTestDB();
  });

  it('deve responder healthcheck quando rota raiz e consultada', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });

  it('deve retornar 400 quando payload de login de estudante e invalido', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/student/login')
      .set('x-service-secret', serviceSecret)
      .send({ email: 'email-invalido' })
      .expect(400);

    expect(() => HttpErrorResponseSchema.parse(response.body)).not.toThrow();
  });

  it('deve retornar 401 quando endpoint /auth/me e chamado sem sessao', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('x-service-secret', serviceSecret)
      .expect(401);

    expect(() => HttpErrorResponseSchema.parse(response.body)).not.toThrow();
  });

  it('deve retornar 401 quando login e chamado sem x-service-secret', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/student/login')
      .send({ email: 'student@test.com', password: 'Senha123' })
      .expect(401);

    expect(() => HttpErrorResponseSchema.parse(response.body)).not.toThrow();
  });

  it('deve retornar 401 quando x-session-id e invalido em rota protegida', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/employee')
      .set('x-session-id', 'sessao-invalida')
      .expect(401);

    expect(() => HttpErrorResponseSchema.parse(response.body)).not.toThrow();
  });

  it('deve retornar 403 quando employee acessa endpoint admin-only', async () => {
    const employeeSessionId = await createSession(
      'employee',
      '507f1f77bcf86cd799439012',
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/employee')
      .set('x-session-id', employeeSessionId.toHexString())
      .expect(403);

    expect(() => HttpErrorResponseSchema.parse(response.body)).not.toThrow();
  });

  it('deve ocultar password no retorno de listagem de employees para admin', async () => {
    const adminSessionId = await createSession(
      'admin',
      '507f1f77bcf86cd799439013',
    );

    await employeeModel.create({
      name: 'Funcionario Teste',
      email: 'funcionario.teste@vrg.local',
      registrationId: 'MAT900001',
      password: 'hash-seguro',
      active: true,
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/employee')
      .set('x-session-id', adminSessionId.toHexString())
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).not.toHaveProperty('password');
  });

  it('deve retornar contrato valido e sem _id/__v quando sessao e valida', async () => {
    const sessionId = new Types.ObjectId();
    const now = new Date();

    await sessionModel.create({
      _id: sessionId,
      userId: '507f1f77bcf86cd799439011',
      userType: 'admin',
      userAgent: 'vitest',
      ipAddress: '127.0.0.1',
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      lastSeenAt: now,
      revoked: false,
      revokedAt: null,
      version: 0,
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('x-service-secret', serviceSecret)
      .set('x-session-id', sessionId.toHexString())
      .expect(200);

    expect(() => AuthMeResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body).not.toHaveProperty('_id');
    expect(response.body).not.toHaveProperty('__v');
  });
});
