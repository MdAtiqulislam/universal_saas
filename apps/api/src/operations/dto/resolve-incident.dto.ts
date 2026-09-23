import { IsString, IsOptional, IsObject } from 'class-validator';

export class ResolveIncidentDto {
  @IsString()
  resolution!: string;

  @IsString()
  rootCause!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
