import {
  IsEmail,
  IsString,
  MinLength,
  IsInt,
  IsPositive,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  correo?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  nombre?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  rolId?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
