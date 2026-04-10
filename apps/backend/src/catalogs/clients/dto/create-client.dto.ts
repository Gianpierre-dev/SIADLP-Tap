import {
  IsString,
  IsOptional,
  MinLength,
  IsInt,
  IsPositive,
  Matches,
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  razonSocial: string;

  @IsOptional()
  @IsString()
  nombreComercial?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'RUC debe ser exactamente 11 dígitos' })
  ruc?: string;

  @IsString()
  @MinLength(2)
  direccion: string;

  @IsOptional()
  @IsString()
  @Matches(/^9\d{8}$/, {
    message: 'Teléfono debe ser 9 dígitos y empezar con 9',
  })
  telefono?: string;

  @IsOptional()
  @IsString()
  contacto?: string;

  @IsOptional()
  @IsString()
  departamentoId?: string;

  @IsOptional()
  @IsString()
  provinciaId?: string;

  @IsOptional()
  @IsString()
  distritoId?: string;

  @IsInt()
  @IsPositive()
  rutaId: number;
}
