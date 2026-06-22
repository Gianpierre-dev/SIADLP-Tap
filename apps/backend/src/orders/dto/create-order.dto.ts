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
  Matches,
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

  // Hora programada de entrega en formato "HH:MM" (24h). Opcional a nivel API
  // (un pedido sigue siendo válido sin ella), pero el frontend la exige al crear.
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'La hora de entrega debe tener formato HH:MM (24 horas)',
  })
  horaEntrega?: string;

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
