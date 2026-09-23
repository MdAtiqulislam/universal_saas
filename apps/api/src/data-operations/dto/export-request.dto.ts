import {
  IsString,
  IsOptional,
  IsArray,
  IsObject,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class ExportRequestDto {
  @IsString()
  operationKey!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['CSV', 'JSON'])
  format?: 'CSV' | 'JSON';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50000)
  limit?: number;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  async?: boolean;
}
