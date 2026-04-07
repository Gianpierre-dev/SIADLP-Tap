import { Type } from 'class-transformer';
import { IsNumber, Min, IsOptional, IsString } from 'class-validator';

export class RegisterCollectionDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  montoCobrado: number;

  @IsOptional()
  @IsString()
  metodoPago?: string;

  @IsOptional()
  @IsString()
  numeroComprobante?: string;
}
