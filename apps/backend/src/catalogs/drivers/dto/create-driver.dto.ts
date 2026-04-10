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
  @Matches(/^9\d{8}$/, {
    message: 'Teléfono debe ser 9 dígitos y empezar con 9',
  })
  telefono?: string;
}
