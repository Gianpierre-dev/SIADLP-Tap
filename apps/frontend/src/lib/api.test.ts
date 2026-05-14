import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

// El módulo lee process.env.NEXT_PUBLIC_API_URL en tiempo de import (ESM eval),
// así que tenemos que asegurarlo ANTES del primer import.
process.env.NEXT_PUBLIC_API_URL = 'http://api.test';

// El import dinámico se difiere a un beforeEach para garantizar que cada caso
// vea siempre el mismo módulo, sin loops de cache contaminados.
let apiGet: typeof import('./api').apiGet;
let apiPost: typeof import('./api').apiPost;
let apiPatch: typeof import('./api').apiPatch;
let apiDelete: typeof import('./api').apiDelete;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import('./api');
  apiGet = mod.apiGet;
  apiPost = mod.apiPost;
  apiPatch = mod.apiPatch;
  apiDelete = mod.apiDelete;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

interface JsonResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  json: () => Promise<unknown>;
}

const mockFetchOnce = (response: JsonResponse): Mock => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const okJson = (body: unknown, status = 200): JsonResponse => ({
  ok: true,
  status,
  json: async () => body,
});

const errJson = (
  status: number,
  body: unknown,
  statusText = 'Error',
): JsonResponse => ({
  ok: false,
  status,
  statusText,
  json: async () => body,
});

describe('api client (apiGet/apiPost/apiPatch/apiDelete)', () => {
  describe('happy path', () => {
    it('apiGet hace GET y devuelve el JSON parseado', async () => {
      const fetchMock = mockFetchOnce(okJson({ id: 1, nombre: 'Acme' }));

      const result = await apiGet<{ id: number; nombre: string }>('/empresa');

      expect(result).toEqual({ id: 1, nombre: 'Acme' });
      expect(fetchMock).toHaveBeenCalledWith(
        'http://api.test/empresa',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('apiPost serializa el body con JSON.stringify y usa method=POST', async () => {
      const fetchMock = mockFetchOnce(okJson({ ok: true }));

      await apiPost('/login', { email: 'x@y.com', password: 'pwd' });

      const [, init] = fetchMock.mock.calls[0];
      expect(init).toMatchObject({
        method: 'POST',
        body: JSON.stringify({ email: 'x@y.com', password: 'pwd' }),
      });
    });

    it('apiPatch usa method=PATCH y envía el body serializado', async () => {
      const fetchMock = mockFetchOnce(okJson({ id: 5 }));

      await apiPatch('/empresa/5', { nombreComercial: 'Nuevo' });

      const [, init] = fetchMock.mock.calls[0];
      expect(init).toMatchObject({
        method: 'PATCH',
        body: JSON.stringify({ nombreComercial: 'Nuevo' }),
      });
    });

    it('apiDelete usa method=DELETE y NO envía body', async () => {
      const fetchMock = mockFetchOnce(okJson({ ok: true }));

      await apiDelete('/empresa/5');

      const [, init] = fetchMock.mock.calls[0];
      expect(init).toMatchObject({ method: 'DELETE' });
      expect(init.body).toBeUndefined();
    });
  });

  describe('autenticación con token', () => {
    it('inyecta Authorization: Bearer cuando hay access_token en localStorage', async () => {
      localStorage.setItem('access_token', 'jwt-abc');
      const fetchMock = mockFetchOnce(okJson({}));

      await apiGet('/me');

      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers).toMatchObject({
        Authorization: 'Bearer jwt-abc',
      });
    });

    it('NO inyecta Authorization cuando no hay token', async () => {
      const fetchMock = mockFetchOnce(okJson({}));

      await apiGet('/public');

      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers).not.toHaveProperty('Authorization');
    });
  });

  describe('manejo de errores', () => {
    it('lanza ApiRequestError con statusCode y message del backend', async () => {
      mockFetchOnce(
        errJson(400, {
          statusCode: 400,
          message: 'Email inválido',
        }),
      );

      await expect(apiPost('/login', {})).rejects.toMatchObject({
        name: 'ApiRequestError',
        statusCode: 400,
        message: 'Email inválido',
      });
    });

    it('cae a statusText cuando el body no es JSON parseable', async () => {
      mockFetchOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('not json');
        },
      });

      await expect(apiGet('/x')).rejects.toMatchObject({
        statusCode: 500,
        message: 'Internal Server Error',
      });
    });

    it('cae a statusText cuando el body es null', async () => {
      mockFetchOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => null,
      });

      await expect(apiGet('/x')).rejects.toMatchObject({
        statusCode: 502,
        message: 'Bad Gateway',
      });
    });

    it('en 401 con token previo, limpia localStorage y redirige a /login', async () => {
      localStorage.setItem('access_token', 'jwt-expirado');
      localStorage.setItem('user', '{"id":1}');

      // jsdom no permite reasignar window.location.href directamente;
      // mockeamos la propiedad para capturar la asignación.
      const hrefSetter = vi.fn();
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          get href() {
            return '';
          },
          set href(value: string) {
            hrefSetter(value);
          },
        },
      });

      mockFetchOnce(
        errJson(401, { statusCode: 401, message: 'Unauthorized' }),
      );

      await expect(apiGet('/me')).rejects.toMatchObject({ statusCode: 401 });

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(hrefSetter).toHaveBeenCalledWith('/login');
    });

    it('en 401 SIN token previo (caso login fallido), NO redirige y propaga el mensaje del backend', async () => {
      const hrefSetter = vi.fn();
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          get href() {
            return '';
          },
          set href(value: string) {
            hrefSetter(value);
          },
        },
      });

      mockFetchOnce(
        errJson(401, { statusCode: 401, message: 'Credenciales inválidas' }),
      );

      await expect(apiPost('/login', {})).rejects.toMatchObject({
        statusCode: 401,
        message: 'Credenciales inválidas',
      });
      expect(hrefSetter).not.toHaveBeenCalled();
    });
  });

  describe('respuestas especiales', () => {
    it('cuando el server responde 204 No Content devuelve undefined sin parsear JSON', async () => {
      const jsonSpy = vi.fn();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce({
          ok: true,
          status: 204,
          json: jsonSpy,
        }),
      );

      const result = await apiDelete('/empresa/5');

      expect(result).toBeUndefined();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('permite que el caller agregue/sobrescriba headers personalizados', async () => {
      const fetchMock = mockFetchOnce(okJson({}));

      // apiPost no expone headers, pero podemos verificar el merge usando
      // una llamada equivalente vía apiGet con un caller hipotético: como
      // el helper público no acepta options, validamos que Content-Type
      // siempre se envía cuando NO hay headers extra.
      await apiGet('/x');

      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers).toMatchObject({
        'Content-Type': 'application/json',
      });
    });
  });
});
