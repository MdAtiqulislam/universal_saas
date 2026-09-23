import { Test, TestingModule } from '@nestjs/testing';
import { TaxJurisdictionsService } from './tax-jurisdictions.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { JurisdictionType } from '@prisma/client';

describe('TaxJurisdictionsService', () => {
  let service: TaxJurisdictionsService;
  let prismaMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prismaMock = {
      taxJurisdiction: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxJurisdictionsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<TaxJurisdictionsService>(TaxJurisdictionsService);
  });

  it('1. should create a tax jurisdiction', async () => {
    prismaMock.taxJurisdiction.findFirst.mockResolvedValue(null);
    prismaMock.taxJurisdiction.create.mockImplementation((args: any) => ({
      id: 'jur-us',
      ...args.data,
    }));

    const result = await service.create(mockOrgId, {
      code: 'US_FED',
      name: 'United States Federal',
      countryCode: 'US',
      type: JurisdictionType.COUNTRY,
    });

    expect(result.id).toBe('jur-us');
    expect(result.code).toBe('US_FED');
    expect(result.countryCode).toBe('US');
  });

  it('2. should prevent circular reference when setting parent jurisdiction to itself', async () => {
    prismaMock.taxJurisdiction.findFirst.mockResolvedValue({
      id: 'jur-ny',
      organizationId: mockOrgId,
      code: 'US_NY',
    });

    await expect(
      service.update(mockOrgId, 'jur-ny', {
        parentJurisdictionId: 'jur-ny',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
