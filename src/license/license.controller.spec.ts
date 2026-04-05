import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';
import { LICENSE_REPOSITORY } from './interfaces/repository.interface';

global.fetch = jest.fn();

const mockLicenseRepository = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findOneByStudentId: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => {
    const config: Record<string, string> = {
      BASE_URL_API_LICENSE: 'https://mock-license-api.com',
      X_API_KEY: 'mock-api-key',
    };
    const value = config[key];
    if (!value) throw new Error(`Config ${key} not found`);
    return value;
  }),
};

describe('LicenseController', () => {
  let controller: LicenseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LicenseController],
      providers: [
        LicenseService,
        { provide: LICENSE_REPOSITORY, useValue: mockLicenseRepository },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<LicenseController>(LicenseController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});