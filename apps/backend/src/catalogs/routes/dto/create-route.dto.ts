import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateRouteDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsString()
  @MinLength(2)
  zona: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
