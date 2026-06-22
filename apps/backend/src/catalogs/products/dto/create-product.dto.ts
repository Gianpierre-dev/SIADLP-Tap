import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';

// El sistema estandariza la cantidad de los productos en KILOGRAMOS: la
// distribución se gestiona por peso (capacidad de los vehículos en kg).
// La gestión de otras presentaciones/empaques con conversión a kg queda
// documentada como trabajo futuro.
export const UNIDADES_MEDIDA = ['kg'] as const;

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
