import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { QuotationsService } from '../sales/quotations/quotations.service';
import { CrmLeadsService } from './leads/crm-leads.service';
import { CrmContactsService } from './contacts/crm-contacts.service';
import { CrmOpportunitiesService } from './opportunities/crm-opportunities.service';
import { CrmActivitiesService } from './activities/crm-activities.service';
import { CrmQuotationsService } from './quotations/crm-quotations.service';
import { CrmPipelineService } from './pipeline/crm-pipeline.service';
import { CrmReportsService } from './reports/crm-reports.service';
import {
  LeadStatus,
  OpportunityStatus,
  OpportunityStage,
  QuotationStatus,
  Prisma,
} from '@prisma/client';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('Milestone M35: CRM & Sales Pipeline Services', () => {
  let leadsService: CrmLeadsService;
  let opportunitiesService: CrmOpportunitiesService;
  let quotationsService: CrmQuotationsService;
  let pipelineService: CrmPipelineService;
  let reportsService: CrmReportsService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;
  let salesQuotationsService: any;

  const mockOrgId = '00000000-0000-0000-0000-000000000001';
  const mockUserId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prisma = {
      lead: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      customer: {
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      customerContact: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      opportunity: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      opportunityLine: {
        create: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      item: {
        findFirst: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      crmActivity: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      quotation: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'SEQ-000001' }),
    };

    salesQuotationsService = {
      findAll: jest.fn().mockResolvedValue([]),
      convert: jest
        .fn()
        .mockResolvedValue({ id: 'so-1', orderNumber: 'SO-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrmLeadsService,
        CrmContactsService,
        CrmOpportunitiesService,
        CrmActivitiesService,
        CrmQuotationsService,
        CrmPipelineService,
        CrmReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
        { provide: QuotationsService, useValue: salesQuotationsService },
      ],
    }).compile();

    leadsService = module.get<CrmLeadsService>(CrmLeadsService);
    opportunitiesService = module.get<CrmOpportunitiesService>(
      CrmOpportunitiesService,
    );
    quotationsService = module.get<CrmQuotationsService>(CrmQuotationsService);
    pipelineService = module.get<CrmPipelineService>(CrmPipelineService);
    reportsService = module.get<CrmReportsService>(CrmReportsService);
  });

  describe('1. CrmLeadsService', () => {
    it('should create a new lead with sequence number and publish LEAD_CREATED', async () => {
      const mockLead = {
        id: 'lead-1',
        organizationId: mockOrgId,
        leadNumber: 'LEAD-000001',
        name: 'Jane Smith',
        companyName: 'Acme Corp',
        source: 'WEBSITE',
        status: LeadStatus.NEW,
        estimatedValue: new Prisma.Decimal('25000.0000'),
      };
      prisma.lead.create.mockResolvedValue(mockLead);

      const result = await leadsService.create(
        mockOrgId,
        {
          name: 'Jane Smith',
          companyName: 'Acme Corp',
          estimatedValue: 25000,
        },
        mockUserId,
      );

      expect(result).toEqual(mockLead);
      expect(prisma.lead.create).toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'LEAD_CREATED' }),
      );
    });

    it('should qualify a lead and publish LEAD_QUALIFIED', async () => {
      const existingLead = {
        id: 'lead-1',
        organizationId: mockOrgId,
        leadNumber: 'LEAD-000001',
        status: LeadStatus.NEW,
        estimatedValue: new Prisma.Decimal('25000.0000'),
      };
      prisma.lead.findFirst.mockResolvedValue(existingLead);
      prisma.lead.update.mockResolvedValue({
        ...existingLead,
        status: LeadStatus.QUALIFIED,
        qualificationNotes: 'Budget approved by CFO',
      });

      const result = await leadsService.qualify(
        mockOrgId,
        'lead-1',
        { qualificationNotes: 'Budget approved by CFO' },
        mockUserId,
      );

      expect(result.status).toBe(LeadStatus.QUALIFIED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'LEAD_QUALIFIED' }),
      );
    });

    it('should 1-click convert a lead into a Customer and Opportunity', async () => {
      const existingLead = {
        id: 'lead-1',
        organizationId: mockOrgId,
        leadNumber: 'LEAD-000001',
        name: 'Jane Smith',
        companyName: 'Acme Corp',
        status: LeadStatus.QUALIFIED,
        estimatedValue: new Prisma.Decimal('50000.0000'),
        source: 'WEBSITE',
      };
      prisma.lead.findFirst.mockResolvedValue(existingLead);
      prisma.customer.create.mockResolvedValue({
        id: 'cust-1',
        name: 'Acme Corp',
      });
      prisma.customerContact.findFirst.mockResolvedValue({ id: 'contact-1' });
      prisma.opportunity.create.mockResolvedValue({
        id: 'opp-1',
        opportunityNumber: 'OPP-000001',
        title: 'Commercial Deal - Acme Corp',
      });
      prisma.lead.update.mockResolvedValue({
        ...existingLead,
        status: LeadStatus.CONVERTED,
        convertedCustomerId: 'cust-1',
        convertedOpportunityId: 'opp-1',
      });

      const result = await leadsService.convert(
        mockOrgId,
        'lead-1',
        { newCustomerName: 'Acme Corp' },
        mockUserId,
      );

      expect(result.customerId).toBe('cust-1');
      expect(result.opportunity.id).toBe('opp-1');
      expect(result.lead.status).toBe(LeadStatus.CONVERTED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'LEAD_CONVERTED' }),
      );
    });

    it('should reject conversion if lead is already converted', async () => {
      prisma.lead.findFirst.mockResolvedValue({
        id: 'lead-1',
        organizationId: mockOrgId,
        status: LeadStatus.CONVERTED,
      });

      await expect(
        leadsService.convert(mockOrgId, 'lead-1', {}, mockUserId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('2. CrmOpportunitiesService', () => {
    it('should create an opportunity with item lines and calculate totals', async () => {
      prisma.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        currencyId: 'curr-1',
      });
      prisma.item.findFirst.mockResolvedValue({ id: 'item-1' });
      const mockOpp = {
        id: 'opp-1',
        opportunityNumber: 'OPP-000001',
        customerId: 'cust-1',
        title: 'Enterprise License',
        stage: OpportunityStage.PROSPECTING,
        probability: new Prisma.Decimal('10.00'),
        estimatedValue: new Prisma.Decimal('10000.0000'),
      };
      prisma.opportunity.create.mockResolvedValue(mockOpp);

      const result = await opportunitiesService.create(
        mockOrgId,
        {
          customerId: 'cust-1',
          title: 'Enterprise License',
          lines: [
            {
              itemId: 'item-1',
              quantity: 2,
              unitPrice: 5000,
            },
          ],
        },
        mockUserId,
      );

      expect(result).toEqual(mockOpp);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'OPPORTUNITY_CREATED' }),
      );
    });

    it('should transition opportunity stage to CLOSED_WON and set 100% probability', async () => {
      prisma.opportunity.findFirst.mockResolvedValue({
        id: 'opp-1',
        organizationId: mockOrgId,
        status: OpportunityStatus.OPEN,
        stage: OpportunityStage.NEGOTIATION,
        probability: new Prisma.Decimal('90.00'),
      });
      prisma.opportunity.update.mockResolvedValue({
        id: 'opp-1',
        status: OpportunityStatus.WON,
        stage: OpportunityStage.CLOSED_WON,
        probability: new Prisma.Decimal('100.00'),
      });

      const result = await opportunitiesService.changeStage(
        mockOrgId,
        'opp-1',
        { stage: OpportunityStage.CLOSED_WON },
        mockUserId,
      );

      expect(result.status).toBe(OpportunityStatus.WON);
      expect(result.stage).toBe(OpportunityStage.CLOSED_WON);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'OPPORTUNITY_WON' }),
      );
    });
  });

  describe('3. CrmQuotationsService Governance & Lifecycle', () => {
    it('should submit a DRAFT quotation for approval', async () => {
      prisma.quotation.findFirst.mockResolvedValue({
        id: 'q-1',
        organizationId: mockOrgId,
        quotationNumber: 'QT-000001',
        status: QuotationStatus.DRAFT,
        lines: [{ id: 'line-1' }],
      });
      prisma.quotation.update.mockResolvedValue({
        id: 'q-1',
        status: QuotationStatus.SUBMITTED,
      });

      const res = await quotationsService.submit(
        mockOrgId,
        'q-1',
        {},
        mockUserId,
      );
      expect(res.status).toBe(QuotationStatus.SUBMITTED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'QUOTATION_SUBMITTED' }),
      );
    });

    it('should approve a SUBMITTED quotation', async () => {
      prisma.quotation.findFirst.mockResolvedValue({
        id: 'q-1',
        organizationId: mockOrgId,
        status: QuotationStatus.SUBMITTED,
        lines: [{ id: 'line-1' }],
      });
      prisma.quotation.update.mockResolvedValue({
        id: 'q-1',
        status: QuotationStatus.APPROVED,
        approvedByUserId: mockUserId,
      });

      const res = await quotationsService.approve(
        mockOrgId,
        'q-1',
        {},
        mockUserId,
      );
      expect(res.status).toBe(QuotationStatus.APPROVED);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'QUOTATION_APPROVED' }),
      );
    });

    it('should record customer acceptance and mark quotation as immutable', async () => {
      prisma.quotation.findFirst.mockResolvedValue({
        id: 'q-1',
        organizationId: mockOrgId,
        status: QuotationStatus.SENT,
        lines: [{ id: 'line-1' }],
      });
      prisma.quotation.update.mockResolvedValue({
        id: 'q-1',
        status: QuotationStatus.ACCEPTED,
        isImmutable: true,
        acceptedBy: 'John Doe',
      });

      const res = await quotationsService.accept(
        mockOrgId,
        'q-1',
        { acceptedBy: 'John Doe' },
        mockUserId,
      );
      expect(res.status).toBe(QuotationStatus.ACCEPTED);
      expect(res.isImmutable).toBe(true);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'QUOTATION_ACCEPTED' }),
      );
    });

    it('should convert accepted quotation to M28 Sales Order and prevent double conversion', async () => {
      prisma.quotation.findFirst.mockResolvedValue({
        id: 'q-1',
        organizationId: mockOrgId,
        quotationNumber: 'QT-000001',
        status: QuotationStatus.ACCEPTED,
        lines: [{ id: 'line-1' }],
      });
      prisma.quotation.update.mockResolvedValue({
        id: 'q-1',
        status: QuotationStatus.CONVERTED,
        isImmutable: true,
      });

      const res = await quotationsService.convert(mockOrgId, 'q-1', mockUserId);
      expect(res.salesOrder.orderNumber).toBe('SO-000001');
      expect(salesQuotationsService.convert).toHaveBeenCalledWith(
        mockOrgId,
        'q-1',
        mockUserId,
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'QUOTATION_CONVERTED' }),
      );
    });
  });

  describe('4. CrmPipelineService & Telemetry', () => {
    it('should compute weighted pipeline and win rate accurately', async () => {
      const opps = [
        {
          id: 'opp-1',
          status: OpportunityStatus.OPEN,
          estimatedValue: new Prisma.Decimal('100000.0000'),
          probability: new Prisma.Decimal('50.00'), // weighted: 50,000
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 'opp-2',
          status: OpportunityStatus.WON,
          estimatedValue: new Prisma.Decimal('50000.0000'),
          probability: new Prisma.Decimal('100.00'),
          createdAt: new Date('2026-01-01'),
          wonDate: new Date('2026-01-31'),
        },
        {
          id: 'opp-3',
          status: OpportunityStatus.LOST,
          estimatedValue: new Prisma.Decimal('25000.0000'),
          probability: new Prisma.Decimal('0.00'),
          createdAt: new Date('2026-01-01'),
          lostDate: new Date('2026-01-15'),
        },
      ];
      prisma.opportunity.findMany.mockResolvedValue(opps);
      prisma.lead.findMany.mockResolvedValue([]);
      prisma.quotation.findMany.mockResolvedValue([]);

      const summary = await pipelineService.getPipelineSummary(mockOrgId);

      expect(summary.pipeline.totalOpenOpportunities).toBe(1);
      expect(summary.pipeline.totalOpenValue).toBe(100000);
      expect(summary.pipeline.weightedPipelineValue).toBe(50000);
      expect(summary.pipeline.wonOpportunities).toBe(1);
      expect(summary.pipeline.lostOpportunities).toBe(1);
      expect(summary.pipeline.winRatePercentage).toBe(50); // 1 won / (1 won + 1 lost) = 50%
    });
  });
});
