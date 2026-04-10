import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  codigoSku?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  unidadMedida?: string;
}
