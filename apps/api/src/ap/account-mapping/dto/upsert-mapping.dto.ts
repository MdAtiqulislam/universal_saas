import { IsUUID, IsNotEmpty } from 'class-validator';

export class UpsertAccountMappingDto {
  @IsUUID()
  @IsNotEmpty()
  accountId!: string;
}
