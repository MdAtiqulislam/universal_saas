import { Injectable } from '@nestjs/common';
import { TaxJurisdictionsService } from './tax-jurisdictions.service';
import { TaxCodesService } from './tax-codes.service';
import { TaxRatesService } from './tax-rates.service';
import { TaxRulesService } from './tax-rules.service';
import { TaxCalculationService } from './tax-calculation.service';
import { TaxTransactionsService } from './tax-transactions.service';
import { TaxPeriodsService } from './tax-periods.service';
import { TaxReportingService } from './tax-reporting.service';
import { CreateTaxJurisdictionDto } from './dto/create-tax-jurisdiction.dto';
import { UpdateTaxJurisdictionDto } from './dto/update-tax-jurisdiction.dto';
import { CreateTaxCodeDto } from './dto/create-tax-code.dto';
import { UpdateTaxCodeDto } from './dto/update-tax-code.dto';
import { CreateEffectiveTaxRateDto } from './dto/create-effective-tax-rate.dto';
import { UpdateEffectiveTaxRateDto } from './dto/update-effective-tax-rate.dto';
import { CreateTaxRuleDto } from './dto/create-tax-rule.dto';
import { UpdateTaxRuleDto } from './dto/update-tax-rule.dto';
import { CalculateTaxDto } from './dto/calculate-tax.dto';
import { RecordTaxTransactionDto } from './dto/record-tax-transaction.dto';
import { CreateTaxPeriodDto } from './dto/create-tax-period.dto';
import { TaxReportQueryDto } from './dto/tax-report-query.dto';

@Injectable()
export class TaxService {
  constructor(
    public readonly jurisdictions: TaxJurisdictionsService,
    public readonly codes: TaxCodesService,
    public readonly rates: TaxRatesService,
    public readonly rules: TaxRulesService,
    public readonly calculation: TaxCalculationService,
    public readonly transactions: TaxTransactionsService,
    public readonly periods: TaxPeriodsService,
    public readonly reporting: TaxReportingService,
  ) {}

  // Jurisdictions
  async createJurisdiction(orgId: string, dto: CreateTaxJurisdictionDto) {
    return this.jurisdictions.create(orgId, dto);
  }
  async findJurisdictions(orgId: string) {
    return this.jurisdictions.findAll(orgId);
  }
  async findJurisdiction(orgId: string, id: string) {
    return this.jurisdictions.findOne(orgId, id);
  }
  async updateJurisdiction(
    orgId: string,
    id: string,
    dto: UpdateTaxJurisdictionDto,
  ) {
    return this.jurisdictions.update(orgId, id, dto);
  }

  // Codes
  async createCode(orgId: string, dto: CreateTaxCodeDto, userId?: string) {
    return this.codes.create(orgId, dto, userId);
  }
  async findCodes(orgId: string) {
    return this.codes.findAll(orgId);
  }
  async findCode(orgId: string, id: string) {
    return this.codes.findOne(orgId, id);
  }
  async updateCode(
    orgId: string,
    id: string,
    dto: UpdateTaxCodeDto,
    userId?: string,
  ) {
    return this.codes.update(orgId, id, dto, userId);
  }
  async deleteCode(orgId: string, id: string) {
    return this.codes.delete(orgId, id);
  }

  // Rates
  async createRate(
    orgId: string,
    dto: CreateEffectiveTaxRateDto,
    userId?: string,
  ) {
    return this.rates.create(orgId, dto, userId);
  }
  async findRates(orgId: string, taxCodeId?: string) {
    return this.rates.findAll(orgId, taxCodeId);
  }
  async findRate(orgId: string, id: string) {
    return this.rates.findOne(orgId, id);
  }
  async updateRate(orgId: string, id: string, dto: UpdateEffectiveTaxRateDto) {
    return this.rates.update(orgId, id, dto);
  }

  // Rules
  async createRule(orgId: string, dto: CreateTaxRuleDto, userId?: string) {
    return this.rules.create(orgId, dto, userId);
  }
  async findRules(orgId: string) {
    return this.rules.findAll(orgId);
  }
  async findRule(orgId: string, id: string) {
    return this.rules.findOne(orgId, id);
  }
  async updateRule(orgId: string, id: string, dto: UpdateTaxRuleDto) {
    return this.rules.update(orgId, id, dto);
  }
  async deleteRule(orgId: string, id: string) {
    return this.rules.delete(orgId, id);
  }

  // Calculation
  async calculateTax(orgId: string, dto: CalculateTaxDto, userId?: string) {
    return this.calculation.calculate(orgId, dto, userId);
  }

  // Transactions
  async recordTransaction(
    orgId: string,
    dto: RecordTaxTransactionDto,
    userId?: string,
  ) {
    return this.transactions.record(orgId, dto, userId);
  }
  async findTransactions(orgId: string, query: TaxReportQueryDto) {
    return this.transactions.findAll(orgId, query);
  }

  // Periods
  async createPeriod(orgId: string, dto: CreateTaxPeriodDto) {
    return this.periods.create(orgId, dto);
  }
  async findPeriods(orgId: string) {
    return this.periods.findAll(orgId);
  }
  async findPeriod(orgId: string, id: string) {
    return this.periods.findOne(orgId, id);
  }
  async preparePeriod(orgId: string, id: string, userId: string) {
    return this.periods.prepare(orgId, id, userId);
  }
  async lockPeriod(orgId: string, id: string, userId: string) {
    return this.periods.lock(orgId, id, userId);
  }

  // Reports
  async getSummaryReport(orgId: string, query: TaxReportQueryDto) {
    return this.reporting.getSummary(orgId, query);
  }
  async getOutputTaxReport(orgId: string, query: TaxReportQueryDto) {
    return this.reporting.getOutputTaxReport(orgId, query);
  }
  async getInputTaxReport(orgId: string, query: TaxReportQueryDto) {
    return this.reporting.getInputTaxReport(orgId, query);
  }
  async getReportByCode(orgId: string, query: TaxReportQueryDto) {
    return this.reporting.getReportByTaxCode(orgId, query);
  }
  async getReportByJurisdiction(orgId: string, query: TaxReportQueryDto) {
    return this.reporting.getReportByJurisdiction(orgId, query);
  }
}
