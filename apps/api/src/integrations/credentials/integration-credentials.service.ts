import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { CredentialEncryptionService } from './credential-encryption.service';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { IntegrationCredentialType } from '@prisma/client';

@Injectable()
export class IntegrationCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly logger: StructuredLoggingService,
    private readonly encryption: CredentialEncryptionService,
  ) {}

  async createCredential(
    organizationId: string,
    dto: CreateCredentialDto,
    actorUserId: string,
  ) {
    const connection = await this.prisma.integrationConnection.findFirst({
      where: { id: dto.connectionId, organizationId, deletedAt: null },
    });
    if (!connection)
      throw new NotFoundException(`Connection '${dto.connectionId}' not found`);

    const encrypted = this.encryption.encrypt(dto.plaintext);

    const credential = await this.prisma.integrationCredential.create({
      data: {
        connectionId: dto.connectionId,
        credentialType: dto.credentialType as IntegrationCredentialType,
        encryptedValue: encrypted.encryptedValue,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        fingerprint: encrypted.fingerprint,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      select: {
        id: true,
        connectionId: true,
        credentialType: true,
        fingerprint: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    await this.audit.record({
      eventName: 'INTEGRATION_CREDENTIAL_CREATED',
      action: 'INTEGRATION_CREDENTIAL_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      resource: 'integration_credential',
      resourceId: credential.id,
      details: {
        connectionId: dto.connectionId,
        credentialType: dto.credentialType,
        fingerprint: encrypted.fingerprint,
      },
    });

    this.logger.log({
      level: 'INFO',
      message: 'Integration credential created',
      module: 'Integrations',
      event: 'INTEGRATION_CREDENTIAL_CREATED',
      organizationId,
      credentialId: credential.id,
    });

    return credential;
  }

  async listCredentials(organizationId: string, connectionId: string) {
    const connection = await this.prisma.integrationConnection.findFirst({
      where: { id: connectionId, organizationId, deletedAt: null },
    });
    if (!connection)
      throw new NotFoundException(`Connection '${connectionId}' not found`);

    return this.prisma.integrationCredential.findMany({
      where: { connectionId },
      select: {
        id: true,
        connectionId: true,
        credentialType: true,
        fingerprint: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteCredential(
    organizationId: string,
    credentialId: string,
    actorUserId: string,
  ) {
    const credential = await this.prisma.integrationCredential.findUnique({
      where: { id: credentialId },
      include: { connection: { select: { organizationId: true } } },
    });
    if (
      !credential ||
      credential.connection.organizationId !== organizationId
    ) {
      throw new NotFoundException(`Credential '${credentialId}' not found`);
    }

    await this.prisma.integrationCredential.delete({
      where: { id: credentialId },
    });

    await this.audit.record({
      eventName: 'INTEGRATION_CREDENTIAL_DELETED',
      action: 'INTEGRATION_CREDENTIAL_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      resource: 'integration_credential',
      resourceId: credentialId,
    });

    return { success: true };
  }

  async getDecryptedCredential(
    organizationId: string,
    credentialId: string,
  ): Promise<string> {
    const credential = await this.prisma.integrationCredential.findUnique({
      where: { id: credentialId },
      include: { connection: { select: { organizationId: true } } },
    });
    if (
      !credential ||
      credential.connection.organizationId !== organizationId
    ) {
      throw new ForbiddenException('Credential not accessible');
    }
    return this.encryption.decrypt(
      credential.encryptedValue,
      credential.iv,
      credential.authTag,
    );
  }
}
