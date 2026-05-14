import { Type } from 'class-transformer';
import {
  IsInt,
  IsPositive,
  IsDateString,
  IsOptional,
  IsString,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class OrderLineDto {
  @IsInt()
  @IsPositive()
  productoId: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  // Cap at 100,000 kg per line to prevent integer-overflow / DoS via giant numbers
  // and to surface obvious data-entry mistakes (heaviest truck in the catalog is well
  // below this).
  @Max(100_000)
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
  // Cap free-text fields to avoid storing arbitrary blobs.
  @MaxLength(500)
  observacion?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Debe incluir al menos un detalle' })
  // Bound the number of order lines to prevent payload-amplification attacks.
  @ArrayMaxSize(100, { message: 'No se puede incluir más de 100 detalles' })
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  detalles: OrderLineDto[];
}
