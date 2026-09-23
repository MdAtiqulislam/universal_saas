import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { ProviderQueryDto } from './dto/provider-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class IntegrationProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: StructuredLoggingService,
  ) {}

  async listProviders(query?: ProviderQueryDto) {
    const where: Prisma.IntegrationProviderWhereInput = {};
    if (query?.status) {
      where.status = query.status as Prisma.EnumIntegrationProviderStatusFilter;
    }
    if (query?.category) {
      where.category = { contains: query.category, mode: 'insensitive' };
    }
    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const providers = await this.prisma.integrationProvider.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    this.logger.log({
      level: 'INFO',
      message: 'Integration providers listed',
      module: 'Integrations',
      event: 'INTEGRATION_PROVIDER_LIST',
      count: providers.length,
    });

    return providers;
  }

  async getProvider(id: string) {
    const provider = await this.prisma.integrationProvider.findUnique({
      where: { id },
    });
    if (!provider)
      throw new NotFoundException(`Integration provider '${id}' not found`);
    return provider;
  }
}
