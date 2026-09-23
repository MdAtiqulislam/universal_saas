import { IsString, IsNotEmpty } from 'class-validator';

export class InboundBillingWebhookDto {
  @IsString()
  @IsNotEmpty()
  providerEventId!: string;

  @IsString()
  @IsNotEmpty()
  eventType!: string;

  payload!: Record<string, unknown>;
}
