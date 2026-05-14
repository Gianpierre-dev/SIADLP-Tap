import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './auth';

interface User {
  id: number;
  correo: string;
  nombre: string;
  permisos: string[];
}

const sampleUser: User = {
  id: 1,
  correo: 'admin@acme.com',
  nombre: 'Admin',
  permisos: ['empresa.read', 'empresa.update'],
};

/**
 * Construye un JWT con un payload arbitrario. NO firmado — es solo lo que
 * el cliente puede decodificar con atob() para chequear `exp`.
 */
const buildFakeJwt = (payload: Record<string, unknown>): string => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
};

const resetStore = (): void => {
  // Restauramos al estado inicial. Ojo: las acciones (setUser, logout, …)
  // se mantienen porque no las pisamos.
  useAuthStore.setState({ user: null, isAuthenticated: false });
};

beforeEach(() => {
  localStorage.clear();
  resetStore();

  // window.location.href = '/login' rompe en jsdom; lo neutralizamos.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      get href() {
        return '';
      },
      set href(_value: string) {
        // no-op
      },
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAuthStore — Zustand store de autenticación', () => {
  describe('estado inicial', () => {
    it('arranca con user=null e isAuthenticated=false', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('setUser()', () => {
    it('persiste token y user en localStorage y actualiza el state', () => {
      useAuthStore.getState().setUser(sampleUser, 'jwt-token');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(sampleUser);
      expect(state.isAuthenticated).toBe(true);
      expect(localStorage.getItem('access_token')).toBe('jwt-token');
      expect(localStorage.getItem('user')).toBe(JSON.stringify(sampleUser));
    });
  });

  describe('logout()', () => {
    it('limpia el state y borra ambas keys de localStorage', () => {
      useAuthStore.getState().setUser(sampleUser, 'jwt-token');

      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  describe('hasPermission()', () => {
    it('devuelve false cuando NO hay user', () => {
      expect(useAuthStore.getState().hasPermission('empresa.read')).toBe(false);
    });

    it('devuelve true cuando el permiso está en user.permisos', () => {
      useAuthStore.getState().setUser(sampleUser, 'jwt');
      expect(useAuthStore.getState().hasPermission('empresa.read')).toBe(true);
    });

    it('devuelve false cuando el permiso NO está en user.permisos', () => {
      useAuthStore.getState().setUser(sampleUser, 'jwt');
      expect(useAuthStore.getState().hasPermission('empresa.delete')).toBe(
        false,
      );
    });
  });

  describe('hydrate()', () => {
    it('NO actualiza el state si no hay token ni user en localStorage', () => {
      useAuthStore.getState().hydrate();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('restaura user e isAuthenticated cuando el token todavía no expiró', () => {
      const future = Math.floor(Date.now() / 1000) + 60 * 60; // +1h
      const token = buildFakeJwt({ sub: 1, exp: future });
      localStorage.setItem('access_token', token);
      localStorage.setItem('user', JSON.stringify(sampleUser));

      useAuthStore.getState().hydrate();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(sampleUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it('limpia localStorage y NO autentica si el token expiró', () => {
      const past = Math.floor(Date.now() / 1000) - 60; // hace 1min
      const token = buildFakeJwt({ sub: 1, exp: past });
      localStorage.setItem('access_token', token);
      localStorage.setItem('user', JSON.stringify(sampleUser));

      useAuthStore.getState().hydrate();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });

    it('limpia localStorage si el token está corrupto (no decodificable)', () => {
      localStorage.setItem('access_token', 'no-es-un-jwt-valido');
      localStorage.setItem('user', JSON.stringify(sampleUser));

      useAuthStore.getState().hydrate();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });

    it('limpia localStorage si el JSON de user está corrupto', () => {
      const future = Math.floor(Date.now() / 1000) + 60 * 60;
      localStorage.setItem('access_token', buildFakeJwt({ exp: future }));
      localStorage.setItem('user', '{esto no es JSON');

      useAuthStore.getState().hydrate();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(localStorage.getItem('access_token')).toBeNull();
    });
  });
});
