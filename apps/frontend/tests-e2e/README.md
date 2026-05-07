# E2E Tests — Playwright

Estos tests usan **Playwright** para validar la UI desde la perspectiva del usuario, ejecutando un navegador real (Chromium, Firefox, WebKit).

## Estrategia

Para mantener los tests rápidos y aislados del backend, usamos **API mocking** con `page.route()` de Playwright. Esto permite testear:

- ✅ Renderizado correcto de páginas
- ✅ Validaciones HTML5 (required, type, pattern)
- ✅ Interacciones del usuario (click, type, form submit)
- ✅ Estados de UI (loading, error, success)
- ✅ Navegación entre rutas tras login

Sin necesitar:
- ❌ Backend NestJS levantado
- ❌ DB PostgreSQL real
- ❌ JWT_SECRET configurado

## Cómo correr

```bash
# Headless (CI)
pnpm --filter frontend test:e2e

# UI mode (interactivo)
pnpm --filter frontend test:e2e:ui

# Solo Chromium (más rápido)
pnpm --filter frontend test:e2e --project=chromium
```

El `webServer` en `playwright.config.ts` levanta `pnpm dev` automáticamente.

## Cómo agregar tests

Patrón estándar:

```ts
import { test, expect } from '@playwright/test';

test('mi test', async ({ page }) => {
  // 1. Mock las APIs que la página va a llamar
  await page.route('**/api/algo', async (route) => {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ data: 'mock' }),
    });
  });

  // 2. Navegar
  await page.goto('/ruta');

  // 3. Interactuar
  await page.getByRole('button', { name: /accion/i }).click();

  // 4. Verificar
  await expect(page.getByText(/resultado esperado/i)).toBeVisible();
});
```

## Tests con backend real (full E2E)

Para tests que necesiten el flujo end-to-end completo (backend + DB), hay
que levantar:

1. Backend con DB de testing (ver `apps/backend/test/`)
2. Frontend en modo dev
3. Correr `pnpm test:e2e`

Estos tests están fuera del alcance del CI básico — se corren manualmente
antes de releases importantes.
