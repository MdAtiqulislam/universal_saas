import { IsEnum, IsOptional } from 'class-validator';
import { SerialStatus } from '@prisma/client';

export class UpdateSerialDto {
  @IsEnum(SerialStatus)
  @IsOptional()
  status?: SerialStatus;
}
