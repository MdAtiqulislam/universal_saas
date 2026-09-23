import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  OpportunityStatus,
  OpportunityStage,
  LeadSource,
} from '@prisma/client';
import { CreateOpportunityLineDto } from './opportunity-line.dto';

export class CreateOpportunityDto {
  @IsNotEmpty()
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  primaryContactId?: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  ownerEmployeeId?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(OpportunityStage)
  stage?: OpportunityStage;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  probability?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsString()
  currencyId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOpportunityLineDto)
  lines?: CreateOpportunityLineDto[];
}

export class UpdateOpportunityDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  primaryContactId?: string;

  @IsOptional()
  @IsString()
  ownerEmployeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(OpportunityStatus)
  status?: OpportunityStatus;

  @IsOptional()
  @IsEnum(OpportunityStage)
  stage?: OpportunityStage;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  probability?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsString()
  currencyId?: string;

  @IsOptional()
  @IsString()
  lostReason?: string;
}

export class ChangeOpportunityStageDto {
  @IsNotEmpty()
  @IsEnum(OpportunityStage)
  stage!: OpportunityStage;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  probability?: number;
}

export class CloseOpportunityWonDto {
  @IsOptional()
  @IsDateString()
  wonDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseOpportunityLostDto {
  @IsNotEmpty()
  @IsString()
  lostReason!: string;

  @IsOptional()
  @IsDateString()
  lostDate?: string;
}

export class OpportunityQueryDto {
  @IsOptional()
  @IsEnum(OpportunityStatus)
  status?: OpportunityStatus;

  @IsOptional()
  @IsEnum(OpportunityStage)
  stage?: OpportunityStage;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  ownerEmployeeId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
