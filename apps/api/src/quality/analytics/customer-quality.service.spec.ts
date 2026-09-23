import { Test, TestingModule } from '@nestjs/testing';
import { CustomerQualityService } from './customer-quality.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { QualityIssueStatus } from '@prisma/client';

describe('CustomerQualityService', () => {
  let service: CustomerQualityService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prisma = {
      customer: { findFirst: jest.fn() },
      item: { findFirst: jest.fn() },
      customerQualityIssue: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'CQI-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerQualityService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    service = module.get<CustomerQualityService>(CustomerQualityService);
  });

  it('should create and resolve customer quality issue', async () => {
    prisma.customer.findFirst.mockResolvedValue({
      id: 'cust-1',
      organizationId: mockOrgId,
    });
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      organizationId: mockOrgId,
    });
    prisma.customerQualityIssue.create.mockResolvedValue({
      id: 'issue-1',
      organizationId: mockOrgId,
      issueNumber: 'CQI-000001',
      status: QualityIssueStatus.REPORTED,
    });

    const created = await service.create(
      mockOrgId,
      {
        customerId: 'cust-1',
        itemId: 'item-1',
        issueDescription: 'Customer reported dent on packaging',
      },
      'user-1',
    );
    expect(created.issueNumber).toBe('CQI-000001');

    prisma.customerQualityIssue.findFirst.mockResolvedValue(created);
    prisma.customerQualityIssue.update.mockResolvedValue({
      ...created,
      status: QualityIssueStatus.RESOLVED,
    });

    const resolved = await service.resolve(
      mockOrgId,
      'issue-1',
      { resolutionNotes: 'Replacement sent' },
      'user-1',
    );
    expect(resolved.status).toBe(QualityIssueStatus.RESOLVED);
  });
});
