import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/, {
    message: 'Placa debe tener formato ABC-123',
  })
  @MaxLength(7)
  placa?: string;

  @IsOptional()
  @IsString()
  marca?: string;

  @IsOptional()
  @IsString()
  modelo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  capacidadKg?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
