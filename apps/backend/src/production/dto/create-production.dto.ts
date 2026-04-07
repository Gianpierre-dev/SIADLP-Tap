import { Type } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsInt,
  IsPositive,
  IsNumber,
  Min,
} from 'class-validator';

export class ProductionInputDto {
  @IsInt()
  @IsPositive()
  itemInventarioId: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  cantidad: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costoUnitario: number;
}

export class CreateProductionDto {
  @IsDateString()
  fecha: string;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductionInputDto)
  insumos: ProductionInputDto[];
}
