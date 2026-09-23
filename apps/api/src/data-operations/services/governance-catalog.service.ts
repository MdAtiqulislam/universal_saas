import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GovernanceClassification,
  GovernanceDataset,
  GovernanceDeletionStrategy,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  GOVERNANCE_DATASET_DEFINITIONS,
  GovernanceDatasetDefinition,
  NON_GOVERNED_DATASET_REASONS,
  UNRESOLVED_GOVERNANCE_MODELS,
  UNRESOLVED_GOVERNANCE_CATEGORIES,
} from '../registry/governance-dataset.registry';

@Injectable()
export class GovernanceCatalogService {
  private readonly definitions = GOVERNANCE_DATASET_DEFINITIONS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private isKnownPrismaModel(modelName: string): boolean {
    return Object.values(Prisma.ModelName).some(
      (model) => model[0].toLowerCase() + model.slice(1) === modelName,
    );
  }

  listDefinitions(): readonly GovernanceDatasetDefinition[] {
    return this.definitions;
  }

  getGovernanceCoverage() {
    return {
      governed: this.definitions.map((definition) => definition.datasetKey),
      nonGoverned: NON_GOVERNED_DATASET_REASONS,
      unresolved: UNRESOLVED_GOVERNANCE_MODELS,
      unresolvedCategories: UNRESOLVED_GOVERNANCE_CATEGORIES,
    };
  }

  getDefinition(datasetKey: string): GovernanceDatasetDefinition {
    const definition = this.definitions.find((item) => item.datasetKey === datasetKey);
    if (!definition) {
      throw new NotFoundException(`Governance dataset "${datasetKey}" is not registered.`);
    }
    return definition;
  }

  async get(datasetKey: string): Promise<GovernanceDataset> {
    this.getDefinition(datasetKey);
    const dataset = await this.prisma.governanceDataset.findUnique({
      where: { datasetKey },
    });
    if (!dataset || !dataset.isActive) {
      throw new NotFoundException(`Governance dataset "${datasetKey}" is not active.`);
    }
    return dataset;
  }

  async bootstrap(): Promise<{ created: number; updated: number }> {
    this.validateDefinitions();
    let created = 0;
    let updated = 0;
    for (const definition of this.definitions) {
      const result = await this.prisma.governanceDataset.upsert({
        where: { datasetKey: definition.datasetKey },
        create: this.toCreateInput(definition),
        update: this.toUpdateInput(definition),
      });
      if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
      else updated++;
    }
    return { created, updated };
  }

  validateDefinitions(): void {
    const keys = new Set<string>();
    const modelNames = new Set<string>();
    for (const definition of this.definitions) {
      if (!definition.datasetKey || keys.has(definition.datasetKey)) {
        throw new ConflictException(`Duplicate governance dataset key: ${definition.datasetKey}`);
      }
      keys.add(definition.datasetKey);
      if (!Object.values(GovernanceClassification).includes(definition.classification)) {
        throw new BadRequestException(`Invalid classification for ${definition.datasetKey}.`);
      }
      if (!Object.values(GovernanceDeletionStrategy).includes(definition.deletionStrategy)) {
        throw new BadRequestException(`Invalid deletion strategy for ${definition.datasetKey}.`);
      }
      if (definition.modelName && modelNames.has(definition.modelName)) {
        throw new ConflictException(`Duplicate governed Prisma model mapping: ${definition.modelName}`);
      }
      if (definition.modelName) modelNames.add(definition.modelName);
      if (
        definition.modelName &&
        !this.isKnownPrismaModel(definition.modelName)
      ) {
        throw new BadRequestException(
          `Governance dataset "${definition.datasetKey}" maps to unknown Prisma model "${definition.modelName}".`,
        );
      }
      if (!definition.containsPii && definition.deletionStrategy === GovernanceDeletionStrategy.ANONYMIZE_PII) {
        throw new BadRequestException(`PII anonymization strategy requires PII metadata: ${definition.datasetKey}.`);
      }
      if (
        definition.metadata?.financialFacts === true &&
        definition.deletionStrategy !== GovernanceDeletionStrategy.IMMUTABLE_FINANCIAL_RETAIN
      ) {
        throw new BadRequestException(
          `Financial dataset "${definition.datasetKey}" must use immutable financial retention.`,
        );
      }
    }
  }

  validateCompleteness(): {
    governed: string[];
    nonGoverned: Record<string, string>;
    unresolved: string[];
  } {
    this.validateDefinitions();
    const governedModels = new Set(
      this.definitions.flatMap((definition) =>
        definition.modelName ? [definition.modelName] : [],
      ),
    );
    const excludedModels = new Set(Object.keys(NON_GOVERNED_DATASET_REASONS));
    const unresolved = Object.keys(UNRESOLVED_GOVERNANCE_MODELS);
    const categories = new Map<string, string>();
    for (const model of governedModels) categories.set(model, 'GOVERNED');
    for (const model of excludedModels) {
      if (categories.has(model)) {
        throw new ConflictException(`Model has multiple governance categories: ${model}`);
      }
      categories.set(model, 'NON_GOVERNED_TECHNICAL');
    }
    for (const model of unresolved) {
      if (categories.has(model)) {
        throw new ConflictException(`Model has multiple governance categories: ${model}`);
      }
      if (!this.isKnownPrismaModel(model)) {
        throw new BadRequestException(`Unresolved governance model is not a Prisma model: ${model}`);
      }
      categories.set(model, 'UNRESOLVED');
    }
    const unclassified = Object.values(Prisma.ModelName)
      .map((modelName) => modelName[0].toLowerCase() + modelName.slice(1))
      .filter((modelName) => !categories.has(modelName));
    if (unclassified.length > 0) {
      throw new BadRequestException(
        `Governance coverage has unclassified Prisma models: ${unclassified.join(', ')}`,
      );
    }
    return {
      governed: this.definitions.map((definition) => definition.datasetKey),
      nonGoverned: NON_GOVERNED_DATASET_REASONS,
      unresolved,
    };
  }

  private toCreateInput(
    definition: GovernanceDatasetDefinition,
  ): Prisma.GovernanceDatasetCreateInput {
    return {
      datasetKey: definition.datasetKey,
      displayName: definition.displayName,
      modelName: definition.modelName,
      classification: definition.classification,
      deletionStrategy: definition.deletionStrategy,
      retentionApplicable: definition.retentionApplicable,
      containsPii: definition.containsPii,
      containsSensitiveData: definition.containsSensitiveData,
      metadata: definition.metadata as Prisma.InputJsonValue | undefined,
      version: 1,
      isActive: true,
    };
  }

  private toUpdateInput(
    definition: GovernanceDatasetDefinition,
  ): Prisma.GovernanceDatasetUpdateInput {
    return {
      displayName: definition.displayName,
      modelName: definition.modelName,
      classification: definition.classification,
      deletionStrategy: definition.deletionStrategy,
      retentionApplicable: definition.retentionApplicable,
      containsPii: definition.containsPii,
      containsSensitiveData: definition.containsSensitiveData,
      metadata: definition.metadata as Prisma.InputJsonValue | undefined,
      isActive: true,
    };
  }
}
