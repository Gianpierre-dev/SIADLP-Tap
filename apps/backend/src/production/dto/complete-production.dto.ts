import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
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
  @ArrayMinSize(1, { message: 'Debe incluir al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => ProductionOutputDto)
  productos: ProductionOutputDto[];
}
