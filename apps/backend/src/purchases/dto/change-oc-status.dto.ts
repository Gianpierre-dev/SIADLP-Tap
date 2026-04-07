import { IsString } from 'class-validator';

export class ChangeOcStatusDto {
  @IsString()
  nuevoEstado: string;
}
