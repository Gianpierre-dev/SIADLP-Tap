import { Type } from 'class-transformer';
import {
  IsArray,
  ValidateNested,
  IsInt,
  IsPositive,
  IsNumber,
  Min,
} from 'class-validator';

export class ProductionOutputDto {
  @IsInt()
  @IsPositive()
  productoId: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  cantidad: number;
}

export class CompleteProductionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductionOutputDto)
  productos: ProductionOutputDto[];
}
