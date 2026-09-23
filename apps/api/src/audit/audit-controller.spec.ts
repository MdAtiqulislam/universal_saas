import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditQueryService } from './audit-query.service';
import { TenantContext } from '../organizations/interfaces/tenant-context.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';

describe('AuditController', () => {
  let controller: AuditController;
  let queryServiceMock: {
    list: jest.Mock;
  };

  const mockTenant: TenantContext = {
    organizationId: 'org-1111-1111',
    membershipId: 'mem-2222',
    userId: 'user-3333',
  };

  beforeEach(async () => {
    queryServiceMock = {
      list: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditQueryService, useValue: queryServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(TenantContextGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuditController>(AuditController);
  });

  it('1. should call AuditQueryService with organizationId from TenantContext', async () => {
    const query = { page: 1, limit: 20 };
    const response = await controller.list(query, mockTenant);

    expect(queryServiceMock.list).toHaveBeenCalledWith(
      mockTenant.organizationId,
      query,
    );
    expect(response).toEqual({
      success: true,
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      },
    });
  });
});
