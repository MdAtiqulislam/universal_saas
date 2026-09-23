import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BomStatus, Prisma } from '@prisma/client';

export interface ExplodedMaterialRequirement {
  level: number;
  parentItemId: string;
  itemId: string;
  variantId?: string | null;
  requiredQuantity: Prisma.Decimal;
  scrapPercentage: Prisma.Decimal;
  uomId?: string | null;
  bomId: string;
  bomNumber: string;
  isLeaf: boolean; // Leaf means no active sub-BOM found (raw/purchased item)
}

@Injectable()
export class BomExplosionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recursively explode a Bill of Materials for a target item and demand quantity.
   */
  async explode(
    organizationId: string,
    itemId: string,
    demandQuantity: Prisma.Decimal,
    variantId?: string | null,
    specificBomId?: string | null,
  ): Promise<ExplodedMaterialRequirement[]> {
    const visitedItemIds = new Set<string>();
    const results: ExplodedMaterialRequirement[] = [];

    await this.explodeRecursive(
      organizationId,
      itemId,
      demandQuantity,
      0,
      visitedItemIds,
      results,
      variantId,
      specificBomId,
    );

    return results;
  }

  private async explodeRecursive(
    organizationId: string,
    currentItemId: string,
    currentQuantity: Prisma.Decimal,
    currentLevel: number,
    visitedItemIds: Set<string>,
    results: ExplodedMaterialRequirement[],
    variantId?: string | null,
    specificBomId?: string | null,
  ): Promise<void> {
    if (visitedItemIds.has(currentItemId)) {
      throw new BadRequestException(
        `Circular BOM structure detected involving item ID ${currentItemId}.`,
      );
    }

    visitedItemIds.add(currentItemId);

    // Find active BOM for current item
    const bomWhere: Prisma.BillOfMaterialWhereInput = {
      organizationId,
      itemId: currentItemId,
      status: BomStatus.ACTIVE,
    };

    if (specificBomId && currentLevel === 0) {
      bomWhere.id = specificBomId;
    } else if (variantId) {
      bomWhere.variantId = variantId;
    }

    const bom = await this.prisma.billOfMaterial.findFirst({
      where: bomWhere,
      include: {
        lines: {
          include: {
            item: true,
          },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (!bom || bom.lines.length === 0) {
      // Leaf item: reached raw material or purchased component
      visitedItemIds.delete(currentItemId);
      return;
    }

    // Explode each component line
    for (const line of bom.lines) {
      const lineQty = new Prisma.Decimal(line.quantity);
      const bomHeaderQty = new Prisma.Decimal(bom.quantity);
      const scrapMultiplier = new Prisma.Decimal(1).plus(
        new Prisma.Decimal(line.scrapPercentage).dividedBy(100),
      );

      // Component required = (demandQty / bomQty) * lineQty * (1 + scrap%)
      const componentGross = currentQuantity
        .dividedBy(bomHeaderQty)
        .times(lineQty)
        .times(scrapMultiplier);

      // Check if component itself has an active sub-BOM
      const subBom = await this.prisma.billOfMaterial.findFirst({
        where: {
          organizationId,
          itemId: line.itemId,
          status: BomStatus.ACTIVE,
        },
      });

      const isLeaf = !subBom;

      results.push({
        level: currentLevel + 1,
        parentItemId: currentItemId,
        itemId: line.itemId,
        variantId: line.variantId,
        requiredQuantity: componentGross,
        scrapPercentage: line.scrapPercentage,
        uomId: line.uomId,
        bomId: bom.id,
        bomNumber: bom.bomNumber,
        isLeaf,
      });

      if (subBom) {
        // Recursive sub-assembly explosion
        await this.explodeRecursive(
          organizationId,
          line.itemId,
          componentGross,
          currentLevel + 1,
          new Set(visitedItemIds),
          results,
          line.variantId,
          subBom.id,
        );
      }
    }

    visitedItemIds.delete(currentItemId);
  }
}
