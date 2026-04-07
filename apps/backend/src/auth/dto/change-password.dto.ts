import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  contrasenaActual: string;

  @IsString()
  @MinLength(6)
  contrasenaNueva: string;
}
