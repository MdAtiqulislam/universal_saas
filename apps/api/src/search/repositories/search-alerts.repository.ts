import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SearchAlertStatus,
  SearchAlertTriggerType,
  Prisma,
} from '@prisma/client';
import {
  CreateSearchAlertDto,
  UpdateSearchAlertDto,
} from '../dto/search-alert.dto';

@Injectable()
export class SearchAlertsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAlert(params: {
    organizationId: string;
    userId: string;
    dto: CreateSearchAlertDto;
  }) {
    const { organizationId, userId, dto } = params;

    return this.prisma.searchAlert.create({
      data: {
        organizationId,
        userId,
        savedViewId: dto.savedViewId,
        name: dto.name,
        triggerType: dto.triggerType || SearchAlertTriggerType.NEW_MATCH,
        scheduleCron: dto.scheduleCron,
        alertIntervalMinutes: dto.alertIntervalMinutes || 60,
        notifyChannels: dto.notifyChannels || ['IN_APP'],
        channelConfig: (dto.channelConfig || {}) as Prisma.InputJsonValue,
        status: SearchAlertStatus.ACTIVE,
      },
      include: {
        savedView: true,
      },
    });
  }

  async findAlertById(id: string, organizationId?: string) {
    return this.prisma.searchAlert.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        savedView: true,
        user: { select: { id: true, email: true } },
      },
    });
  }

  async listAlerts(params: {
    organizationId: string;
    userId?: string;
    status?: SearchAlertStatus;
  }) {
    return this.prisma.searchAlert.findMany({
      where: {
        organizationId: params.organizationId,
        ...(params.userId ? { userId: params.userId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      include: {
        savedView: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAlert(
    id: string,
    organizationId: string,
    dto: UpdateSearchAlertDto,
  ) {
    return this.prisma.searchAlert.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.triggerType !== undefined
          ? { triggerType: dto.triggerType }
          : {}),
        ...(dto.scheduleCron !== undefined
          ? { scheduleCron: dto.scheduleCron }
          : {}),
        ...(dto.alertIntervalMinutes !== undefined
          ? { alertIntervalMinutes: dto.alertIntervalMinutes }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notifyChannels !== undefined
          ? { notifyChannels: dto.notifyChannels }
          : {}),
        ...(dto.channelConfig !== undefined
          ? { channelConfig: dto.channelConfig as Prisma.InputJsonValue }
          : {}),
      },
      include: {
        savedView: true,
      },
    });
  }

  async deleteAlert(id: string, organizationId: string) {
    return this.prisma.searchAlert.deleteMany({
      where: { id, organizationId },
    });
  }

  async recordExecution(params: {
    alertId: string;
    organizationId: string;
    executionId: string;
    matchCount: number;
    status: SearchAlertStatus;
    deliveredChannelCount: number;
    details?: Record<string, unknown>;
    errorMessage?: string;
  }) {
    return this.prisma.searchAlertExecution.upsert({
      where: {
        alertId_executionId: {
          alertId: params.alertId,
          executionId: params.executionId,
        },
      },
      update: {
        matchCount: params.matchCount,
        status: params.status,
        deliveredChannelCount: params.deliveredChannelCount,
        details: (params.details || {}) as Prisma.InputJsonValue,
        errorMessage: params.errorMessage,
      },
      create: {
        alertId: params.alertId,
        organizationId: params.organizationId,
        executionId: params.executionId,
        matchCount: params.matchCount,
        status: params.status,
        deliveredChannelCount: params.deliveredChannelCount,
        details: (params.details || {}) as Prisma.InputJsonValue,
        errorMessage: params.errorMessage,
      },
    });
  }

  async listExecutions(alertId: string, organizationId: string, limit = 20) {
    return this.prisma.searchAlertExecution.findMany({
      where: {
        alertId,
        organizationId,
      },
      orderBy: { executedAt: 'desc' },
      take: limit,
    });
  }
}
