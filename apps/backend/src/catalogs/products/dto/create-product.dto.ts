import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsString()
  @MinLength(1)
  codigoSku: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsString()
  @MinLength(1)
  unidadMedida: string;
}
