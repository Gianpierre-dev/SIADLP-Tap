import { IsString, IsOptional } from 'class-validator';

export class ChangeOrderStatusDto {
  @IsString()
  nuevoEstado: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}
