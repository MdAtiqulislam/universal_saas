import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateTrackingEventDto } from './dto/create-tracking-event.dto';
import { ShipmentTrackingEvent } from '@prisma/client';

@Injectable()
export class ShipmentTrackingService {
  private readonly logger = new Logger(ShipmentTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Append a tracking event to a shipment in chronological order.
   */
  async addTrackingEvent(
    organizationId: string,
    shipmentId: string,
    dto: CreateTrackingEventDto,
    actorUserId?: string,
  ): Promise<ShipmentTrackingEvent> {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        organizationId,
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
    }

    const eventTime = dto.eventTime ? new Date(dto.eventTime) : new Date();

    const event = await this.prisma.shipmentTrackingEvent.create({
      data: {
        organizationId,
        shipmentId,
        status: dto.status,
        eventType: dto.eventType,
        eventTime,
        location: dto.location?.trim() ?? null,
        description: dto.description?.trim() ?? null,
        source: dto.source?.trim() || 'MANUAL',
        externalReference: dto.externalReference?.trim() ?? null,
        createdByUserId: actorUserId ?? null,
      },
    });

    await this.eventBus.publish({
      eventName: 'SHIPMENT_TRACKING_EVENT_ADDED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'shipment.track',
      resource: 'shipment_tracking_event',
      resourceId: event.id,
      details: {
        shipmentId,
        shipmentNumber: shipment.shipmentNumber,
        status: event.status,
        eventType: event.eventType,
        location: event.location,
      },
    });

    return event;
  }

  /**
   * Get chronological tracking history for a shipment.
   */
  async getTrackingHistory(
    organizationId: string,
    shipmentId: string,
  ): Promise<{
    shipmentId: string;
    shipmentNumber: string;
    carrierName: string | null;
    trackingNumber: string | null;
    currentStatus: string;
    events: ShipmentTrackingEvent[];
  }> {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        organizationId,
      },
      include: {
        carrier: true,
        trackingEvents: {
          orderBy: { eventTime: 'asc' },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
    }

    return {
      shipmentId: shipment.id,
      shipmentNumber: shipment.shipmentNumber,
      carrierName: shipment.carrier?.name ?? null,
      trackingNumber: shipment.trackingNumber,
      currentStatus: shipment.status,
      events: shipment.trackingEvents,
    };
  }
}
