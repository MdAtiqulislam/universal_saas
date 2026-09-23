import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateJobDto, JobQueryDto } from './job.dto';

export type JobHandler = (
  payload: any,
  onProgress: (percent: number) => Promise<void>,
) => Promise<any>;

@Injectable()
export class JobService implements OnModuleDestroy {
  private readonly logger = new Logger(JobService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private isProcessing = false;
  private isShuttingDown = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleDestroy() {
    this.isShuttingDown = true;
  }

  registerHandler(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
  }

  async createJob(
    organizationId: string,
    dto: CreateJobDto,
    actorUserId?: string,
  ) {
    const job = await this.prisma.backgroundJob.create({
      data: {
        organizationId,
        jobType: dto.jobType,
        status: 'PENDING',
        priority: dto.priority || 0,
        payload: dto.payload ?? {},
        actorUserId,
      },
    });

    // Trigger processing asynchronously in next tick
    setImmediate(() => this.processNextJobs());

    return job;
  }

  async getJob(organizationId: string, id: string) {
    const job = await this.prisma.backgroundJob.findFirst({
      where: { id, organizationId },
    });

    if (!job) {
      throw new NotFoundException(
        `Job with ID ${id} not found in this organization.`,
      );
    }

    return job;
  }

  async listJobs(organizationId: string, query?: JobQueryDto) {
    const where: any = { organizationId };
    if (query?.status) where.status = query.status;
    if (query?.jobType) where.jobType = query.jobType;

    return this.prisma.backgroundJob.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async cancelJob(organizationId: string, id: string) {
    const job = await this.getJob(organizationId, id);

    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      throw new BadRequestException(
        `Cannot cancel a job in status ${job.status}.`,
      );
    }

    return this.prisma.backgroundJob.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });
  }

  async processNextJobs(maxConcurrency: number = 3): Promise<void> {
    if (this.isProcessing || this.isShuttingDown) return;
    this.isProcessing = true;

    try {
      const pendingJobs = await this.prisma.backgroundJob.findMany({
        where: { status: 'PENDING' },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: maxConcurrency,
      });

      for (const job of pendingJobs) {
        const handler = this.handlers.get(job.jobType);
        if (!handler) {
          await this.prisma.backgroundJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              error: `No registered handler for job type "${job.jobType}".`,
              completedAt: new Date(),
            },
          });
          continue;
        }

        // Mark processing
        await this.prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: 'PROCESSING',
            startedAt: new Date(),
          },
        });

        try {
          const onProgress = async (percent: number) => {
            await this.prisma.backgroundJob.update({
              where: { id: job.id },
              data: { progress: Math.min(100, Math.max(0, percent)) },
            });
          };

          const result = await handler(job.payload, onProgress);

          await this.prisma.backgroundJob.update({
            where: { id: job.id },
            data: {
              status: 'COMPLETED',
              result: result ?? {},
              progress: 100,
              completedAt: new Date(),
            },
          });
        } catch (err: any) {
          await this.prisma.backgroundJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              error: err.message || 'Job execution failed',
              completedAt: new Date(),
            },
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Error processing background jobs: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }
}
