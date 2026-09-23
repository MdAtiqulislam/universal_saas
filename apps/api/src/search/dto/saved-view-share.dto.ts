import { IsEnum, IsString, IsOptional, MaxLength } from 'class-validator';
import { SavedViewShareType } from '@prisma/client';

export class CreateSavedViewShareDto {
  @IsEnum(SavedViewShareType)
  shareType!: SavedViewShareType;

  @IsString()
  @MaxLength(100)
  targetId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  permission?: 'VIEW' | 'EDIT' = 'VIEW';
}
