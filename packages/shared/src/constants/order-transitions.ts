import { OrderStatus } from '../enums/order-status';

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.REGISTERED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.DISPATCHED],
  [OrderStatus.DISPATCHED]: [OrderStatus.ON_ROUTE],
  [OrderStatus.ON_ROUTE]: [OrderStatus.DELIVERED, OrderStatus.ISSUE],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.ISSUE]: [OrderStatus.CONFIRMED],
  [OrderStatus.CANCELLED]: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}
