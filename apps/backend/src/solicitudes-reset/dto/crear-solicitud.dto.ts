import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearSolicitudResetDto {
  @IsEmail()
  correo: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
