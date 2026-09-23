import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsArray({ message: 'Permissions must be an array of permission names' })
  @IsString({ each: true, message: 'Each permission must be a string' })
  @IsNotEmpty({ message: 'Permissions array cannot be empty' })
  permissions!: string[];
}
