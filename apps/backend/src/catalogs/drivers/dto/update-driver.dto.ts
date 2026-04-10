import {
  IsString,
  IsOptional,
  MinLength,
  IsBoolean,
  Matches,
} from 'class-validator';

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
  licencia?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d+\-\s]{7,15}$/, { message: 'Teléfono inválido' })
  telefono?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
