import { Type } from 'class-transformer';
import { IsNumber, IsString, MinLength } from 'class-validator';

export class AdjustInventoryDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  cantidad: number; // positive for increase, negative for decrease

  @IsString()
  @MinLength(5)
  motivo: string; // mandatory justification
}
