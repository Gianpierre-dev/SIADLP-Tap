# Mutation Testing — SIADLP Backend

## Qué es y por qué importa

**Coverage alto != tests buenos.** Una suite puede ejecutar el 100% de tus líneas de
código y aun así no detectar bugs reales. Mutation testing resuelve eso: introduce
pequeños "bugs" intencionales (mutantes) en el código de producción y vuelve a correr
los tests. Si los tests pasan con el bug presente, el mutante **sobrevivió** —
señal de que los assertions son débiles, faltan casos de borde, o el test no estaba
validando lo que parecía validar.

> "Coverage te dice qué líneas pasaron por el test runner.
> Mutation score te dice qué cambios reales rompen tus tests."

### Coverage vs Mutation Score

| Métrica | Qué mide | Limitación |
|---------|----------|------------|
| Coverage | Líneas/branches ejecutadas durante los tests | No verifica que los tests realmente ASSERT-een el comportamiento |
| Mutation Score | % de mutantes que los tests detectan (killed) | Requiere correr la suite N veces (más lento) |

Ejemplo concreto: un test con `expect(result).toBeDefined()` da coverage 100% pero
mata 0 mutantes que cambien el valor numérico devuelto. Mutation testing detecta
ese tipo de tests "vacíos".

---

## Cómo correrlo

Desde la raíz del monorepo:

```bash
pnpm --filter backend test:mutation
```

O dentro de `apps/backend/`:

```bash
pnpm test:mutation
```

El comando ejecuta `stryker run`, que toma el config de
`apps/backend/stryker.config.json`.

### Tiempo esperado

La primera corrida puede tardar entre **5 y 15 minutos** dependiendo de la
máquina. Stryker:

1. Compila el TypeScript con el checker estricto.
2. Corre la suite Jest una vez para medir coverage por test.
3. Genera mutantes (cambios pequeños como `>` → `>=`, `&&` → `||`, eliminar
   condiciones, etc.).
4. Por cada mutante, corre solo los tests que cubren la línea afectada.

`coverageAnalysis: perTest` reduce drásticamente el tiempo vs `all`.

---

## Archivos bajo mutación

Hoy mutamos solo los servicios y guards críticos del dominio:

| Archivo | Razón |
|---------|-------|
| `src/auth/auth.service.ts` | Login, refresh, password hashing — riesgo seguridad |
| `src/auth/guards/permissions.guard.ts` | RBAC core — riesgo seguridad |
| `src/dispatch/dispatch.service.ts` | Distribución, lógica de negocio |
| `src/orders/orders.service.ts` | Pedidos, lógica de negocio |
| `src/catalogs/clients/clients.service.ts` | Multi-tenant filtering, validaciones |

**No se mutan:**
- `*.spec.ts` — son los tests, no el código bajo prueba
- `*.module.ts` — solo wiring de DI
- `*.controller.ts` — testeados vía e2e/integration, no unit
- `dto/**` — solo class-validator decorators
- `main.ts` — bootstrap

Para extender la cobertura de mutación, editá el array `mutate` en
`stryker.config.json`.

---

## Threshold actual

```json
"thresholds": {
  "high": 80,
  "low": 60,
  "break": 70
}
```

| Rango | Significado |
|-------|-------------|
| `>= high (80%)` | Verde — suite de tests sólida |
| `[low, high) (60-80%)` | Amarillo — aceptable, hay espacio para mejorar |
| `< low (60%)` | Rojo — tests débiles, refactorizar urgente |
| `< break (70%)` | El comando exit code != 0 (CI falla) |

---

## Cómo interpretar el reporte HTML

Stryker genera un reporte navegable en
`apps/backend/stryker-report/mutation-report.html`. Abrilo en el navegador.

Para cada archivo verás:

- **Killed (verde):** los tests detectaron el mutante. ✅
- **Survived (rojo):** ningún test falló con el cambio. ❌ — hay que mejorar el test.
- **No coverage (amarillo):** ningún test cubre esa línea. Falta un test.
- **Timeout (naranja):** el mutante hizo loop infinito o el test colgó. Cuenta como killed.
- **Compile error (gris):** el mutante no compila — Stryker lo descarta.

Click en cada mutante survived te muestra el cambio exacto. Eso es exactamente lo
que tenés que cubrir con un nuevo `expect()` o un nuevo caso de test.

### Tipos de mutantes comunes

| Mutador | Ejemplo |
|---------|---------|
| ConditionalExpression | `if (x > 0)` → `if (true)` o `if (false)` |
| EqualityOperator | `a === b` → `a !== b` |
| LogicalOperator | `a && b` → `a \|\| b` |
| ArithmeticOperator | `a + b` → `a - b` |
| BooleanLiteral | `true` → `false` |
| StringLiteral | `"admin"` → `""` |
| BlockStatement | `{ doX(); }` → `{}` (cuerpo eliminado) |
| MethodExpression | `arr.filter(...)` → `arr` |
| OptionalChaining | `user?.email` → `user.email` |

---

## Defensa en sustentación

Argumento listo para el panel:

> "Nuestros tests no solo cubren el 80% de las líneas (coverage). Validamos
> activamente que detecten cambios reales en el código mediante mutation testing
> con Stryker. Nuestro mutation score es de **X%**, lo que significa que de
> N mutaciones automáticas inyectadas en los servicios críticos, los tests
> detectan X de ellas. Eso transforma el coverage en una métrica de **calidad
> real**, no solo de ejecución."

---

## Troubleshooting

### Stryker es muy lento

- Bajá `concurrency` si tu máquina tiene poca RAM (default 4).
- Subí `timeoutMS` si Pino o pglite startup tarda mucho (default 60000ms aquí).
- Reducí el array `mutate` para correr solo un servicio a la vez durante desarrollo.

### "Cannot find tsconfig"

Stryker corre desde `apps/backend`. El `tsconfigFile` es relativo a esa carpeta.

### Muchos mutantes "no coverage"

Significa que no hay test que toque esa línea. Mejorás eso escribiendo más unit
tests, no tocando Stryker.

### Errores de compilación con typescript-checker

Si el typescript checker descarta muchos mutantes por "compile error", podés
desactivarlo temporalmente con `"disableTypeChecks": true` para ver más
mutantes. Pero a la larga querés mantenerlo en `false` porque filtra mutantes
inválidos que ensuciarían la métrica.

---

## CI

**Hoy NO está integrado en CI.** Es un comando manual:

```bash
pnpm --filter backend test:mutation
```

Razón: el tiempo de ejecución (~7-10 min) lo hace inviable para PRs. Cuando el
score se estabilice arriba del threshold de break, evaluamos integrarlo en un
job nightly.

---

## Baseline (primera corrida)

| Métrica | Valor |
|---------|-------|
| Mutation score TOTAL | **36.75%** |
| Mutation score COVERED (excluye no-cov) | 59.34% |
| Killed | 197 |
| Survived | 135 |
| Timeouts | 0 |
| No coverage | 204 |
| Compile errors (descartados por TS checker) | 297 |
| Mutantes generados | 833 |
| Tiempo total | 7 min 20 s |
| Threshold break | 70% (no alcanzado — exit code 1) |

### Score por archivo

| Archivo | Score total | Score covered | Killed | Survived | NoCov |
|---------|-------------|---------------|--------|----------|-------|
| `auth/auth.service.ts` | 85.19% | 85.19% | 23 | 4 | 0 |
| `catalogs/clients/clients.service.ts` | 93.94% | 93.94% | 31 | 2 | 0 |
| `auth/guards/permissions.guard.ts` | 76.92% | 76.92% | 20 | 6 | 0 |
| `orders/orders.service.ts` | 35.14% | 61.18% | 52 | 33 | 63 |
| `dispatch/dispatch.service.ts` | 23.51% | 44.10% | 71 | 90 | 141 |

**Lectura honesta del resultado:**

- `auth.service`, `clients.service`, `permissions.guard` están en zona aceptable
  (76-94%). Pequeñas mejoras los llevan al threshold high.
- `orders.service` y `dispatch.service` tienen MUCHO código sin cobertura de tests
  (no-cov: 204 mutantes en líneas que ningún test toca). Ahí no es solo
  "mejorar tests" — es "escribir tests faltantes".

### Top 5 mutantes survived (priorizar fix)

#### 1. `permissions.guard.ts:65` — comparación de expiración del cache TTL

```ts
// Original
if (cached && cached.expiresAt > Date.now()) return cached.permissions;
// Survived
if (cached && cached.expiresAt >= Date.now()) return cached.permissions;
```

**Por qué importa:** el test no distingue entre `>` y `>=` en la frontera del
cache. Es un edge case de seguridad (un permiso podría seguir cacheado un tick
extra). **Fix sugerido:** test que setea `expiresAt = Date.now()` exacto y
verifica que se considera expirado.

#### 2. `permissions.guard.ts:65` — condición completa siempre true

```ts
// Original
if (cached && cached.expiresAt > Date.now()) return cached.permissions;
// Survived
if (cached && true) return cached.permissions;
```

**Por qué importa:** ningún test cubre el camino "cache expirado pero existe".
**Fix sugerido:** test que mocke un `cached.expiresAt` en el pasado y verifica
que se vuelve a consultar la DB.

#### 3. `auth.service.ts:58` — mensaje de UnauthorizedException

```ts
// Original
throw new UnauthorizedException('Credenciales inválidas');
// Survived
throw new UnauthorizedException("");
```

**Por qué importa:** el test verifica que se lanza la exception, pero NO el
mensaje. En seguridad eso importa porque el mensaje genérico es la primera
defensa contra enumeración de usuarios. **Fix sugerido:**
`expect(error.message).toBe('Credenciales inválidas')` o usar
`.toThrow('Credenciales inválidas')`.

#### 4. `permissions.guard.ts:38` — array de targets para reflector vacío

```ts
// Original
this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY,
  [context.getHandler(), context.getClass()]);
// Survived
this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, []);
```

**Por qué importa:** el test "permite acceso cuando NO hay metadata" pasa con
ambos. Si el array está vacío, el reflector no encuentra nada y devuelve
undefined → guard permite acceso. Pero en producción, si alguien rompe el array,
TODOS los endpoints quedarían públicos. **Fix sugerido:** un test que pone
permisos en el HANDLER y otro en la CLASE, y verifica que ambos paths del
reflector se consultan.

#### 5. `dispatch.service.ts:104` — filtro WHERE del `findMany`

```ts
// Original
where: { id: { in: dto.pedidoIds } }
// Survived
where: {}
```

**Por qué importa:** este es **GRAVE**. Si la mutación a `where: {}` no es
detectada por los tests, significa que el test mockea `findMany` y no verifica
que el WHERE realmente filtre por los IDs del DTO. En producción, un bug así
filtraría TODOS los pedidos del sistema (multi-tenant violation). **Fix
sugerido:** assertion sobre el primer argumento de `prisma.pedido.findMany.mock
.calls[0][0].where` para verificar que contiene `id: { in: dto.pedidoIds }`.

---

## Recomendaciones para mejorar el score

1. **`dispatch.service.ts` (23.51%)** — el peor del lote. Tiene 141 mutantes
   sin coverage. Acciones:
   - Auditar qué métodos del service NO tienen test asociado.
   - Agregar tests para los caminos de error (NotFoundException,
     BadRequestException).
   - Verificar argumentos pasados a Prisma con `.toHaveBeenCalledWith()`.

2. **`orders.service.ts` (35.14%)** — 63 mutantes no-cov. Parece haber métodos
   completos sin test (ej: el agrupamiento por producto en línea ~268).

3. **Patrón general:** muchos survived son `StringLiteral` (mensaje vaciado a
   `""`). Indica que los tests verifican la **forma** del error pero no el
   **contenido**. Reemplazar `expect(...).toThrow(SomeException)` por
   `expect(...).toThrow('mensaje exacto')` mata casi todos esos.

4. **Patrón Prisma WHERE:** los survived con `where: {}` son TODOS un mismo
   anti-pattern: tests que mockean Prisma sin assert sobre los argumentos.
   Establecer convención: SIEMPRE verificar `.toHaveBeenCalledWith()` con el
   objeto where completo.

5. **Cache TTL en permissions.guard:** los mutantes aritméticos
   (`5 * 60 * 1_000` → `5 * 60 / 1_000`) sobreviven porque ningún test verifica
   el valor real del TTL. Para un cache de seguridad esto debería tener un test
   directo.

6. **Iteración:** correr `pnpm test:mutation` después de cada PR que toque los
   services bajo mutación, para ver si el score sube o baja. El objetivo es
   llegar a >70% en TODOS los archivos antes de habilitar `break: 70` en CI.
