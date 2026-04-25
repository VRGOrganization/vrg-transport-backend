import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { jest } from '@jest/globals';

import { LicenseRequest, LicenseRequestSchema } from './schemas/license-request.schema';
import { LicenseRequestService } from './license-request.service';
import { LICENSE_REQUEST_REPOSITORY } from './interfaces/repository.interface';
import { LicenseRequestRepository } from './repository/license-request.repository';
import { EnrollmentPeriodService } from '../enrollment-period/enrollment-period.service';
import { StudentService } from '../student/student.service';
import { BusService } from '../bus/bus.service';
import { MailService } from '../mail/mail.service';
import { ImagesService } from '../image/image.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { LicenseService } from '../license/license.service';

jest.setTimeout(30000);

describe('LicenseRequest concurrency E2E', () => {
  let mongod: MongoMemoryReplSet;
  let service: LicenseRequestService;
  let repo: any;

  beforeAll(async () => {
    // usar replSet em memória para suportar transações (session.withTransaction)
    mongod = await MongoMemoryReplSet.create({ replSet: { storageEngine: 'wiredTiger' } });
    const uri = mongod.getUri();

    // Conecta o mongoose manualmente e monta repositório/serviço sem usar o MongooseModule
    await mongoose.connect(uri);

    const LicenseRequestModel = mongoose.model(LicenseRequest.name, LicenseRequestSchema);
    repo = new LicenseRequestRepository(LicenseRequestModel as any);

    const enrollmentMock: Partial<EnrollmentPeriodService> = {
      getActive: jest.fn().mockResolvedValue({
        _id: 'period-1',
        startDate: new Date(Date.now() - 60_000),
        endDate: new Date(Date.now() + 60_000),
      }),
    };

    const studentMock: Partial<StudentService> = {
      findOneOrFail: jest.fn().mockResolvedValue({
        email: 'student@example.com',
        name: 'Student Name',
        universityId: '000000000000000000000002',
        shift: null,
      }),
      submitLicenseRequest: jest.fn().mockResolvedValue({}),
    };

    const busObj = {
      _id: new Types.ObjectId('000000000000000000000001'),
      identifier: 'B1',
      capacity: 1,
      universitySlots: [{ universityId: new Types.ObjectId('000000000000000000000002'), priorityOrder: 1, filledSlots: 0 }],
    };

    const busMock: Partial<BusService> = {
      findAllByUniversityId: jest.fn().mockResolvedValue([busObj]),
      findByUniversityIdAndShift: jest.fn().mockResolvedValue(busObj),
      findOneOrFail: jest.fn().mockResolvedValue(busObj),
    };

    const mailMock: Partial<MailService> = { sendWaitlistConfirmation: jest.fn(), sendWaitlistPromotion: jest.fn() };
    const imagesMock: Partial<ImagesService> = { findByStudentId: jest.fn() };
    const auditMock: Partial<AuditLogService> = { record: jest.fn() };
    const licenseMock: Partial<LicenseService> = { create: jest.fn(), emitLicenseEvent: jest.fn() };

    service = new LicenseRequestService(
      repo as any,
      enrollmentMock as any,
      studentMock as any,
      busMock as any,
      licenseMock as any,
      imagesMock as any,
      mailMock as any,
      auditMock as any,
    );
  });

  afterAll(async () => {
    try {
      await mongoose.disconnect();
    } finally {
      await mongod.stop();
    }
  });

  it('cria apenas uma solicitação ativa quando duas submissões concorrentes ocorrem para o mesmo aluno', async () => {
    const studentId = 'student-1';

    const p1 = service.submitAndCreateRequest(studentId, {} as any, {} as any).catch((e) => e);
    const p2 = service.submitAndCreateRequest(studentId, {} as any, {} as any).catch((e) => e);

    const settled = await Promise.allSettled([p1, p2]);

    // obtém repositório real e verifica quantas requests foram persistidas
    const requests = await repo.findByStudentId(studentId);

    expect(requests.length).toBe(1);
  });
});
