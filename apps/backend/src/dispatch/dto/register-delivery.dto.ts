import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, Min, IsIn } from 'class-validator';

export class RegisterDeliveryDto {
  @IsIn(['ENTREGADO', 'NOVEDAD'])
  estado: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoCobrado?: number;

  @IsOptional()
  @IsString()
  metodoPago?: string;

  @IsOptional()
  @IsString()
  numeroComprobante?: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}
