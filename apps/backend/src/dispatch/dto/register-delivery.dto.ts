import { IsString, IsOptional, IsIn } from 'class-validator';

export class RegisterDeliveryDto {
  @IsIn(['ENTREGADO', 'NOVEDAD'])
  estado: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}
