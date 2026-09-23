import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from '../health/health.service';
import { HealthController } from '../health/health.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../common/cache/cache.service';
import { JobService } from '../../common/jobs/job.service';
import { HealthStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';

describe('M38: Health Checks & Probes (INV-339, INV-340)', () => {
  let healthService: HealthService;
  let healthController: HealthController;
  let prismaMock: any;
  let cacheMock: any;
  let jobsMock: any;

  beforeEach(async () => {
    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };
    cacheMock = {
      set: jest.fn(),
      get: jest.fn().mockReturnValue('ok'),
    };
    jobsMock = {};

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CacheService, useValue: cacheMock },
        { provide: JobService, useValue: jobsMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    healthService = module.get<HealthService>(HealthService);
    healthController = module.get<HealthController>(HealthController);
  });

  describe('Liveness Probe (INV-340)', () => {
    it('1. should return UP for liveness probe without revealing dependencies', async () => {
      const result = await healthController.getLiveness();
      expect(result).toEqual({ status: HealthStatus.UP });
    });
  });

  describe('Readiness Probe (INV-340)', () => {
    it('2. should return UP when database connectivity is healthy', async () => {
      const result = await healthController.getReadiness();
      expect(result).toEqual({ status: HealthStatus.UP });
    });

    it('3. should return DOWN when database connectivity fails', async () => {
      prismaMock.$queryRaw.mockRejectedValueOnce(
        new Error('Connection timeout'),
      );
      const result = await healthController.getReadiness();
      expect(result).toEqual({ status: HealthStatus.DOWN });
    });
  });

  describe('Full Health Assessment (INV-339)', () => {
    it('4. should report overall UP when all subcomponents are functional', async () => {
      const result = await healthService.check();
      expect(result.status).toBe(HealthStatus.UP);
      expect(result.components.database.status).toBe(HealthStatus.UP);
      expect(result.components.cache.status).toBe(HealthStatus.UP);
      expect(result.components.jobs.status).toBe(HealthStatus.UP);
    });

    it('5. should report DEGRADED when non-critical subcomponents fail', async () => {
      cacheMock.get.mockReturnValueOnce('mismatch');
      const result = await healthService.check();
      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.components.cache.status).toBe(HealthStatus.DOWN);
    });
  });
});
