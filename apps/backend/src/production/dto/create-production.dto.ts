import { Type } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsArray,
  ArrayMinSize,
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
  @ArrayMinSize(1, { message: 'Debe incluir al menos un insumo' })
  @ValidateNested({ each: true })
  @Type(() => ProductionInputDto)
  insumos: ProductionInputDto[];
}
