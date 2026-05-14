import { IsIn, IsString, IsOptional, MaxLength } from 'class-validator';
import { OrderStatus } from '@siadlp/shared';

// Constrain to known enum values at the validation layer so the service never sees
// unexpected status strings (defense in depth — service also re-validates with canTransition).
const ALLOWED_NEW_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.CANCELLED,
] as const;

export class ChangeOrderStatusDto {
  @IsString()
  @IsIn(ALLOWED_NEW_STATUSES, {
    message: `nuevoEstado debe ser uno de: ${ALLOWED_NEW_STATUSES.join(', ')}`,
  })
  nuevoEstado: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
