import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mockeamos el módulo api ANTES de importar el store, para que la
// referencia a apiGet dentro de empresa.ts apunte al mock.
vi.mock('./api', () => ({
  apiGet: vi.fn(),
}));

import { apiGet } from './api';
import { useEmpresaStore, type Empresa } from './empresa';

const sampleEmpresa: Empresa = {
  id: 1,
  razonSocial: 'Acme S.A.',
  nombreComercial: 'Acme',
  ruc: '20123456789',
  direccion: 'Av. Siempre Viva 123',
  telefono: '+51 999 999 999',
  correo: 'contacto@acme.com',
  logoUrl: null,
};

const resetStore = (): void => {
  useEmpresaStore.setState({ empresa: null, loading: false });
};

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useEmpresaStore — Zustand store de empresa activa', () => {
  describe('estado inicial', () => {
    it('arranca con empresa=null y loading=false', () => {
      const state = useEmpresaStore.getState();
      expect(state.empresa).toBeNull();
      expect(state.loading).toBe(false);
    });
  });

  describe('setEmpresa()', () => {
    it('actualiza la empresa en el state sin tocar loading', () => {
      useEmpresaStore.getState().setEmpresa(sampleEmpresa);

      const state = useEmpresaStore.getState();
      expect(state.empresa).toEqual(sampleEmpresa);
      expect(state.loading).toBe(false);
    });
  });

  describe('fetchEmpresa()', () => {
    it('llama a apiGet("/empresa") y guarda la respuesta', async () => {
      vi.mocked(apiGet).mockResolvedValueOnce(sampleEmpresa);

      await useEmpresaStore.getState().fetchEmpresa();

      expect(apiGet).toHaveBeenCalledWith('/empresa');
      const state = useEmpresaStore.getState();
      expect(state.empresa).toEqual(sampleEmpresa);
      expect(state.loading).toBe(false);
    });

    it('marca loading=true mientras la petición está pendiente y false al terminar', async () => {
      let resolveFetch!: (value: Empresa) => void;
      vi.mocked(apiGet).mockImplementationOnce(
        () =>
          new Promise<Empresa>((resolve) => {
            resolveFetch = resolve;
          }),
      );

      const promise = useEmpresaStore.getState().fetchEmpresa();

      // Mientras la promesa está pending, loading debe ser true
      expect(useEmpresaStore.getState().loading).toBe(true);

      resolveFetch(sampleEmpresa);
      await promise;

      expect(useEmpresaStore.getState().loading).toBe(false);
    });

    it('si el fetch falla, deja empresa=null y loading=false (sin propagar el error)', async () => {
      vi.mocked(apiGet).mockRejectedValueOnce(new Error('500 boom'));

      await expect(
        useEmpresaStore.getState().fetchEmpresa(),
      ).resolves.toBeUndefined();

      const state = useEmpresaStore.getState();
      expect(state.empresa).toBeNull();
      expect(state.loading).toBe(false);
    });
  });
});
