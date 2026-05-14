import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

// bcrypt only consumes the first 72 bytes of input, so we cap there:
// - prevents DoS via huge password strings hitting bcrypt
// - matches the actual entropy bcrypt can derive
const BCRYPT_MAX_PASSWORD_BYTES = 72;

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(BCRYPT_MAX_PASSWORD_BYTES)
  contrasenaActual: string;

  @IsString()
  @MinLength(8)
  @MaxLength(BCRYPT_MAX_PASSWORD_BYTES)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'La contraseña debe incluir al menos una mayúscula, una minúscula y un número',
  })
  contrasenaNueva: string;
}
