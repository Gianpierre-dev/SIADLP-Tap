import { OcStatus } from '../enums/oc-status';

export const OC_TRANSITIONS: Record<OcStatus, OcStatus[]> = {
  [OcStatus.EMITIDA]: [OcStatus.CONFIRMADA, OcStatus.CANCELADA],
  [OcStatus.CONFIRMADA]: [OcStatus.EN_CAMINO],
  [OcStatus.EN_CAMINO]: [OcStatus.RECIBIDA],
  [OcStatus.RECIBIDA]: [],
  [OcStatus.CANCELADA]: [],
};

export function canTransitionOc(from: OcStatus, to: OcStatus): boolean {
  return OC_TRANSITIONS[from].includes(to);
}
