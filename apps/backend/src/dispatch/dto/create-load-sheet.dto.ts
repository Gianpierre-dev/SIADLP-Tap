import { IsInt, IsPositive, IsArray, IsDateString } from 'class-validator';

export class CreateLoadSheetDto {
  @IsDateString()
  fecha: string;

  @IsInt()
  @IsPositive()
  rutaId: number;

  @IsInt()
  @IsPositive()
  vehiculoId: number;

  @IsInt()
  @IsPositive()
  choferId: number;

  @IsArray()
  @IsInt({ each: true })
  pedidoIds: number[];
}
