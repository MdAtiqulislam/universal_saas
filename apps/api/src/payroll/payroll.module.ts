import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { BudgetsModule } from '../accounting/budgets/budgets.module';
import { AccountingModule } from '../accounting/accounting.module';
import { PaymentsModule } from '../payments/payments.module';

// HR Services & Controllers
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { DepartmentsService } from './departments.service';
import { DepartmentsController } from './departments.controller';
import { JobPositionsService } from './job-positions.service';
import { JobPositionsController } from './job-positions.controller';
import { CompensationService } from './compensation.service';

// Payroll Services & Controllers
import { PayrollConfigService } from './payroll-config.service';
import { PayrollComponentsService } from './payroll-components.service';
import { PayrollPeriodsService } from './payroll-periods.service';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayrollPostingService } from './payroll-posting.service';
import { PayrollPaymentService } from './payroll-payment.service';
import { PayrollBudgetService } from './payroll-budget.service';
import { PayrollReportsService } from './payroll-reports.service';
import { PayrollController } from './payroll.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EventsModule,
    MasterDataModule,
    BudgetsModule,
    AccountingModule,
    PaymentsModule,
  ],
  controllers: [
    EmployeesController,
    DepartmentsController,
    JobPositionsController,
    PayrollController,
  ],
  providers: [
    EmployeesService,
    DepartmentsService,
    JobPositionsService,
    CompensationService,
    PayrollConfigService,
    PayrollComponentsService,
    PayrollPeriodsService,
    PayrollCalculationService,
    PayrollPostingService,
    PayrollPaymentService,
    PayrollBudgetService,
    PayrollReportsService,
  ],
  exports: [
    EmployeesService,
    DepartmentsService,
    JobPositionsService,
    CompensationService,
    PayrollConfigService,
    PayrollComponentsService,
    PayrollPeriodsService,
    PayrollCalculationService,
    PayrollPostingService,
    PayrollPaymentService,
    PayrollBudgetService,
    PayrollReportsService,
  ],
})
export class PayrollModule {}
