import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn() — utility de merging de clases Tailwind', () => {
  describe('comportamiento de clsx (concatenación condicional)', () => {
    it('concatena strings simples', () => {
      expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
    });

    it('ignora valores falsy (false, null, undefined, 0, "")', () => {
      expect(cn('px-2', false, null, undefined, 'py-1')).toBe('px-2 py-1');
    });

    it('soporta arrays anidados', () => {
      expect(cn(['px-2', ['py-1', 'm-1']])).toBe('px-2 py-1 m-1');
    });

    it('soporta objetos con condiciones (key: boolean)', () => {
      expect(cn({ 'px-2': true, 'py-1': false, 'm-1': true })).toBe('px-2 m-1');
    });

    it('devuelve string vacío sin inputs', () => {
      expect(cn()).toBe('');
    });
  });

  describe('comportamiento de tailwind-merge (deduplicación)', () => {
    it('cuando hay padding conflictivo, gana el último', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4');
    });

    it('cuando hay color conflictivo, gana el último', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('preserva clases no conflictivas', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    });

    it('maneja modificadores hover/focus correctamente', () => {
      expect(cn('hover:bg-red-500', 'hover:bg-blue-500')).toBe(
        'hover:bg-blue-500',
      );
    });

    it('NO confunde clases que comparten prefijo pero son distintas (text-red vs text-sm)', () => {
      const result = cn('text-red-500', 'text-sm');
      expect(result).toContain('text-red-500');
      expect(result).toContain('text-sm');
    });
  });

  describe('casos típicos de la app', () => {
    it('combina className base con override del usuario', () => {
      const baseClass = 'h-8 px-2 bg-primary';
      const userClass = 'bg-secondary';
      expect(cn(baseClass, userClass)).toBe('h-8 px-2 bg-secondary');
    });

    it('aplica condicionalmente clases según un estado', () => {
      const isActive = true;
      const result = cn('text-base', isActive && 'font-bold', 'rounded-md');
      expect(result).toBe('text-base font-bold rounded-md');
    });
  });
});
