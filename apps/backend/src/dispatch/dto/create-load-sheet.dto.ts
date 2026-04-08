import {
  IsInt,
  IsPositive,
  IsArray,
  ArrayMinSize,
  IsDateString,
} from 'class-validator';

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
  @ArrayMinSize(1, { message: 'Debe incluir al menos un pedido' })
  @IsInt({ each: true })
  pedidoIds: number[];
}
