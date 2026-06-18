import { IsString, MaxLength, MinLength } from 'class-validator';

export class RechazarSolicitudDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motivoRechazo: string;
}
