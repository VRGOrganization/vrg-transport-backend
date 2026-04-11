import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { Session, SessionDocument } from '../src/auth/session/session.schema';
import {
  EnrollmentPeriod,
  EnrollmentPeriodDocument,
} from '../src/enrollment-period/schemas/enrollment-period.schema';
import {
  LicenseRequest,
  LicenseRequestDocument,
  LicenseRequestStatus,
} from '../src/license-request/schemas/license-request.schema';
import {
  AuditEvent,
  AuditEventDocument,
} from '../src/common/audit/audit-event.schema';
import { Student, StudentDocument } from '../src/student/schemas/student.schema';
import { License, LicenseDocument } from '../src/license/schemas/license.schema';
import { clearTestDB, closeTestDB, connectTestDB } from './setup/mongo-memory';

jest.setTimeout(120000);

describe('EnrollmentPeriod concurrency (e2e)', () => {
  let app: INestApplication<App>;
  let sessionModel: Model<SessionDocument>;
  let enrollmentPeriodModel: Model<EnrollmentPeriodDocument>;
  let licenseRequestModel: Model<LicenseRequestDocument>;
  let auditEventModel: Model<AuditEventDocument>;
  let studentModel: Model<StudentDocument>;
  let licenseModel: Model<LicenseDocument>;
  let originalFetch: typeof global.fetch;

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
    process.env.SERVICE_SECRET = 'test-service-secret-32-chars-minimum';
    process.env.SESSION_TTL_DAYS = '7';
    process.env.SESSION_TTL_STUDENT_DAYS = '7';
    process.env.SESSION_TTL_STAFF_DAYS = '7';
  };

  const createStudent = async (id: string, suffix: string): Promise<void> => {
    await studentModel.create({
      _id: new Types.ObjectId(id),
      name: `Aluno ${suffix}`,
      email: `aluno.${suffix}@test.local`,
      cpfHash: `cpfhash-${suffix}`,
      password: 'hash-senha',
      telephone: `1199999${suffix.padStart(4, '0')}`,
    });
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
    originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ image: 'license-image-base64' }),
      text: async () => 'ok',
    })) as typeof global.fetch;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppModule } = require('../src/app.module');

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
    enrollmentPeriodModel = moduleFixture.get<Model<EnrollmentPeriodDocument>>(
      getModelToken(EnrollmentPeriod.name),
    );
    licenseRequestModel = moduleFixture.get<Model<LicenseRequestDocument>>(
      getModelToken(LicenseRequest.name),
    );
    auditEventModel = moduleFixture.get<Model<AuditEventDocument>>(
      getModelToken(AuditEvent.name),
    );
    studentModel = moduleFixture.get<Model<StudentDocument>>(
      getModelToken(Student.name),
    );
    licenseModel = moduleFixture.get<Model<LicenseDocument>>(
      getModelToken(License.name),
    );
  });

  afterEach(async () => {
    if (auditEventModel) {
      await auditEventModel.deleteMany({});
    }
    if (licenseRequestModel) {
      await licenseRequestModel.deleteMany({});
    }
    if (enrollmentPeriodModel) {
      await enrollmentPeriodModel.deleteMany({});
    }
    if (sessionModel) {
      await sessionModel.deleteMany({});
    }
    if (studentModel) {
      await studentModel.deleteMany({});
    }
    if (licenseModel) {
      await licenseModel.deleteMany({});
    }
    await clearTestDB();
    (global.fetch as jest.Mock | undefined)?.mockClear?.();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    global.fetch = originalFetch;
    await closeTestDB();
  });

  it('deve rejeitar confirm-release com IDs duplicados', async () => {
    const adminSessionId = await createSession('admin', '507f1f77bcf86cd799439051');

    const period = await enrollmentPeriodModel.create({
      dataInicio: new Date(Date.now() - 60_000),
      dataFim: new Date(Date.now() + 60_000),
      qtdVagasTotais: 10,
      qtdVagasPreenchidas: 0,
      validadeCarteirinhaMeses: 6,
      ativo: true,
      criadoPorAdminId: '507f1f77bcf86cd799439051',
      encerradoPorAdminId: null,
      encerradoEm: null,
    });

    const requestDoc = await licenseRequestModel.create({
      studentId: '507f1f77bcf86cd799439061',
      type: 'initial',
      status: LicenseRequestStatus.WAITLISTED,
      enrollmentPeriodId: period._id.toString(),
      filaPosition: 1,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/enrollment-period/${period._id.toString()}/confirm-release`)
      .set('x-session-id', adminSessionId.toHexString())
      .send({ requestIds: [requestDoc._id.toString(), requestDoc._id.toString()] })
      .expect(400);
  });

  it('deve processar lotes sobrepostos sem dupla promocao em corrida', async () => {
    const adminSessionId = await createSession('admin', '507f1f77bcf86cd799439052');

    const period = await enrollmentPeriodModel.create({
      dataInicio: new Date(Date.now() - 60_000),
      dataFim: new Date(Date.now() + 60_000),
      qtdVagasTotais: 20,
      qtdVagasPreenchidas: 0,
      validadeCarteirinhaMeses: 6,
      ativo: true,
      criadoPorAdminId: '507f1f77bcf86cd799439052',
      encerradoPorAdminId: null,
      encerradoEm: null,
    });

    const docs = await licenseRequestModel.create([
      {
        studentId: '507f1f77bcf86cd799439071',
        type: 'initial',
        status: LicenseRequestStatus.WAITLISTED,
        enrollmentPeriodId: period._id.toString(),
        filaPosition: 1,
      },
      {
        studentId: '507f1f77bcf86cd799439072',
        type: 'initial',
        status: LicenseRequestStatus.WAITLISTED,
        enrollmentPeriodId: period._id.toString(),
        filaPosition: 2,
      },
      {
        studentId: '507f1f77bcf86cd799439073',
        type: 'initial',
        status: LicenseRequestStatus.WAITLISTED,
        enrollmentPeriodId: period._id.toString(),
        filaPosition: 3,
      },
      {
        studentId: '507f1f77bcf86cd799439074',
        type: 'initial',
        status: LicenseRequestStatus.WAITLISTED,
        enrollmentPeriodId: period._id.toString(),
        filaPosition: 4,
      },
      {
        studentId: '507f1f77bcf86cd799439075',
        type: 'initial',
        status: LicenseRequestStatus.WAITLISTED,
        enrollmentPeriodId: period._id.toString(),
        filaPosition: 5,
      },
    ]);

    const ids = docs.map((doc) => doc._id.toString());

    const callA = request(app.getHttpServer())
      .post(`/api/v1/enrollment-period/${period._id.toString()}/confirm-release`)
      .set('x-session-id', adminSessionId.toHexString())
      .send({ requestIds: [ids[0], ids[1], ids[2]] });

    const callB = request(app.getHttpServer())
      .post(`/api/v1/enrollment-period/${period._id.toString()}/confirm-release`)
      .set('x-session-id', adminSessionId.toHexString())
      .send({ requestIds: [ids[2], ids[3]] });

    const [resA, resB] = await Promise.all([callA, callB]);

    expect([200, 201]).toContain(resA.status);
    expect([200, 201]).toContain(resB.status);

    const refreshed = await licenseRequestModel
      .find({ enrollmentPeriodId: period._id.toString() })
      .lean()
      .exec();

    const pending = refreshed.filter((doc) => doc.status === LicenseRequestStatus.PENDING);
    const waitlisted = refreshed.filter(
      (doc) => doc.status === LicenseRequestStatus.WAITLISTED,
    );

    expect(pending).toHaveLength(4);
    expect(waitlisted).toHaveLength(1);
    expect(waitlisted[0].studentId).toBe('507f1f77bcf86cd799439075');
    expect(waitlisted[0].filaPosition).toBe(1);

    const releaseAudits = await auditEventModel
      .find({ action: 'enrollment_period.release_slots' })
      .lean()
      .exec();

    expect(releaseAudits).toHaveLength(2);

    const releasedIds = releaseAudits.flatMap((audit) => {
      const metadata = (audit.metadata ?? {}) as { releasedRequestIds?: string[] };
      return metadata.releasedRequestIds ?? [];
    });

    expect(releasedIds.length).toBeGreaterThanOrEqual(4);
    expect(new Set(releasedIds).size).toBe(releasedIds.length);
  });

  it('deve permitir apenas uma aprovacao quando duas chamadas concorrentes disputam a ultima vaga', async () => {
    const employeeSessionId = await createSession(
      'employee',
      '507f1f77bcf86cd799439053',
    );

    const period = await enrollmentPeriodModel.create({
      dataInicio: new Date(Date.now() - 60_000),
      dataFim: new Date(Date.now() + 60_000),
      qtdVagasTotais: 1,
      qtdVagasPreenchidas: 0,
      validadeCarteirinhaMeses: 6,
      ativo: true,
      criadoPorAdminId: '507f1f77bcf86cd799439053',
      encerradoPorAdminId: null,
      encerradoEm: null,
    });

    const studentAId = '507f1f77bcf86cd799439081';
    const studentBId = '507f1f77bcf86cd799439082';
    await createStudent(studentAId, '81');
    await createStudent(studentBId, '82');

    await licenseRequestModel.create([
      {
        studentId: studentAId,
        type: 'initial',
        status: LicenseRequestStatus.APPROVED,
        enrollmentPeriodId: period._id.toString(),
        licenseId: 'legacy-license-a',
      },
      {
        studentId: studentBId,
        type: 'initial',
        status: LicenseRequestStatus.APPROVED,
        enrollmentPeriodId: period._id.toString(),
        licenseId: 'legacy-license-b',
      },
    ]);

    const [pendingA, pendingB] = await licenseRequestModel.create([
      {
        studentId: studentAId,
        type: 'initial',
        status: LicenseRequestStatus.PENDING,
        enrollmentPeriodId: period._id.toString(),
      },
      {
        studentId: studentBId,
        type: 'initial',
        status: LicenseRequestStatus.PENDING,
        enrollmentPeriodId: period._id.toString(),
      },
    ]);

    const payload = { institution: 'IF Test', bus: 'A01' };

    const approveA = request(app.getHttpServer())
      .patch(`/api/v1/license-request/approve/${pendingA._id.toString()}`)
      .set('x-session-id', employeeSessionId.toHexString())
      .send(payload);

    const approveB = request(app.getHttpServer())
      .patch(`/api/v1/license-request/approve/${pendingB._id.toString()}`)
      .set('x-session-id', employeeSessionId.toHexString())
      .send(payload);

    const [resA, resB] = await Promise.all([approveA, approveB]);
    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const refreshedPeriod = await enrollmentPeriodModel
      .findById(period._id)
      .lean()
      .exec();
    expect(refreshedPeriod?.qtdVagasPreenchidas).toBe(1);

    const refreshedA = await licenseRequestModel
      .findById(pendingA._id)
      .lean()
      .exec();
    const refreshedB = await licenseRequestModel
      .findById(pendingB._id)
      .lean()
      .exec();

    const finalStatuses = [refreshedA?.status, refreshedB?.status];
    const approvedCount = finalStatuses.filter(
      (status) => status === LicenseRequestStatus.APPROVED,
    ).length;
    const pendingCount = finalStatuses.filter(
      (status) => status === LicenseRequestStatus.PENDING,
    ).length;

    expect(approvedCount).toBe(1);
    expect(pendingCount).toBe(1);

    const licenses = await licenseModel
      .find({ studentId: { $in: [studentAId, studentBId] } })
      .lean()
      .exec();
    expect(licenses).toHaveLength(1);
    expect((global.fetch as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  it('deve retornar 409 em ambas aprovacoes concorrentes quando o periodo ja comeca lotado', async () => {
    const employeeSessionId = await createSession(
      'employee',
      '507f1f77bcf86cd799439054',
    );

    const period = await enrollmentPeriodModel.create({
      dataInicio: new Date(Date.now() - 60_000),
      dataFim: new Date(Date.now() + 60_000),
      qtdVagasTotais: 1,
      qtdVagasPreenchidas: 1,
      validadeCarteirinhaMeses: 6,
      ativo: true,
      criadoPorAdminId: '507f1f77bcf86cd799439054',
      encerradoPorAdminId: null,
      encerradoEm: null,
    });

    const studentAId = '507f1f77bcf86cd799439091';
    const studentBId = '507f1f77bcf86cd799439092';
    await createStudent(studentAId, '91');
    await createStudent(studentBId, '92');

    const [pendingA, pendingB] = await licenseRequestModel.create([
      {
        studentId: studentAId,
        type: 'initial',
        status: LicenseRequestStatus.PENDING,
        enrollmentPeriodId: period._id.toString(),
      },
      {
        studentId: studentBId,
        type: 'initial',
        status: LicenseRequestStatus.PENDING,
        enrollmentPeriodId: period._id.toString(),
      },
    ]);

    const payload = { institution: 'IF Test', bus: 'A01' };

    const approveA = request(app.getHttpServer())
      .patch(`/api/v1/license-request/approve/${pendingA._id.toString()}`)
      .set('x-session-id', employeeSessionId.toHexString())
      .send(payload);

    const approveB = request(app.getHttpServer())
      .patch(`/api/v1/license-request/approve/${pendingB._id.toString()}`)
      .set('x-session-id', employeeSessionId.toHexString())
      .send(payload);

    const [resA, resB] = await Promise.all([approveA, approveB]);
    expect(resA.status).toBe(409);
    expect(resB.status).toBe(409);

    const refreshedPeriod = await enrollmentPeriodModel
      .findById(period._id)
      .lean()
      .exec();
    expect(refreshedPeriod?.qtdVagasPreenchidas).toBe(1);

    const refreshedA = await licenseRequestModel
      .findById(pendingA._id)
      .lean()
      .exec();
    const refreshedB = await licenseRequestModel
      .findById(pendingB._id)
      .lean()
      .exec();

    expect(refreshedA?.status).toBe(LicenseRequestStatus.PENDING);
    expect(refreshedB?.status).toBe(LicenseRequestStatus.PENDING);

    const licenses = await licenseModel
      .find({ studentId: { $in: [studentAId, studentBId] } })
      .lean()
      .exec();
    expect(licenses).toHaveLength(0);
    expect((global.fetch as jest.Mock)).not.toHaveBeenCalled();
  });
});
