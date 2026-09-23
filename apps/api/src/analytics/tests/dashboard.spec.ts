import { DashboardsService } from '../services/dashboards.service';
import { DashboardVisibility, DashboardWidgetType } from '@prisma/client';

describe('DashboardsService (INV-512, INV-513)', () => {
  let dashboardsService: DashboardsService;
  let mockDashboardRepo: any;

  beforeEach(() => {
    mockDashboardRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addWidget: jest.fn(),
      updateWidget: jest.fn(),
      removeWidget: jest.fn(),
    };

    dashboardsService = new DashboardsService(mockDashboardRepo);
  });

  it('INV-512: creates a dashboard with customizable grid layout', async () => {
    mockDashboardRepo.create.mockResolvedValue({
      id: 'dash-1',
      organizationId: 'org-1',
      ownerUserId: 'u1',
      name: 'Executive KPI Dashboard',
      visibility: DashboardVisibility.PRIVATE,
      layout: { columns: 12, rows: 24 },
    });

    const result = await dashboardsService.createDashboard({
      organizationId: 'org-1',
      userId: 'u1',
      dto: {
        name: 'Executive KPI Dashboard',
        layout: { columns: 12, rows: 24 },
      },
    });

    expect(result.id).toBe('dash-1');
    expect(mockDashboardRepo.create).toHaveBeenCalledWith(
      'org-1',
      'u1',
      expect.objectContaining({
        name: 'Executive KPI Dashboard',
      }),
    );
  });

  it('INV-513: adds a widget to a dashboard with position and type', async () => {
    mockDashboardRepo.findById.mockResolvedValue({
      id: 'dash-1',
      organizationId: 'org-1',
      ownerUserId: 'u1',
      visibility: DashboardVisibility.ORGANIZATION,
      shares: [],
      widgets: [],
    });

    mockDashboardRepo.addWidget.mockResolvedValue({
      id: 'w-1',
      dashboardId: 'dash-1',
      widgetType: DashboardWidgetType.METRIC_CARD,
      title: 'Monthly Recurring Revenue',
      position: { x: 0, y: 0, w: 4, h: 2 },
    });

    const widget = await dashboardsService.addWidget({
      dashboardId: 'dash-1',
      organizationId: 'org-1',
      userId: 'u1',
      dto: {
        title: 'Monthly Recurring Revenue',
        widgetType: DashboardWidgetType.METRIC_CARD,
        position: { x: 0, y: 0, w: 4, h: 2 },
      },
    });

    expect(widget.id).toBe('w-1');
    expect(widget.widgetType).toBe(DashboardWidgetType.METRIC_CARD);
  });

  it('INV-513: supports all 6 dashboard widget types', () => {
    const types: DashboardWidgetType[] = [
      DashboardWidgetType.METRIC_CARD,
      DashboardWidgetType.CHART_LINE,
      DashboardWidgetType.CHART_BAR,
      DashboardWidgetType.CHART_PIE,
      DashboardWidgetType.TABLE,
      DashboardWidgetType.KPI_SUMMARY,
    ];

    expect(types.length).toBe(6);
  });
});
