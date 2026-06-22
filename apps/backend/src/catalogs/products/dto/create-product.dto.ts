import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';

// Unidades de medida válidas para los productos de La Cosecha.
// Fuente única de verdad: el frontend ofrece la misma lista en su selector.
export const UNIDADES_MEDIDA = [
  'kg',
  'saco',
  'bolsa',
  'jaba',
  'unidad',
] as const;

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  codigoSku: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsIn(UNIDADES_MEDIDA as unknown as string[], {
    message: 'Unidad de medida inválida',
  })
  unidadMedida: string;
}
