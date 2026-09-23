import { IsOptional, IsString, IsIn } from 'class-validator';

export class ProviderQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'DEPRECATED'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
