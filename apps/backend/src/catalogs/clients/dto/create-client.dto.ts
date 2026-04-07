import {
  IsString,
  IsOptional,
  MinLength,
  IsInt,
  IsPositive,
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
  ruc?: string;

  @IsString()
  @MinLength(2)
  direccion: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  contacto?: string;

  @IsOptional()
  @IsString()
  ubigeo?: string;

  @IsInt()
  @IsPositive()
  rutaId: number;
}
