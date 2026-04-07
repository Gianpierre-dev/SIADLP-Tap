import { IsString, IsOptional } from 'class-validator';

export class ConfirmDispatchDto {
  @IsOptional()
  @IsString()
  numeroGre?: string;
}
