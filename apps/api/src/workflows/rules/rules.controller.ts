import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { RulesEngineService } from './rules-engine.service';
import { RuleValidatorService } from './rule-validator.service';
import { ValidateRuleDto, TestRuleDto } from './dto/validate-rule.dto';

@Controller('workflows/rules')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RulesController {
  constructor(
    private readonly rulesEngine: RulesEngineService,
    private readonly ruleValidator: RuleValidatorService,
  ) {}

  @Post('validate')
  @RequirePermissions('workflows.rules.view')
  validateRule(@Body() dto: ValidateRuleDto) {
    const validatedAst = this.ruleValidator.validate(dto.ast);
    return {
      valid: true,
      ast: validatedAst,
    };
  }

  @Post('test')
  @RequirePermissions('workflows.rules.test')
  testRule(@Body() dto: TestRuleDto) {
    const evaluation = this.rulesEngine.evaluate(dto.ast, dto.context);
    return {
      result: evaluation.result,
      trace: evaluation.trace,
      evaluatedAt: evaluation.evaluatedAt,
    };
  }
}
