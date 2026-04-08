import { Type } from 'class-transformer';
import {
  IsInt,
  IsPositive,
  IsDateString,
  IsOptional,
  IsString,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';

export class OrderLineDto {
  @IsInt()
  @IsPositive()
  productoId: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  cantidad: number;
}

export class CreateOrderDto {
  @IsInt()
  @IsPositive()
  clienteId: number;

  @IsDateString()
  fechaEntrega: string;

  @IsOptional()
  @IsString()
  observacion?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos un detalle' })
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  detalles: OrderLineDto[];
}
