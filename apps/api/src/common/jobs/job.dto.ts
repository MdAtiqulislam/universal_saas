import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateJobDto {
  @IsNotEmpty()
  @IsString()
  jobType!: string;

  @IsOptional()
  payload?: any;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  priority?: number = 0;
}

export class JobQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  jobType?: string;
}
