import { describe, it, expect } from 'vitest';
import { OrderStatus } from '../enums/order-status';
import { ORDER_TRANSITIONS, canTransition } from './order-transitions';

describe('ORDER_TRANSITIONS — máquina de estados de pedidos', () => {
  describe('Estados terminales (sin transiciones permitidas)', () => {
    it('DELIVERED no puede transicionar a ningún estado', () => {
      expect(ORDER_TRANSITIONS[OrderStatus.DELIVERED]).toEqual([]);
    });

    it('CANCELLED no puede transicionar a ningún estado', () => {
      expect(ORDER_TRANSITIONS[OrderStatus.CANCELLED]).toEqual([]);
    });
  });

  describe('Flujo principal feliz: REGISTERED → CONFIRMED → DISPATCHED → ON_ROUTE → DELIVERED', () => {
    it('REGISTERED puede ir a CONFIRMED', () => {
      expect(canTransition(OrderStatus.REGISTERED, OrderStatus.CONFIRMED)).toBe(
        true,
      );
    });

    it('CONFIRMED puede ir a DISPATCHED', () => {
      expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.DISPATCHED)).toBe(
        true,
      );
    });

    it('DISPATCHED puede ir a ON_ROUTE', () => {
      expect(canTransition(OrderStatus.DISPATCHED, OrderStatus.ON_ROUTE)).toBe(
        true,
      );
    });

    it('ON_ROUTE puede ir a DELIVERED', () => {
      expect(canTransition(OrderStatus.ON_ROUTE, OrderStatus.DELIVERED)).toBe(
        true,
      );
    });
  });

  describe('Flujo de cancelación', () => {
    it('REGISTERED puede ir a CANCELLED', () => {
      expect(canTransition(OrderStatus.REGISTERED, OrderStatus.CANCELLED)).toBe(
        true,
      );
    });

    it('CONFIRMED no puede ir a CANCELLED (solo desde REGISTERED)', () => {
      expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(
        false,
      );
    });
  });

  describe('Flujo de novedad/issue', () => {
    it('ON_ROUTE puede ir a ISSUE (problema en entrega)', () => {
      expect(canTransition(OrderStatus.ON_ROUTE, OrderStatus.ISSUE)).toBe(true);
    });

    it('ISSUE puede volver a CONFIRMED (re-programación)', () => {
      expect(canTransition(OrderStatus.ISSUE, OrderStatus.CONFIRMED)).toBe(
        true,
      );
    });

    it('ISSUE no puede ir directo a DELIVERED', () => {
      expect(canTransition(OrderStatus.ISSUE, OrderStatus.DELIVERED)).toBe(
        false,
      );
    });
  });

  describe('Transiciones inválidas — saltos prohibidos', () => {
    it('REGISTERED no puede saltar directo a DISPATCHED', () => {
      expect(
        canTransition(OrderStatus.REGISTERED, OrderStatus.DISPATCHED),
      ).toBe(false);
    });

    it('REGISTERED no puede saltar directo a ON_ROUTE', () => {
      expect(canTransition(OrderStatus.REGISTERED, OrderStatus.ON_ROUTE)).toBe(
        false,
      );
    });

    it('CONFIRMED no puede saltar directo a ON_ROUTE', () => {
      expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.ON_ROUTE)).toBe(
        false,
      );
    });

    it('CONFIRMED no puede saltar directo a DELIVERED', () => {
      expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.DELIVERED)).toBe(
        false,
      );
    });

    it('DISPATCHED no puede ir a DELIVERED sin pasar por ON_ROUTE', () => {
      expect(canTransition(OrderStatus.DISPATCHED, OrderStatus.DELIVERED)).toBe(
        false,
      );
    });
  });

  describe('Transiciones reflexivas (un estado a sí mismo)', () => {
    it('ningún estado puede transicionar a sí mismo', () => {
      const allStatuses = Object.values(OrderStatus);
      for (const status of allStatuses) {
        expect(canTransition(status, status)).toBe(false);
      }
    });
  });

  describe('Cobertura completa de la matriz de transiciones', () => {
    it('todos los estados están presentes en ORDER_TRANSITIONS', () => {
      const allStatuses = Object.values(OrderStatus);
      for (const status of allStatuses) {
        expect(ORDER_TRANSITIONS[status]).toBeDefined();
      }
    });

    it('ninguna transición lleva a un estado inexistente', () => {
      const allStatuses = new Set(Object.values(OrderStatus));
      for (const transitions of Object.values(ORDER_TRANSITIONS)) {
        for (const target of transitions) {
          expect(allStatuses.has(target)).toBe(true);
        }
      }
    });
  });
});
