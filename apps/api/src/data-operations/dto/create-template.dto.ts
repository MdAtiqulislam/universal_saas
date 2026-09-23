import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  operationKey!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  fieldMappings?: Record<string, string>;

  @IsOptional()
  @IsObject()
  defaultParameters?: Record<string, unknown>;
}
