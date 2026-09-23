import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class CreateMemberDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail(
    {},
    { message: 'A valid email address is required to invite a member' },
  )
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}
