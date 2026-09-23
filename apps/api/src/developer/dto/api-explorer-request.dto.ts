import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsIn,
} from 'class-validator';

export class ApiExplorerRequestDto {
  @IsString()
  @IsNotEmpty()
  endpointId!: string;

  @IsString()
  @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  method!: string;

  @IsString()
  @IsNotEmpty()
  path!: string;

  @IsOptional()
  @IsObject()
  queryParams?: Record<string, string | number | boolean>;

  @IsOptional()
  @IsObject()
  pathParams?: Record<string, string>;

  @IsOptional()
  @IsObject()
  body?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}
