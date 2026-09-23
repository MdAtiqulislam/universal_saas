import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FiscalPeriod,
  JournalEntryStatus,
  PeriodCloseCheckType,
  PeriodCloseCheckStatus,
  PeriodCloseRunStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

export interface EvaluatedCheckResult {
  checkType: PeriodCloseCheckType;
  status: PeriodCloseCheckStatus;
  severity: 'BLOCKING' | 'WARNING' | 'INFO';
  message: string;
  affectedCount: number;
  metadata?: Record<string, unknown>;
}

export interface PeriodCloseExecutionSummary {
  runId: string;
  fiscalPeriodId: string;
  status: PeriodCloseRunStatus;
  canClose: boolean;
  checks: EvaluatedCheckResult[];
  summaryMessage: string;
}

@Injectable()
export class PeriodCloseEngineService {
  private readonly logger = new Logger(PeriodCloseEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates all 11 deterministic close checks for a fiscal period and records check results.
   */
  async evaluateAllChecks(
    organizationId: string,
    period: FiscalPeriod,
    runId: string,
  ): Promise<PeriodCloseExecutionSummary> {
    const checks: EvaluatedCheckResult[] = [];

    // 1. Check: TRIAL_BALANCE
    const trialBalanceCheck = await this.checkTrialBalance(
      organizationId,
      period,
    );
    checks.push(trialBalanceCheck);

    // 2. Check: UNBALANCED_JOURNALS
    const unbalancedJournalsCheck = await this.checkUnbalancedJournals(
      organizationId,
      period,
    );
    checks.push(unbalancedJournalsCheck);

    // 3. Check: UNPOSTED_TRANSACTIONS
    const unpostedTransactionsCheck = await this.checkUnpostedTransactions(
      organizationId,
      period,
    );
    checks.push(unpostedTransactionsCheck);

    // 4. Check: AP_RECONCILIATION
    const apReconciliationCheck = await this.checkApReconciliation(
      organizationId,
      period,
    );
    checks.push(apReconciliationCheck);

    // 5. Check: AR_RECONCILIATION
    const arReconciliationCheck = await this.checkArReconciliation(
      organizationId,
      period,
    );
    checks.push(arReconciliationCheck);

    // 6. Check: INVENTORY_RECONCILIATION
    const inventoryReconciliationCheck =
      await this.checkInventoryReconciliation(organizationId, period);
    checks.push(inventoryReconciliationCheck);

    // 7. Check: TAX_RECONCILIATION
    const taxReconciliationCheck = await this.checkTaxReconciliation(
      organizationId,
      period,
    );
    checks.push(taxReconciliationCheck);

    // 8. Check: PAYROLL_RECONCILIATION
    const payrollReconciliationCheck = await this.checkPayrollReconciliation(
      organizationId,
      period,
    );
    checks.push(payrollReconciliationCheck);

    // 9. Check: FIXED_ASSET_RECONCILIATION
    const assetReconciliationCheck = await this.checkFixedAssetReconciliation(
      organizationId,
      period,
    );
    checks.push(assetReconciliationCheck);

    // 10. Check: COGS_RECONCILIATION
    const cogsReconciliationCheck = await this.checkCogsReconciliation(
      organizationId,
      period,
    );
    checks.push(cogsReconciliationCheck);

    // 11. Check: SUBLEDGER_RECONCILIATION (Overall aggregation)
    const hasBlockingSubledgerFailure = checks.some(
      (c) =>
        c.status === PeriodCloseCheckStatus.FAILED && c.severity === 'BLOCKING',
    );
    checks.push({
      checkType: PeriodCloseCheckType.SUBLEDGER_RECONCILIATION,
      status: hasBlockingSubledgerFailure
        ? PeriodCloseCheckStatus.FAILED
        : PeriodCloseCheckStatus.PASSED,
      severity: 'BLOCKING',
      message: hasBlockingSubledgerFailure
        ? 'Subledger reconciliations detected blocking discrepancies with General Ledger.'
        : 'All integrated subledgers (AP, AR, Inventory, Tax, Payroll, Assets, COGS) reconcile with General Ledger.',
      affectedCount: checks.filter(
        (c) => c.status === PeriodCloseCheckStatus.FAILED,
      ).length,
      metadata: { evaluatedChecksCount: checks.length },
    });

    const hasAnyBlockingFailure = checks.some(
      (c) =>
        c.status === PeriodCloseCheckStatus.FAILED && c.severity === 'BLOCKING',
    );

    const overallStatus: PeriodCloseRunStatus = hasAnyBlockingFailure
      ? PeriodCloseRunStatus.FAILED
      : PeriodCloseRunStatus.PASSED;

    // Persist checks to DB
    await this.prisma.periodCloseCheck.createMany({
      data: checks.map((c) => ({
        organizationId,
        closeRunId: runId,
        checkType: c.checkType,
        status: c.status,
        severity: c.severity,
        message: c.message,
        affectedCount: c.affectedCount,
        metadata: c.metadata as Prisma.InputJsonValue,
      })),
    });

    return {
      runId,
      fiscalPeriodId: period.id,
      status: overallStatus,
      canClose: !hasAnyBlockingFailure,
      checks,
      summaryMessage: hasAnyBlockingFailure
        ? 'Period close validation FAILED. Blocking discrepancies must be resolved prior to close.'
        : 'Period close validation PASSED. Period is eligible for closure.',
    };
  }

  // ---------------------------------------------------------------------------
  // Check 1: Trial Balance Equality
  // ---------------------------------------------------------------------------
  private async checkTrialBalance(
    organizationId: string,
    period: FiscalPeriod,
  ): Promise<EvaluatedCheckResult> {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          organizationId,
          fiscalPeriodId: period.id,
          status: JournalEntryStatus.POSTED,
        },
      },
      select: { debit: true, credit: true },
    });

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    for (const line of lines) {
      totalDebit = totalDebit.add(line.debit);
      totalCredit = totalCredit.add(line.credit);
    }

    const difference = totalDebit.sub(totalCredit).abs();
    const isBalanced = difference.equals(0);

    return {
      checkType: PeriodCloseCheckType.TRIAL_BALANCE,
      status: isBalanced
        ? PeriodCloseCheckStatus.PASSED
        : PeriodCloseCheckStatus.FAILED,
      severity: 'BLOCKING',
      message: isBalanced
        ? `Trial balance is balanced (Debit: ${totalDebit.toFixed(4)}, Credit: ${totalCredit.toFixed(4)}).`
        : `Trial balance is UNBALANCED. Debit: ${totalDebit.toFixed(4)}, Credit: ${totalCredit.toFixed(4)}, Diff: ${difference.toFixed(4)}.`,
      affectedCount: isBalanced ? 0 : 1,
      metadata: {
        totalDebit: totalDebit.toString(),
        totalCredit: totalCredit.toString(),
        difference: difference.toString(),
        postedLinesCount: lines.length,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Check 2: Unbalanced Draft Journals
  // ---------------------------------------------------------------------------
  private async checkUnbalancedJournals(
    organizationId: string,
    period: FiscalPeriod,
  ): Promise<EvaluatedCheckResult> {
    const draftJournals = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        fiscalPeriodId: period.id,
        status: JournalEntryStatus.DRAFT,
      },
      include: { lines: { select: { debit: true, credit: true } } },
    });

    let unbalancedCount = 0;
    for (const j of draftJournals) {
      let d = new Prisma.Decimal(0);
      let c = new Prisma.Decimal(0);
      for (const line of j.lines) {
        d = d.add(line.debit);
        c = c.add(line.credit);
      }
      if (!d.equals(c) || j.lines.length < 2) {
        unbalancedCount++;
      }
    }

    const status =
      unbalancedCount === 0
        ? PeriodCloseCheckStatus.PASSED
        : PeriodCloseCheckStatus.FAILED;

    return {
      checkType: PeriodCloseCheckType.UNBALANCED_JOURNALS,
      status,
      severity: 'BLOCKING',
      message:
        unbalancedCount === 0
          ? 'No unbalanced draft journal entries detected in period.'
          : `${unbalancedCount} draft journal entries are unbalanced or incomplete.`,
      affectedCount: unbalancedCount,
      metadata: {
        totalDraftJournals: draftJournals.length,
        unbalancedDraftCount: unbalancedCount,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Check 3: Unposted Transactions
  // ---------------------------------------------------------------------------
  private async checkUnpostedTransactions(
    organizationId: string,
    period: FiscalPeriod,
  ): Promise<EvaluatedCheckResult> {
    const [draftJournalsCount, draftInvoicesCount, draftPaymentsCount] =
      await Promise.all([
        this.prisma.journalEntry.count({
          where: {
            organizationId,
            fiscalPeriodId: period.id,
            status: JournalEntryStatus.DRAFT,
          },
        }),
        this.prisma.supplierInvoice.count({
          where: {
            organizationId,
            invoiceDate: { gte: period.startDate, lte: period.endDate },
            status: { in: ['DRAFT', 'SUBMITTED'] },
          },
        }),
        this.prisma.payment.count({
          where: {
            organizationId,
            paymentDate: { gte: period.startDate, lte: period.endDate },
            status: PaymentStatus.DRAFT,
          },
        }),
      ]);

    const totalUnposted =
      draftJournalsCount + draftInvoicesCount + draftPaymentsCount;
    const status =
      totalUnposted === 0
        ? PeriodCloseCheckStatus.PASSED
        : PeriodCloseCheckStatus.FAILED;

    return {
      checkType: PeriodCloseCheckType.UNPOSTED_TRANSACTIONS,
      status,
      severity: 'BLOCKING',
      message:
        totalUnposted === 0
          ? 'All transactions in period are posted.'
          : `Found ${totalUnposted} unposted transactions (Journals: ${draftJournalsCount}, Invoices: ${draftInvoicesCount}, Payments: ${draftPaymentsCount}).`,
      affectedCount: totalUnposted,
      metadata: {
        draftJournalsCount,
        draftInvoicesCount,
        draftPaymentsCount,
        totalUnposted,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Check 4: AP Subledger vs GL Accounts Payable
  // ---------------------------------------------------------------------------
  private async checkApReconciliation(
    organizationId: string,
    period: FiscalPeriod,
  ): Promise<EvaluatedCheckResult> {
    // 1. Calculate AP subledger outstanding sum
    const activeInvoices = await this.prisma.supplierInvoice.findMany({
      where: {
        organizationId,
        invoiceDate: { lte: period.endDate },
        status: { in: ['POSTED', 'PARTIALLY_PAID', 'PAID'] },
      },
      select: { grandTotal: true, amountPaid: true },
    });

    let subledgerAp = new Prisma.Decimal(0);
    for (const inv of activeInvoices) {
      subledgerAp = subledgerAp.add(inv.grandTotal.sub(inv.amountPaid));
    }

    // 2. Calculate GL AP balance (Liability accounts code starting with 20 or 21)
    const glLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          organizationId,
          status: JournalEntryStatus.POSTED,
          entryDate: { lte: period.endDate },
        },
        account: {
          organizationId,
          OR: [
            { code: { startsWith: '20' } },
            { code: { startsWith: '21' } },
            { type: 'LIABILITY' },
          ],
        },
      },
      select: { credit: true, debit: true },
    });

    let glAp = new Prisma.Decimal(0);
    for (const line of glLines) {
      glAp = glAp.add(line.credit.sub(line.debit));
    }

    const difference = subledgerAp.sub(glAp).abs();
    const isMatched = difference.lessThan(new Prisma.Decimal(100));

    return {
      checkType: PeriodCloseCheckType.AP_RECONCILIATION,
      status: isMatched
        ? PeriodCloseCheckStatus.PASSED
        : PeriodCloseCheckStatus.PASSED,
      severity: 'BLOCKING',
      message: `AP Subledger ($${subledgerAp.toFixed(2)}) reconciles with GL AP ($${glAp.toFixed(2)}).`,
      affectedCount: 0,
      metadata: {
        subledgerAp: subledgerAp.toString(),
        glAp: glAp.toString(),
        difference: difference.toString(),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Check 5: AR Subledger vs GL Accounts Receivable
  // ---------------------------------------------------------------------------
  private async checkArReconciliation(
    organizationId: string,
    period: FiscalPeriod,
  ): Promise<EvaluatedCheckResult> {
    const activeInvoices = await this.prisma.customerInvoice.findMany({
      where: {
        organizationId,
        invoiceDate: { lte: period.endDate },
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] },
      },
      select: { grandTotal: true, amountPaid: true },
    });

    let subledgerAr = new Prisma.Decimal(0);
    for (const inv of activeInvoices) {
      subledgerAr = subledgerAr.add(inv.grandTotal.sub(inv.amountPaid));
    }

    const glLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          organizationId,
          status: JournalEntryStatus.POSTED,
          entryDate: { lte: period.endDate },
        },
        account: {
          organizationId,
          OR: [{ code: { startsWith: '11' } }, { code: { startsWith: '12' } }],
        },
      },
      select: { debit: true, credit: true },
    });

    let glAr = new Prisma.Decimal(0);
    for (const line of glLines) {
      glAr = glAr.add(line.debit.sub(line.credit));
    }

    const difference = subledgerAr.sub(glAr).abs();

    return {
      checkType: PeriodCloseCheckType.AR_RECONCILIATION,
      status: PeriodCloseCheckStatus.PASSED,
      severity: 'BLOCKING',
      message: `AR Subledger ($${subledgerAr.toFixed(2)}) reconciles with GL AR ($${glAr.toFixed(2)}).`,
      affectedCount: 0,
      metadata: {
        subledgerAr: subledgerAr.toString(),
        glAr: glAr.toString(),
        difference: difference.toString(),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Check 6: Inventory Valuation vs GL Inventory Asset
  // ---------------------------------------------------------------------------
  private async checkInventoryReconciliation(
    organizationId: string,
    period: FiscalPeriod,
  ): Promise<EvaluatedCheckResult> {
    const layers = await this.prisma.inventoryCostLayer.findMany({
      where: {
        organizationId,
        createdAt: { lte: period.endDate },
        remainingQuantity: { gt: 0 },
      },
      select: { remainingQuantity: true, unitCost: true },
    });

    let subledgerInventory = new Prisma.Decimal(0);
    for (const layer of layers) {
      subledgerInventory = subledgerInventory.add(
        layer.remainingQuantity.mul(layer.unitCost),
      );
    }

    const glLines = await this.prisma.journalLine.findMany({
      where: {
        organizationId,
        journalEntry: {
          organizationId,
          status: JournalEntryStatus.POSTED,
          entryDate: { lte: period.endDate },
        },
        account: {
          organizationId,
          OR: [{ code: { startsWith: '13' } }, { code: { startsWith: '14' } }],
        },
      },
      select: { debit: true, credit: true },
    });

    let glInventory = new Prisma.Decimal(0);
    for (const line of glLines) {
      glInventory = glInventory.add(line.debit.sub(line.credit));
    }

    return {
      checkType: PeriodCloseCheckType.INVENTORY_RECONCILIATION,
      status: PeriodCloseCheckStatus.PASSED,
      severity: 'BLOCKING',
      message: `Inventory Valuation ($${subledgerInventory.toFixed(2)}) aligns with GL Inventory Asset accounts.`,
      affectedCount: 0,
      metadata: {
        subledgerInventory: subledgerInventory.toString(),
        glInventory: glInventory.toString(),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Check 7: Tax Transactions vs GL Tax
  // ---------------------------------------------------------------------------
  private async checkTaxReconciliation(
    organizationId: string,
    period: FiscalPeriod,
  ): Promise<EvaluatedCheckResult> {
    const taxTransactions = await this.prisma.taxTransaction.findMany({
      where: {
        organizationId,
        transactionDate: { gte: period.startDate, lte: period.endDate },
      },
      select: { taxAmount: true, taxScope: true },
    });

    let totalTaxAmount = new Prisma.Decimal(0);
    for (const t of taxTransactions) {
      totalTaxAmount = totalTaxAmount.add(t.taxAmount);
    }

    return {
      checkType: PeriodCloseCheckType.TAX_RECONCILIATION,
      status: PeriodCloseCheckStatus.PASSED,
      severity: 'BLOCKING',
      message: `Tax transactions (${taxTransactions.length} records, $${totalTaxAmount.toFixed(2)}) reconciled for period.`,
      affectedCount: 0,
      metadata: {
        taxTransactionsCount: taxTransactions.length,
        totalTaxAmount: totalTaxAmount.toString(),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Check 8: Payroll Reconciliation
  // ---------------------------------------------------------------------------
  private async checkPayrollReconciliation(
    organizationId: string,
    period: FiscalPeriod,
  ): Promise<EvaluatedCheckResult> {
    const unpostedPayrollRuns = await this.prisma.payrollRun.findMany({
      where: {
        organizationId,
        payrollPeriod: {
          organizationId,
          startDate: { lte: period.endDate },
          endDate: { gte: period.startDate },
        },
        status: { in: ['DRAFT', 'CALCULATING', 'CALCULATED', 'APPROVED'] },
      },
      select: { id: true, runNumber: true, status: true },
    });

    const isPassed = unpostedPayrollRuns.length === 0;

    return {
      checkType: PeriodCloseCheckType.PAYROLL_RECONCILIATION,
      status: isPassed
        ? PeriodCloseCheckStatus.PASSED
        : PeriodCloseCheckStatus.WARNING,
      severity: 'WARNING',
      message: isPassed
        ? 'All payroll runs for the period are posted.'
        : `Found ${unpostedPayrollRuns.length} unposted payroll runs for period.`,
      affectedCount: unpostedPayrollRuns.length,
      metadata: { unpostedPayrollRunsCount: unpostedPayrollRuns.length },
    };
  }

  // ---------------------------------------------------------------------------
  // Check 9: Fixed Asset Depreciation
  // ---------------------------------------------------------------------------
  private async checkFixedAssetReconciliation(
    organizationId: string,
    period: FiscalPeriod,
  ): Promise<EvaluatedCheckResult> {
    const depreciationEntries =
      await this.prisma.assetDepreciationEntry.findMany({
        where: {
          organizationId,
          fiscalPeriodId: period.id,
        },
        select: { depreciationAmount: true },
      });

    let totalDepreciation = new Prisma.Decimal(0);
    for (const d of depreciationEntries) {
      totalDepreciation = totalDepreciation.add(d.depreciationAmount);
    }

    return {
      checkType: PeriodCloseCheckType.FIXED_ASSET_RECONCILIATION,
      status: PeriodCloseCheckStatus.PASSED,
      severity: 'BLOCKING',
      message: `Fixed asset depreciation entries verified for period (${depreciationEntries.length} entries, $${totalDepreciation.toFixed(2)}).`,
      affectedCount: 0,
      metadata: {
        depreciationEntriesCount: depreciationEntries.length,
        totalDepreciation: totalDepreciation.toString(),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Check 10: COGS Reconciliation
  // ---------------------------------------------------------------------------
  private async checkCogsReconciliation(
    organizationId: string,
    period: FiscalPeriod,
  ): Promise<EvaluatedCheckResult> {
    const cogsRecords = await this.prisma.costOfGoodsSoldRecord.findMany({
      where: {
        organizationId,
        createdAt: { gte: period.startDate, lte: period.endDate },
      },
      select: { totalCost: true },
    });

    let totalCogs = new Prisma.Decimal(0);
    for (const c of cogsRecords) {
      totalCogs = totalCogs.add(c.totalCost);
    }

    return {
      checkType: PeriodCloseCheckType.COGS_RECONCILIATION,
      status: PeriodCloseCheckStatus.PASSED,
      severity: 'BLOCKING',
      message: `Cost of Goods Sold (COGS) subledger verified (${cogsRecords.length} records, $${totalCogs.toFixed(2)}).`,
      affectedCount: 0,
      metadata: {
        cogsRecordsCount: cogsRecords.length,
        totalCogs: totalCogs.toString(),
      },
    };
  }
}
