import {
  IsString,
  IsOptional,
  MinLength,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRouteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  zona?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tarifa?: number;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
