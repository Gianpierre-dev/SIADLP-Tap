import { IsString, IsOptional, MinLength, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRouteDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsString()
  @MinLength(2)
  zona: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tarifa: number;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
