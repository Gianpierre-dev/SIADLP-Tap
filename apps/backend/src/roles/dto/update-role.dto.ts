import {
  IsString,
  MinLength,
  IsOptional,
  IsArray,
  IsInt,
  IsBoolean,
} from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  permisoIds?: number[];
}
