import {
  IsString,
  IsOptional,
  MinLength,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsString()
  @MinLength(1)
  codigoSku: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsString()
  @MinLength(1)
  unidadMedida: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioBase: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  stockMinimo?: number;
}
