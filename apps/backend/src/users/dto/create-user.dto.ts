import { IsEmail, IsString, MinLength, IsInt, IsPositive } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  correo: string;

  @IsString()
  @MinLength(6)
  contrasena: string;

  @IsString()
  @MinLength(2)
  nombre: string;

  @IsInt()
  @IsPositive()
  rolId: number;
}
