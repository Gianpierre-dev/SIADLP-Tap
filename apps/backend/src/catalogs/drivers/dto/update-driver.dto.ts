import {
  IsString,
  IsOptional,
  MinLength,
  IsBoolean,
  Matches,
  IsIn,
  IsDateString,
} from 'class-validator';
import { LICENCIA_CATEGORIAS } from './create-driver.dto';

export class UpdateDriverDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  apellido?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, { message: 'DNI debe ser exactamente 8 dígitos' })
  dni?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{9}$/, {
    message: 'La licencia debe tener 9 caracteres (mayúsculas y números)',
  })
  licencia?: string;

  @IsOptional()
  @IsString()
  @IsIn(['A', 'B'], { message: 'La clase de licencia debe ser A o B' })
  licenciaClase?: string;

  @IsOptional()
  @IsString()
  @IsIn(LICENCIA_CATEGORIAS as unknown as string[], {
    message: 'Categoría de licencia inválida',
  })
  licenciaCategoria?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de revalidación debe ser una fecha válida' },
  )
  fechaRevalidacion?: string;

  @IsOptional()
  @IsString()
  @Matches(/^9\d{8}$/, {
    message: 'Teléfono debe ser 9 dígitos y empezar con 9',
  })
  telefono?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
