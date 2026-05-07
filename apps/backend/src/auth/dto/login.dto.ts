import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(100)
  correo: string;

  @IsString()
  @MinLength(8)
  // Cap to bcrypt's effective input length to prevent DoS via huge password strings.
  @MaxLength(72)
  contrasena: string;
}
