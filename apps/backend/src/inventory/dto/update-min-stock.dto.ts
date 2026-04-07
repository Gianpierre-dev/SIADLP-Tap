import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class UpdateMinStockDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  stockMinimo: number;
}
