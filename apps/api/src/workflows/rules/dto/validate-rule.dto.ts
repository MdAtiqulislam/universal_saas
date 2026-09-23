import { IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class ValidateRuleDto {
  @IsNotEmpty()
  @IsObject()
  ast!: Record<string, unknown>;
}

export class TestRuleDto {
  @IsNotEmpty()
  @IsObject()
  ast!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
