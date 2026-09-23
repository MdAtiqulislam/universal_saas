import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { RecordDiagnosisDto } from '../dto/service-diagnosis.dto';
import { ServiceDiagnosis, ServiceTicketStatus, Prisma } from '@prisma/client';

@Injectable()
export class ServiceDiagnosisService {
  private readonly logger = new Logger(ServiceDiagnosisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async findByTicket(
    organizationId: string,
    ticketId: string,
  ): Promise<ServiceDiagnosis[]> {
    return this.prisma.serviceDiagnosis.findMany({
      where: { organizationId, serviceTicketId: ticketId },
      include: { technician: true },
      orderBy: { diagnosedAt: 'desc' },
    });
  }

  async recordDiagnosis(
    organizationId: string,
    ticketId: string,
    dto: RecordDiagnosisDto,
    userId: string,
  ): Promise<ServiceDiagnosis> {
    const ticket = await this.prisma.serviceTicket.findFirst({
      where: { id: ticketId, organizationId },
    });
    if (!ticket) {
      throw new NotFoundException(
        `Service ticket with ID ${ticketId} not found in this organization.`,
      );
    }

    const technician = await this.prisma.employee.findFirst({
      where: { id: dto.technicianId, organizationId },
    });
    if (!technician) {
      throw new BadRequestException(
        `Technician with ID ${dto.technicianId} does not belong to this organization.`,
      );
    }

    const now = new Date();
    const isFinalized = dto.finalize ?? false;

    const diagnosis = await this.prisma.$transaction(async (tx) => {
      const created = await tx.serviceDiagnosis.create({
        data: {
          organizationId,
          serviceTicketId: ticket.id,
          technicianId: technician.id,
          diagnosisCode: dto.diagnosisCode.trim(),
          symptoms: dto.symptoms.trim(),
          rootCause: dto.rootCause.trim(),
          repairRecommended: dto.repairRecommended ?? true,
          replacementRecommended: dto.replacementRecommended ?? false,
          warrantyCovered: dto.warrantyCovered ?? false,
          notes: dto.notes || null,
          isFinalized,
          finalizedAt: isFinalized ? now : null,
        },
      });

      // Update ticket status
      let nextStatus = ticket.status;
      if (isFinalized) {
        if (!dto.warrantyCovered) {
          nextStatus = ServiceTicketStatus.AWAITING_APPROVAL;
        } else {
          nextStatus = ServiceTicketStatus.APPROVED;
        }
      } else {
        nextStatus = ServiceTicketStatus.IN_DIAGNOSIS;
      }

      await tx.serviceTicket.update({
        where: { id: ticket.id },
        data: {
          status: nextStatus,
          firstResponseAt: ticket.firstResponseAt || now,
        },
      });

      return created;
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_DIAGNOSIS_COMPLETED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'record_diagnosis',
      resource: 'service_diagnosis',
      resourceId: diagnosis.id,
      details: {
        ticketNumber: ticket.ticketNumber,
        diagnosisCode: diagnosis.diagnosisCode,
        isFinalized: diagnosis.isFinalized,
        warrantyCovered: diagnosis.warrantyCovered,
      },
    });

    return diagnosis;
  }

  async finalizeDiagnosis(
    organizationId: string,
    diagnosisId: string,
    userId: string,
  ): Promise<ServiceDiagnosis> {
    const diagnosis = await this.prisma.serviceDiagnosis.findFirst({
      where: { id: diagnosisId, organizationId },
    });
    if (!diagnosis) {
      throw new NotFoundException(
        `Diagnosis with ID ${diagnosisId} not found in this organization.`,
      );
    }

    if (diagnosis.isFinalized) {
      return diagnosis;
    }

    const now = new Date();
    const updated = await this.prisma.serviceDiagnosis.update({
      where: { id: diagnosis.id },
      data: {
        isFinalized: true,
        finalizedAt: now,
      },
    });

    await this.eventBus.publish({
      eventName: 'SERVICE_DIAGNOSIS_COMPLETED',
      occurredAt: now,
      organizationId,
      actorUserId: userId,
      action: 'finalize_diagnosis',
      resource: 'service_diagnosis',
      resourceId: updated.id,
      details: {
        diagnosisCode: updated.diagnosisCode,
      },
    });

    return updated;
  }
}
