import { IsUUID, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignVehicleDto {
  @IsUUID()
  @IsNotEmpty()
  vehicleId!: string;

  @IsString()
  @IsOptional()
  driverNotes?: string;
}
