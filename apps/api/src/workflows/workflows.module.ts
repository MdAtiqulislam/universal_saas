import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

// Rules
import { RuleValidatorService } from './rules/rule-validator.service';
import { RulesEngineService } from './rules/rules-engine.service';
import { RulesController } from './rules/rules.controller';

// Graph & Definitions
import { WorkflowGraphValidatorService } from './definitions/workflow-graph-validator.service';
import { WorkflowDefinitionsService } from './definitions/workflow-definitions.service';
import { WorkflowDefinitionsController } from './definitions/workflow-definitions.controller';

// Versions
import { WorkflowVersionsService } from './versions/workflow-versions.service';
import { WorkflowVersionsController } from './versions/workflow-versions.controller';

// Triggers
import { TriggerCatalogService } from './triggers/trigger-catalog.service';
import { WorkflowTriggersService } from './triggers/workflow-triggers.service';

// Actions
import { ActionCatalogService } from './actions/action-catalog.service';
import { WorkflowActionExecutorService } from './actions/workflow-action-executor.service';

// Approvals
import { WorkflowApprovalsService } from './approvals/workflow-approvals.service';
import { WorkflowApprovalsController } from './approvals/workflow-approvals.controller';

// Schedules
import { WorkflowSchedulesService } from './schedules/workflow-schedules.service';
import { WorkflowSchedulesController } from './schedules/workflow-schedules.controller';

// Executions
import { WorkflowExecutionService } from './executions/workflow-execution.service';
import { WorkflowExecutionsController } from './executions/workflow-executions.controller';

// Reports
import { WorkflowReportsService } from './reports/workflow-reports.service';
import { WorkflowReportsController } from './reports/workflow-reports.controller';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [
    RulesController,
    WorkflowDefinitionsController,
    WorkflowVersionsController,
    WorkflowApprovalsController,
    WorkflowSchedulesController,
    WorkflowExecutionsController,
    WorkflowReportsController,
  ],
  providers: [
    RuleValidatorService,
    RulesEngineService,
    WorkflowGraphValidatorService,
    WorkflowDefinitionsService,
    WorkflowVersionsService,
    TriggerCatalogService,
    WorkflowTriggersService,
    ActionCatalogService,
    WorkflowActionExecutorService,
    WorkflowApprovalsService,
    WorkflowSchedulesService,
    WorkflowExecutionService,
    WorkflowReportsService,
  ],
  exports: [
    RulesEngineService,
    RuleValidatorService,
    WorkflowGraphValidatorService,
    WorkflowDefinitionsService,
    WorkflowVersionsService,
    WorkflowTriggersService,
    TriggerCatalogService,
    ActionCatalogService,
    WorkflowActionExecutorService,
    WorkflowApprovalsService,
    WorkflowSchedulesService,
    WorkflowExecutionService,
    WorkflowReportsService,
  ],
})
export class WorkflowsModule {}
