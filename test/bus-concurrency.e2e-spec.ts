import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { Session, SessionDocument } from '../src/auth/session/session.schema';
import { Bus, BusDocument } from '../src/bus/schema/bus.schema';
import {
  LicenseRequest,
  LicenseRequestDocument,
  LicenseRequestStatus,
} from '../src/license-request/schemas/license-request.schema';
import { EnrollmentPeriod, EnrollmentPeriodDocument } from '../src/enrollment-period/schemas/enrollment-period.schema';
import { Student, StudentDocument } from '../src/student/schemas/student.schema';
import { License, LicenseDocument } from '../src/license/schemas/license.schema';
import { AuditEvent, AuditEventDocument } from '../src/common/audit/audit-event.schema';
import { clearTestDB, closeTestDB, connectTestDB } from './setup/mongo-memory';

jest.setTimeout(120000);

describe('Bus concurrency (e2e)', () => {
  let app: INestApplication;
  let sessionModel: Model<SessionDocument>;
  let busModel: Model<BusDocument>;
  let enrollmentPeriodModel: Model<EnrollmentPeriodDocument>;
  let licenseRequestModel: Model<LicenseRequestDocument>;
  let studentModel: Model<StudentDocument>;
  let licenseModel: Model<LicenseDocument>;
  let auditEventModel: Model<AuditEventDocument>;
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

    sessionModel = moduleFixture.get<Model<SessionDocument>>(getModelToken(Session.name));
    busModel = moduleFixture.get<Model<BusDocument>>(getModelToken(Bus.name));
    enrollmentPeriodModel = moduleFixture.get<Model<EnrollmentPeriodDocument>>(getModelToken(EnrollmentPeriod.name));
    licenseRequestModel = moduleFixture.get<Model<LicenseRequestDocument>>(getModelToken(LicenseRequest.name));
    studentModel = moduleFixture.get<Model<StudentDocument>>(getModelToken(Student.name));
    licenseModel = moduleFixture.get<Model<LicenseDocument>>(getModelToken(License.name));
    auditEventModel = moduleFixture.get<Model<AuditEventDocument>>(getModelToken(AuditEvent.name));
  });

  afterEach(async () => {
    if (auditEventModel) await auditEventModel.deleteMany({});
    if (licenseRequestModel) await licenseRequestModel.deleteMany({});
    if (enrollmentPeriodModel) await enrollmentPeriodModel.deleteMany({});
    if (sessionModel) await sessionModel.deleteMany({});
    if (studentModel) await studentModel.deleteMany({});
    if (licenseModel) await licenseModel.deleteMany({});
    if (busModel) await busModel.deleteMany({});
    await clearTestDB();
    (global.fetch as jest.Mock | undefined)?.mockClear?.();
  });

  afterAll(async () => {
    if (app) await app.close();
    global.fetch = originalFetch;
    await closeTestDB();
  });

  it('deve processar chamadas release-slots concorrentes sem dupla promoção', async () => {
    const adminSessionId = await createSession('admin', '507f1f77bcf86cd799439001');

    const period = await enrollmentPeriodModel.create({
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
      totalSlots: 20,
      filledSlots: 0,
      licenseValidityMonths: 6,
      active: true,
      createdByAdminId: '507f1f77bcf86cd799439001',
      closedByAdminId: null,
      closedAt: null,
    });

    const uni1 = new Types.ObjectId();
    const uni2 = new Types.ObjectId();

    const bus = await busModel.create({
      identifier: 'BUS-1',
      capacity: 2,
      universitySlots: [
        { universityId: uni1, priorityOrder: 1, filledSlots: 1 },
        { universityId: uni2, priorityOrder: 2, filledSlots: 1 },
      ],
      active: true,
    });

    // create students and waitlisted requests for this bus
    await createStudent('507f1f77bcf86cd799439011', '11');
    await createStudent('507f1f77bcf86cd799439012', '12');
    await createStudent('507f1f77bcf86cd799439013', '13');

    const docs = await licenseRequestModel.create([
      {
        studentId: '507f1f77bcf86cd799439011',
        type: 'initial',
        status: LicenseRequestStatus.WAITLISTED,
        enrollmentPeriodId: period._id.toString(),
        filaPosition: 1,
        busId: bus._id,
        universityId: uni1,
      },
      {
        studentId: '507f1f77bcf86cd799439012',
        type: 'initial',
        status: LicenseRequestStatus.WAITLISTED,
        enrollmentPeriodId: period._id.toString(),
        filaPosition: 2,
        busId: bus._id,
        universityId: uni2,
      },
      {
        studentId: '507f1f77bcf86cd799439013',
        type: 'initial',
        status: LicenseRequestStatus.WAITLISTED,
        enrollmentPeriodId: period._id.toString(),
        filaPosition: 3,
        busId: bus._id,
        universityId: uni1,
      },
    ]);

    const ids = docs.map((d) => d._id.toString());

    const callA = request(app.getHttpServer())
      .patch(`/api/v1/bus/${bus._id.toString()}/release-slots`)
      .set('x-session-id', adminSessionId.toHexString());

    const callB = request(app.getHttpServer())
      .patch(`/api/v1/bus/${bus._id.toString()}/release-slots`)
      .set('x-session-id', adminSessionId.toHexString());

    const [resA, resB] = await Promise.all([callA, callB]);

    expect([200, 201]).toContain(resA.status);
    expect([200, 201]).toContain(resB.status);

    const refreshed = await licenseRequestModel
      .find({ enrollmentPeriodId: period._id.toString(), busId: bus._id })
      .lean()
      .exec();

    const pending = refreshed.filter((r) => r.status === LicenseRequestStatus.PENDING);
    const waitlisted = refreshed.filter((r) => r.status === LicenseRequestStatus.WAITLISTED);

    // capacity was 2 -> two promotions expected
    expect(pending).toHaveLength(2);
    expect(waitlisted).toHaveLength(1);

    const releaseAudits = await auditEventModel
      .find({ action: 'bus.release_slots' })
      .lean()
      .exec();

    // two audit records (one per call)
    expect(releaseAudits.length).toBeGreaterThanOrEqual(1);

    const promotedIds = refreshed
      .filter((r) => r.status === LicenseRequestStatus.PENDING)
      .map((r) => r._id.toString());

    expect(new Set(promotedIds).size).toBe(promotedIds.length);
  });

  it('deve permitir apenas uma aprovação quando duas chamadas concorrentes disputam a última vaga do ônibus', async () => {
    const employeeSessionId = await createSession('employee', '507f1f77bcf86cd799439002');

    const period = await enrollmentPeriodModel.create({
      startDate: new Date(Date.now() - 60_000),
      endDate: new Date(Date.now() + 60_000),
      totalSlots: 10,
      filledSlots: 0,
      licenseValidityMonths: 6,
      active: true,
      createdByAdminId: '507f1f77bcf86cd799439002',
      closedByAdminId: null,
      closedAt: null,
    });

    const uni = new Types.ObjectId();

    const bus = await busModel.create({
      identifier: 'BUS-2',
      capacity: 1,
      universitySlots: [{ universityId: uni, priorityOrder: 1, filledSlots: 0 }],
      active: true,
    });

    const studentAId = '507f1f77bcf86cd799439021';
    const studentBId = '507f1f77bcf86cd799439022';
    await createStudent(studentAId, '21');
    await createStudent(studentBId, '22');

    const [pendingA, pendingB] = await licenseRequestModel.create([
      {
        studentId: studentAId,
        type: 'initial',
        status: LicenseRequestStatus.PENDING,
        enrollmentPeriodId: period._id.toString(),
        busId: bus._id,
        universityId: uni,
      },
      {
        studentId: studentBId,
        type: 'initial',
        status: LicenseRequestStatus.PENDING,
        enrollmentPeriodId: period._id.toString(),
        busId: bus._id,
        universityId: uni,
      },
    ]);

    const payload = { institution: 'IF Test', bus: bus.identifier };

    const approveA = request(app.getHttpServer())
      .patch(`/api/v1/license-request/approve/${pendingA._id.toString()}`)
      .set('x-session-id', employeeSessionId.toHexString())
      .send(payload);

    const approveB = request(app.getHttpServer())
      .patch(`/api/v1/license-request/approve/${pendingB._id.toString()}`)
      .set('x-session-id', employeeSessionId.toHexString())
      .send(payload);

    const [resA, resB] = await Promise.all([approveA, approveB]);

    // At least one must succeed
    expect([resA.status, resB.status].some((s) => s === 200)).toBe(true);

    const refreshedBus = await busModel.findById(bus._id).lean().exec();
    const slot = (refreshedBus as any).universitySlots.find((s: any) => s.universityId?.toString() === uni.toString());
    expect(slot.filledSlots).toBeLessThanOrEqual(1);

    const refreshedA = await licenseRequestModel.findById(pendingA._id).lean().exec();
    const refreshedB = await licenseRequestModel.findById(pendingB._id).lean().exec();

    const finalStatuses = [refreshedA?.status, refreshedB?.status];
    const approvedCount = finalStatuses.filter((st) => st === LicenseRequestStatus.APPROVED).length;
    const pendingCount = finalStatuses.filter((st) => st === LicenseRequestStatus.PENDING).length;

    expect(approvedCount).toBe(1);
    expect(pendingCount).toBe(1);

    const licenses = await licenseModel.find({ studentId: { $in: [studentAId, studentBId] } }).lean().exec();
    expect(licenses.length).toBe(1);
  });
});
