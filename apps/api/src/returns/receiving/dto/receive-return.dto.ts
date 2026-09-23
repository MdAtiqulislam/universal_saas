import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsString,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveReturnItemDto {
  @IsUUID()
  @IsNotEmpty()
  lineId!: string;

  @IsNumber()
  @Min(0.0001)
  receivedQuantity!: number;
}

export class ReceiveReturnDto {
  @IsUUID()
  @IsNotEmpty()
  warehouseId!: string;

  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsString()
  @IsOptional()
  receivingNotes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveReturnItemDto)
  items!: ReceiveReturnItemDto[];
}
