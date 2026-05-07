import { test, expect } from '@playwright/test';

const API_LOGIN = '**/api/auth/login';
const API_EMPRESA = '**/api/empresa';

/**
 * Mock the GET /api/empresa endpoint that the login page calls on mount,
 * so the page can render without a real backend.
 */
async function mockEmpresaCall(page: import('@playwright/test').Page) {
  await page.route(API_EMPRESA, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        razonSocial: 'La Cosecha S.A.C.',
        logoUrl: null,
      }),
    });
  });
}

test.describe('Login page — UI rendering', () => {
  test.beforeEach(async ({ page }) => {
    await mockEmpresaCall(page);
  });

  test('renderiza el formulario de login con todos los campos', async ({
    page,
  }) => {
    await page.goto('/login');

    await expect(page.getByText(/^SIADLP$/i).first()).toBeVisible();
    await expect(page.getByLabel(/correo electrónico/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /ingresar/i }),
    ).toBeVisible();
  });

  test('los campos son required (HTML5 validation)', async ({ page }) => {
    await page.goto('/login');

    const correoInput = page.getByLabel(/correo electrónico/i);
    const passwordInput = page.getByLabel(/contraseña/i);

    await expect(correoInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');
  });

  test('el campo correo es type=email (validación HTML5)', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/correo electrónico/i)).toHaveAttribute(
      'type',
      'email',
    );
  });

  test('el campo contraseña es type=password (oculta los caracteres)', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/contraseña/i)).toHaveAttribute(
      'type',
      'password',
    );
  });

  test('el campo correo recibe autoFocus al cargar la página', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/correo electrónico/i)).toBeFocused();
  });
});

test.describe('Login flow — happy path con API mockeada', () => {
  test.beforeEach(async ({ page }) => {
    await mockEmpresaCall(page);
  });

  test('login exitoso redirige al dashboard', async ({ page }) => {
    // Mock del endpoint de login con respuesta exitosa
    await page.route(API_LOGIN, async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'fake.jwt.token',
          usuario: {
            id: 1,
            correo: 'admin@siadlp.test',
            nombre: 'Admin',
            permisos: ['pedidos.crear'],
          },
        }),
      });
    });

    // Mock cualquier request del dashboard
    await page.route('**/api/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0 }),
      });
    });

    await page.goto('/login');
    await page.getByLabel(/correo electrónico/i).fill('admin@siadlp.test');
    await page.getByLabel(/contraseña/i).fill('correctPassword123');
    await page.getByRole('button', { name: /ingresar/i }).click();

    // Espera el redirect al dashboard
    await page.waitForURL('/', { timeout: 5000 });
    expect(page.url()).toContain('/');
  });

  test('login fallido muestra toast de error', async ({ page }) => {
    await page.route(API_LOGIN, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Credenciales inválidas',
          statusCode: 401,
        }),
      });
    });

    await page.goto('/login');
    await page.getByLabel(/correo electrónico/i).fill('mal@siadlp.test');
    await page.getByLabel(/contraseña/i).fill('passwordIncorrecto1');
    await page.getByRole('button', { name: /ingresar/i }).click();

    // Sonner toast aparece con el mensaje de error
    await expect(page.getByText(/credenciales inválidas/i)).toBeVisible({
      timeout: 5000,
    });

    // No redirige
    expect(page.url()).toContain('/login');
  });

  test('botón muestra estado loading durante el submit', async ({ page }) => {
    // Login con delay para capturar el estado loading
    await page.route(API_LOGIN, async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 401,
        body: JSON.stringify({ message: 'Test' }),
      });
    });

    await page.goto('/login');
    await page.getByLabel(/correo electrónico/i).fill('admin@siadlp.test');
    await page.getByLabel(/contraseña/i).fill('password123');
    await page.getByRole('button', { name: /ingresar/i }).click();

    await expect(page.getByText(/ingresando/i)).toBeVisible();
  });
});
