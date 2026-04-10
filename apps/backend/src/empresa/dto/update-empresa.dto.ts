import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsEmail,
} from 'class-validator';

export class UpdateEmpresaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  razonSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombreComercial?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'RUC debe ser exactamente 11 dígitos' })
  ruc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion?: string;

  @IsOptional()
  @IsString()
  @Matches(/^9\d{8}$/, {
    message: 'Teléfono debe ser 9 dígitos y empezar con 9',
  })
  telefono?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  correo?: string;
}
