import { IsString, IsObject, IsOptional } from 'class-validator';

export class ProviderWebhookDto {
  @IsString()
  providerEventId!: string;

  @IsString()
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  signature?: string;
}
