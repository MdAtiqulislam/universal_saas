import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateMemberDto {
  @IsString({ message: 'Status must be a string' })
  @IsIn(['ACTIVE', 'INVITED', 'SUSPENDED'], {
    message: 'Status must be one of: ACTIVE, INVITED, SUSPENDED',
  })
  @IsNotEmpty({ message: 'Status is required' })
  status!: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
}
