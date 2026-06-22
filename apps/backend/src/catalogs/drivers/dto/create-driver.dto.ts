import {
  IsString,
  IsOptional,
  MinLength,
  Matches,
  IsIn,
  IsDateString,
} from 'class-validator';

// Categorías de licencia de conducir vigentes en Perú (MTC).
export const LICENCIA_CATEGORIAS = [
  'A-I',
  'A-IIa',
  'A-IIb',
  'A-IIIa',
  'A-IIIb',
  'A-IIIc',
  'B-I',
  'B-IIa',
  'B-IIb',
  'B-IIc',
] as const;

export class CreateDriverDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsString()
  @MinLength(2)
  apellido: string;

  @IsString()
  @Matches(/^\d{8}$/, { message: 'DNI debe ser exactamente 8 dígitos' })
  dni: string;

  @IsString()
  @Matches(/^[A-Z0-9]{9}$/, {
    message: 'La licencia debe tener 9 caracteres (mayúsculas y números)',
  })
  licencia: string;

  @IsString()
  @IsIn(['A', 'B'], { message: 'La clase de licencia debe ser A o B' })
  licenciaClase: string;

  @IsString()
  @IsIn(LICENCIA_CATEGORIAS as unknown as string[], {
    message: 'Categoría de licencia inválida',
  })
  licenciaCategoria: string;

  @IsDateString(
    {},
    { message: 'La fecha de revalidación debe ser una fecha válida' },
  )
  fechaRevalidacion: string;

  @IsOptional()
  @IsString()
  @Matches(/^9\d{8}$/, {
    message: 'Teléfono debe ser 9 dígitos y empezar con 9',
  })
  telefono?: string;
}
