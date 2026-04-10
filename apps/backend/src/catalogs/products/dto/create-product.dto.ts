import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

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

  @IsString()
  @MinLength(1)
  unidadMedida: string;
}
