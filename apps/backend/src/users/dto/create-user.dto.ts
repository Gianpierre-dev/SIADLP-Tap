import {
  IsEmail,
  IsString,
  MinLength,
  Matches,
  IsInt,
  IsPositive,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  correo: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'La contraseña debe incluir al menos una mayúscula, una minúscula y un número',
  })
  contrasena: string;

  @IsString()
  @MinLength(2)
  nombre: string;

  @IsInt()
  @IsPositive()
  rolId: number;
}
