import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterPushDeviceDto } from '../dto/device.dto';

@Injectable()
export class PushDeviceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * INV-466: Push device registrations are tenant and user scoped
   */
  async registerDevice(
    organizationId: string,
    userId: string,
    dto: RegisterPushDeviceDto,
  ) {
    return this.prisma.pushDevice.upsert({
      where: {
        userId_deviceToken: {
          userId,
          deviceToken: dto.deviceToken,
        },
      },
      create: {
        organizationId,
        userId,
        platform: dto.platform,
        deviceToken: dto.deviceToken,
        appVersion: dto.appVersion,
        isActive: true,
        lastSeenAt: new Date(),
      },
      update: {
        platform: dto.platform,
        appVersion: dto.appVersion,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });
  }

  async unregisterDevice(
    organizationId: string,
    userId: string,
    deviceToken: string,
  ) {
    const device = await this.prisma.pushDevice.findUnique({
      where: {
        userId_deviceToken: {
          userId,
          deviceToken,
        },
      },
    });

    if (!device) {
      throw new NotFoundException('Push device not found');
    }

    if (device.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Cannot modify push device belonging to another tenant',
      );
    }

    return this.prisma.pushDevice.update({
      where: { id: device.id },
      data: { isActive: false },
    });
  }

  async listUserDevices(organizationId: string, userId: string) {
    return this.prisma.pushDevice.findMany({
      where: { organizationId, userId, isActive: true },
      select: {
        id: true,
        platform: true,
        deviceToken: true,
        appVersion: true,
        isActive: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
  }
}
