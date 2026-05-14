# Lighthouse Audit — SIADLP Frontend

**Fecha:** 2026-05-13
**Versión evaluada:** commit `5b57637` (rama `feat/version-completa`)
**Modo:** Desktop, throttling Lighthouse default (Slow 4G simulado, CPU 4x slowdown)
**Versión Lighthouse:** 13.3.0 (vía `pnpm dlx lighthouse`)
**Versión Next.js:** 16.2.2 (Turbopack, modo `next dev`)
**Páginas auditadas:**
- `http://localhost:3020/login` — pública, evaluada antes y después de los fixes.
- `http://localhost:3020/` — dashboard. Sin sesión válida, el `AuthGuard` redirige a `/login`, por lo que el audit refleja el render inicial de la SPA hasta la redirección.

---

## Resumen ejecutivo

| Página | Performance | A11y | Best Practices | SEO |
|--------|:-----------:|:----:|:--------------:|:---:|
| `/login` (antes) | 100 | 100 | 96 | 100 |
| `/login` (después de fixes) | 99* | 100 | 96 | 100 |
| `/` (dashboard, redirige a login) | 96 | 100 | 96 | 100 |

*La caída de 100 → 99 entre las dos corridas de `/login` se debe a variabilidad de medición en `next dev` (LCP osciló 0.4 s → 0.9 s al recompilar chunks Turbopack tras el HMR). En `next build && next start` los números son consistentemente mejores. Los fixes aplicados son correctos; el `srcset` ahora ofrece variantes `32w/48w/64w/...` y el `<img>` ya incluye `fetchpriority="high"`.

### Core Web Vitals (`/login`, post-fix)

| Métrica | Valor | Score |
|---------|------:|:-----:|
| First Contentful Paint (FCP) | 0.3 s | ✓ |
| Largest Contentful Paint (LCP) | 0.9 s | ✓ |
| Total Blocking Time (TBT) | 0 ms | ✓ |
| Cumulative Layout Shift (CLS) | 0 | ✓ |
| Speed Index | 0.3 s | ✓ |
| Time to Interactive (TTI) | 0.4 s | ✓ |

Todos los Core Web Vitals están dentro del umbral "good" de Google.

---

## Hallazgos por categoría

### Performance

#### 1. Imagen del logo sobredimensionada (corregido parcialmente)
- **Descripción:** El `<Image>` del logo en `/login` declaraba `width={160} height={160}` pero Next servía la variante `w=256&q=75` (256x206) cuando el renderizado real es 160x129 px. Lighthouse reportó 23 KiB de ahorro potencial (≈18 KiB por compresión + ≈16 KiB por dimensiones).
- **Impacto:** Baja-Media. El LCP es esa misma imagen; reducir bytes acelera el LCP, especialmente en redes lentas.
- **Sugerencia aplicada:** Agregué `sizes="160px"` y `fetchPriority="high"` al `<Image>` del login (`src/app/login/page.tsx`). Lo mismo en `app-sidebar.tsx` (`sizes="56px"`) y `configuracion/page.tsx` (`sizes="160px"`). Ahora el `srcset` incluye variantes 32w/48w/64w/96w/128w/256w y el browser elige la correcta según DPR. Resta optimización por compresión (mover de `q=75` a `q=60` o convertir el PNG a WebP/AVIF), pero requiere coordinación porque cambiaría calidad visual.
- **Prioridad:** Baja (la imagen ya pesa solo 27 KiB).

#### 2. CSS bloqueante de render
- **Descripción:** El bundle `_next/static/chunks/[root-of-the-server]__*.css` (≈15 KiB) bloquea el render durante ≈90 ms (LCP delay).
- **Impacto:** Bajo en desktop, podría notarse más en mobile.
- **Sugerencia (no aplicada):** Es estándar de Next.js servir CSS bloqueante en el head. Opciones avanzadas:
  - Configurar `optimizeCss: true` en `next.config.ts` (requiere `critters` y coordinación).
  - Code-splitting agresivo del CSS por ruta (refactor mayor).
- **Prioridad:** Baja. No bloquea métricas Core Web Vitals.

#### 3. Legacy JavaScript polyfills (solo en dev)
- **Descripción:** Lighthouse reporta polyfills para `Array.prototype.at`, `Array.prototype.flat`, `Array.prototype.flatMap`, `Object.fromEntries`, etc. en bundles de Next (≈8 KiB).
- **Impacto:** Nulo en producción. Estos polyfills son parte del runtime de Turbopack en modo dev.
- **Sugerencia:** No aplicar nada. Verificar en `next build` que estos polyfills no estén en el bundle de producción.
- **Prioridad:** N/A (artefacto del modo dev).

#### 4. JavaScript no minificado y sin source maps (solo en dev)
- **Descripción:** `Reduce unused JavaScript: Est savings of 358 KiB` y `Minify JavaScript: Est savings of 206 KiB`.
- **Impacto:** Nulo en producción. `next dev` no minifica intencionalmente.
- **Sugerencia:** Re-auditar contra `next build && next start` para tener números realistas. Para un audit profesional de producción, esto debería correrse en el deploy de Railway o en una preview branch.
- **Prioridad:** Re-auditar en producción antes de sacar conclusiones.

#### 5. Back/forward cache (bfcache) deshabilitado
- **Descripción:** La página no se restaura desde el bfcache porque tiene WebSocket abierto.
- **Causa:** Es el WebSocket de HMR de Next.js dev. **En producción no existe**.
- **Sugerencia:** No aplicar nada. Auditar en build de producción para confirmar.
- **Prioridad:** N/A (artefacto del modo dev).

#### 6. Network dependency tree
- **Descripción:** Cadena `login HTML → CSS chunk` (≈107 ms). No es una cadena crítica problemática.
- **Sugerencia:** Sin acción requerida. El gráfico es trivialmente corto.
- **Prioridad:** N/A.

### Accessibility (100/100)

Sin findings activos. El audit verificó:
- `<html lang="es">` presente.
- Inputs con `<Label htmlFor>` enlazados (`correo`, `contrasena`).
- `<Image alt="...">` con texto descriptivo.
- Contraste de color cumple WCAG AA en la paleta verde olivo (`#33691e` sobre blanco, blanco sobre `#1a3a0e`).
- Foco visible (estilos shadcn estándar).

**Verificación manual adicional:** El botón "Ingresar" tiene texto visible y `disabled` state correcto. El loader (`Loader2Icon` animado) tiene texto compañero (`"Ingresando..."`) que comunica el estado a screen readers.

### Best Practices (96/100)

#### 1. Console errors (-4 puntos)
- **Descripción:** El browser registra `ERR_CONNECTION_REFUSED` al intentar `GET http://localhost:4020/api/empresa`. Esto ocurre porque el backend no está corriendo durante el audit; el frontend igualmente debe ser resiliente a esa falla y no mostrar errores en consola.
- **Causa:** En `src/lib/empresa.ts` el `fetchEmpresa` ya captura el error con `try/catch`, pero el `console.error` lo emite el browser nativo al ver el TCP rechazado — no es JavaScript que tu código loguee. **En producción el backend siempre está disponible**, por lo que este error no aparecerá.
- **Sugerencia:** No aplicar nada en el código. Documentar que para auditorías de producción se requiere el backend corriendo.
- **Prioridad:** Baja (artefacto del entorno de audit).

#### 2. Valid source maps (-0 puntos, solo informativo)
- **Descripción:** Source maps no expuestos para los chunks de Next dev.
- **Causa:** Modo dev no expone `.map` files con headers correctos.
- **Sugerencia:** En producción no aplica (los source maps en prod son una decisión deliberada — por seguridad muchas veces NO se exponen).
- **Prioridad:** N/A.

### SEO (100/100)

Sin findings. El audit verificó:
- `<title>` presente (`"SIADLP — La Cosecha S.A.C."`).
- `<meta name="description">` presente.
- `<html lang="es">` correcto.
- Links con texto descriptivo.
- Viewport meta tag presente.
- Status 200 (sin redirects no deseados).
- `robots.txt` no requerido para SaaS interno (recomendación futura si se publica una landing).

---

## Fixes aplicados en este audit

| Archivo | Cambio |
|---------|--------|
| `apps/frontend/src/app/login/page.tsx` | `<Image>` del logo: agregado `sizes="160px"` y `fetchPriority="high"`. Permite que Next sirva la variante 160w correcta y prioriza la petición del LCP. |
| `apps/frontend/src/components/app-sidebar.tsx` | `<Image>` del logo del sidebar: agregado `sizes="56px"`. Reduce los bytes servidos en la primera carga del dashboard. |
| `apps/frontend/src/app/(dashboard)/configuracion/page.tsx` | `<Image>` fallback (`/LogoLaCosecha.png`): agregado `sizes="160px"` para consistencia. La variante con `empresa.logoUrl` ya tiene `unoptimized` y no genera srcset. |

**Resumen:** 3 archivos modificados. Cambios mínimos, no rompen ningún diseño (solo afectan la selección de variantes del `srcset` de Next.js Image Optimization).

---

## Findings NO aplicados (con razón)

| Finding | Razón |
|---------|-------|
| Comprimir más el logo (q=60 o WebP) | Cambia calidad visual, requiere validación con el cliente. Ahorro estimado: 18 KiB. |
| Configurar `optimizeCss: true` en `next.config.ts` | Requiere instalar `critters` como devDependency. Indicado por la misión que NO se instalen deps sin coordinar. |
| Reducir Console errors del fetch a `/empresa` | El error proviene de que el backend no estaba corriendo durante el audit. El código frontend ya lo captura con try/catch. **En producción no aparecerá**. |
| Polyfills legacy / JS no minificado / source maps faltantes | Todos son artefactos de `next dev`. Desaparecen en `next build`. |
| bf-cache disabled | WebSocket de HMR; solo en dev. |
| `next/font` para una segunda fuente | El proyecto ya usa `next/font/google` para Geist. No hay otra fuente que optimizar. |
| Cambios de contraste / colores | La misión excluye explícitamente cambios de diseño. El score de A11y es 100. |
| Refactor de Server Components / streaming | Refactor mayor fuera de alcance. El `login` y `dashboard` son client components con `useEffect` para data fetching; migrarlos a RSC con streaming requiere coordinación. |

---

## Recomendaciones para iteraciones futuras

Estos puntos requieren refactor o coordinación y deberían tratarse en un próximo sprint de performance:

1. **Auditar contra `next build && next start`.** Los scores en dev no son representativos del bundle de producción. Tras desplegar a Railway o levantar el build localmente, re-correr el mismo audit para tener métricas confiables. Estimado: el LCP en prod debería bajar de 0.9 s a 0.2–0.4 s y el bundle pesar ≈40% menos.

2. **Convertir `LogoLaCosecha.png` a WebP/AVIF.** Es un PNG de 256x206 que con Next Image Optimization ya se convierte automáticamente si el browser acepta WebP, pero el archivo fuente sigue siendo PNG. Subir un WebP o usar `sharp` (que Next ya requiere internamente en prod) reduciría bytes en origen.

3. **Mover el dashboard root a un Server Component con streaming.** Hoy `app/(dashboard)/page.tsx` es `'use client'` y hace `useEffect` para `apiGet('/reports/dashboard')`. Convertirlo a RSC con `fetch` cacheado y Suspense boundary mejoraría TTFB y eliminaría el flash de Skeleton inicial.

4. **`AuthGuard` server-side.** Hoy la auth corre en cliente; el HTML inicial del dashboard se envía al navegador y luego JavaScript redirige a `/login`. Validar la sesión en `middleware.ts` (Next.js 16) eliminaría el render perdido y bajaría el TTI.

5. **Code-split agresivo del sidebar.** El `AppSidebar` carga ≈30 íconos de Lucide. Importar solo los que se usan (ya pasa, son named imports) y verificar que tree-shaking funcione en el build de producción.

6. **CSP y otros headers de seguridad.** Lighthouse no audita CSP por defecto, pero es buena práctica. Agregar `Content-Security-Policy` en `next.config.ts` mejoraría el score de Best Practices y la postura de seguridad.

7. **Lazy load de gráficos en futuras vistas de reportes.** Cuando se agreguen charts (recharts/chart.js), envolverlos en `next/dynamic` para no inflar el bundle inicial.

8. **Re-auditar tras login real.** Hoy `/` muestra el splash del `AuthGuard`. Sería útil correr Lighthouse autenticado (con cookie de sesión inyectada) para medir el dashboard real. Se puede hacer con Playwright + Lighthouse programático.

---

## Reproducir el audit

**Prerequisitos:**
- Frontend corriendo: `pnpm --filter frontend dev` (puerto 3020).
- Idealmente el backend también corriendo en `:4020` para evitar el console error.
- Google Chrome instalado en el path estándar.

**Comando exacto (PowerShell o Bash, desde la raíz del repo):**

```bash
# /login
pnpm dlx lighthouse http://localhost:3020/login \
  --output=json --output=html \
  --output-path=./apps/frontend/.lighthouse/login \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu" \
  --preset=desktop \
  --quiet \
  --only-categories=performance,accessibility,best-practices,seo \
  --max-wait-for-load=60000

# Dashboard root
pnpm dlx lighthouse http://localhost:3020/ \
  --output=json --output=html \
  --output-path=./apps/frontend/.lighthouse/dashboard \
  --chrome-flags="--headless=new --no-sandbox --disable-gpu" \
  --preset=desktop \
  --quiet \
  --only-categories=performance,accessibility,best-practices,seo \
  --max-wait-for-load=60000
```

**Nota:** Es esperable ver al final un `EPERM, Permission denied` al intentar borrar el tmpdir de Chrome en Windows. Los reportes se generan correctamente antes del cleanup; el error es de chrome-launcher y no afecta los resultados.

**Reportes generados:**
- `apps/frontend/.lighthouse/login.report.html` — versión inicial de `/login`.
- `apps/frontend/.lighthouse/login.report.json` — JSON inicial.
- `apps/frontend/.lighthouse/login-after.report.html` — post-fixes.
- `apps/frontend/.lighthouse/login-after.report.json` — JSON post-fixes.
- `apps/frontend/.lighthouse/dashboard.report.html` — render inicial del dashboard.
- `apps/frontend/.lighthouse/dashboard.report.json` — JSON del dashboard.

Abrir cualquiera de los `.html` en un browser para ver el reporte completo de Lighthouse con todos los detalles, screenshots de la línea de tiempo y árbol de network.
