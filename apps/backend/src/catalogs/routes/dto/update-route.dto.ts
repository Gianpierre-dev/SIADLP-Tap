import {
  IsString,
  IsOptional,
  MinLength,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class UpdateRouteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  zona?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
