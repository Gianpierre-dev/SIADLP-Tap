import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';
import { UNIDADES_MEDIDA } from './create-product.dto';

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
  @IsIn(UNIDADES_MEDIDA as unknown as string[], {
    message: 'Unidad de medida inválida',
  })
  unidadMedida?: string;
}
