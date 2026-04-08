import {
  IsString,
  MinLength,
  IsOptional,
  IsArray,
  IsInt,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsArray()
  @IsInt({ each: true })
  permisoIds: number[];
}
