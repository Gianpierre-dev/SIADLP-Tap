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

export class ReceiveLineDto {
  @IsInt()
  @IsPositive()
  detalleId: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cantidadRecibida: number;
}

export class ReceivePurchaseDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos una línea' })
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lineas: ReceiveLineDto[];
}
