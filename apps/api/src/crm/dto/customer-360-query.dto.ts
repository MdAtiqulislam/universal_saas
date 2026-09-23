import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class Customer360QueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}
