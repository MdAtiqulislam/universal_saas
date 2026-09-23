import { IsUUID, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class DepreciationRunDto {
  @IsUUID()
  @IsNotEmpty()
  fiscalPeriodId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  assetIds?: string[];
}
