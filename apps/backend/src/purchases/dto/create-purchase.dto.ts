import { Type } from 'class-transformer';
import {
  IsInt,
  IsPositive,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  MinLength,
} from 'class-validator';

export class PurchaseLineDto {
  @IsString()
  @MinLength(2)
  descripcion: string;

  @IsString()
  unidadMedida: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  cantidad: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioUnitario: number;
}

export class CreatePurchaseDto {
  @IsInt()
  @IsPositive()
  proveedorId: number;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  detalles: PurchaseLineDto[];
}
