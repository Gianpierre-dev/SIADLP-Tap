import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateRouteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  nombre: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  zona: string;

  @IsOptional()
  @IsString()
  descripcion?: string;
}
