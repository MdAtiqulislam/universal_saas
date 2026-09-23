import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReturnType, ReturnStatus } from '@prisma/client';

export class CreateReturnRequestLineDto {
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @IsUUID()
  @IsOptional()
  variantId?: string;

  @IsUUID()
  @IsOptional()
  sourceLineId?: string;

  @IsNumber()
  @Min(0.0001)
  requestedQuantity!: number;

  @IsUUID()
  @IsOptional()
  reasonId?: string;
}

export class CreateReturnRequestDto {
  @IsEnum(ReturnType)
  @IsNotEmpty()
  returnType!: ReturnType;

  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsUUID()
  @IsOptional()
  salesOrderId?: string;

  @IsUUID()
  @IsOptional()
  deliveryOrderId?: string;

  @IsUUID()
  @IsOptional()
  shipmentId?: string;

  @IsUUID()
  @IsOptional()
  customerInvoiceId?: string;

  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;

  @IsUUID()
  @IsOptional()
  goodsReceiptId?: string;

  @IsUUID()
  @IsOptional()
  supplierInvoiceId?: string;

  @IsUUID()
  @IsNotEmpty()
  reasonId!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateReturnRequestLineDto)
  lines!: CreateReturnRequestLineDto[];
}

export class UpdateReturnRequestDto {
  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  @IsOptional()
  reasonId?: string;

  @IsUUID()
  @IsOptional()
  reverseShipmentId?: string;
}

export class ReviewReturnDto {
  @IsString()
  @IsOptional()
  reviewNotes?: string;
}

export class AuthorizeReturnLineDto {
  @IsUUID()
  @IsNotEmpty()
  lineId!: string;

  @IsNumber()
  @Min(0)
  authorizedQuantity!: number;
}

export class AuthorizeReturnDto {
  @IsString()
  @IsOptional()
  authorizationNotes?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AuthorizeReturnLineDto)
  lineAuthorizations?: AuthorizeReturnLineDto[];
}

export class RejectReturnDto {
  @IsString()
  @IsNotEmpty()
  rejectionReason!: string;
}

export class QueryReturnRequestDto {
  @IsEnum(ReturnStatus)
  @IsOptional()
  status?: ReturnStatus;

  @IsEnum(ReturnType)
  @IsOptional()
  returnType?: ReturnType;

  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsUUID()
  @IsOptional()
  salesOrderId?: string;

  @IsUUID()
  @IsOptional()
  purchaseOrderId?: string;

  @IsString()
  @IsOptional()
  search?: string;
}
