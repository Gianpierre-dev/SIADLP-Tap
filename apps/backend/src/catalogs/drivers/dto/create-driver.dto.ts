import { IsString, IsOptional, MinLength, Matches } from 'class-validator';

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

  @IsOptional()
  @IsString()
  licencia?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d+\-\s]{7,15}$/, { message: 'Teléfono inválido' })
  telefono?: string;
}
