# Estrategia de Testing — SIADLP

> Documento de referencia técnica que define la estrategia, herramientas, métricas y procesos de aseguramiento de calidad del sistema SIADLP. Este documento es **fuente de verdad** para todo lo relacionado con testing del proyecto.

---

## 1. Propósito

Este documento responde **cuatro preguntas fundamentales** que cualquier evaluador, revisor de código o miembro nuevo del equipo va a hacer:

1. **¿Qué se testea y por qué?**
2. **¿Cómo se testea (qué herramientas y patrones)?**
3. **¿Cuándo se testea (en qué momento del ciclo de desarrollo)?**
4. **¿Cómo medimos que el testing es efectivo?**

---

## 2. Filosofía — La Pirámide de Testing

Adoptamos el modelo de **pirámide de testing** propuesto por **Mike Cohn** en *Succeeding with Agile* (2009) y refinado por **Martin Fowler** en su artículo *TestPyramid* (2012).

```
              ▲
             ╱ ╲
            ╱   ╲       E2E (5–15 tests)
           ╱─────╲      Lentos · Frágiles · Caros
          ╱       ╲
         ╱         ╲    Integration (20–40 tests)
        ╱───────────╲   Velocidad media · Cobertura ancha
       ╱             ╲
      ╱               ╲ Unit (100+ tests)
     ╱─────────────────╲ Rápidos · Aislados · Baratos
    ─────────────────────
```

### Justificación de la forma piramidal

| Nivel | Velocidad | ¿Qué prueba? | ¿Cuándo falla? | Cantidad |
|-------|-----------|--------------|----------------|----------|
| **Unit** | <50 ms | Una unidad de código aislada (función, método, clase) | Regresión local de lógica | Cientos |
| **Integration** | 100–500 ms | Varias unidades trabajando juntas (servicio + DB) | Contratos rotos entre capas | Decenas |
| **E2E** | 5–30 s | Flujo completo desde HTTP/UI hasta persistencia | Bugs que el usuario realmente vería | Pocos |

**Conclusión:** invertimos la mayor parte del esfuerzo en unit tests porque son los que dan **mejor retorno por minuto invertido** (rápidos de escribir, rápidos de correr, fáciles de mantener).

### Anti-patrones que evitamos

- **Cono de helado invertido (ice cream cone):** todo E2E. Suite lenta que nadie corre.
- **Reloj de arena:** muchos unit y muchos E2E, sin integration. Bugs de contratos pasan al ambiente real.
- **Cuadrado:** tests sin estrategia, escritos según conveniencia. Falsa sensación de cobertura.

---

## 3. Conceptos clave que aplicamos

### 3.1 Patrón AAA (Arrange · Act · Assert)

Todo test del proyecto sigue esta estructura:

```
Arrange  → preparar el escenario y los datos de entrada
Act      → ejecutar la acción que se está probando
Assert   → verificar que el resultado es el esperado
```

Si un test no se puede leer claramente en estos tres bloques, está mal escrito y se rechaza en code review.

### 3.2 Test doubles (dobles de prueba)

Cuando una unidad bajo prueba depende de otra, reemplazamos la dependencia con un "doble" para mantener el aislamiento:

| Tipo | Cuándo se usa |
|------|---------------|
| **Stub** | Devolver valores predefinidos sin lógica (ej: respuesta fija de un repo) |
| **Mock** | Verificar que se llamó a un colaborador con ciertos argumentos |
| **Spy** | Observar interacciones sin alterar el comportamiento real |
| **Fake** | Implementación funcional liviana (ej: pglite en lugar de PostgreSQL real) |

**Regla práctica:** preferimos **fakes sobre mocks** cuando es viable. Los mocks frágiles rompen tests al refactorizar; los fakes resisten.

### 3.3 Coverage — qué medimos y qué NO medimos

Coverage es una **métrica necesaria pero insuficiente**.

| Métrica | Qué mide | Útil porque |
|---------|----------|-------------|
| **Line coverage** | Líneas ejecutadas | Detecta código sin ningún test |
| **Branch coverage** | Caminos del flujo (if/else, try/catch) | Detecta caminos no testeados |
| **Mutation score** | Tests que detectan código alterado | Mide **calidad real** de los tests |

**Compromiso del proyecto:** umbral mínimo de **80% de branch coverage** sobre lógica de dominio (servicios, validaciones, máquinas de estado). UI y código generado quedan excluidos.

### 3.4 Mutation testing — el test de los tests

Coverage alto puede ser falsa seguridad. Una herramienta de **mutation testing** (ej: Stryker) altera el código fuente intencionalmente:

- Cambia `>` por `>=`
- Cambia `+` por `-`
- Reemplaza retornos por valores constantes

Si los tests **siguen pasando con código mutado**, son tests débiles. El **mutation score** es el porcentaje de mutantes detectados.

> **Defensa en sustentación:** "Tener 90% de line coverage no garantiza calidad. Por eso medimos mutation score como métrica de profundidad real."

---

## 4. Stack técnico — herramientas elegidas

### 4.1 Backend (NestJS)

| Herramienta | Rol | Por qué |
|-------------|-----|---------|
| **Jest** | Test runner + framework de aserciones | Estándar de facto en NestJS, ya integrado con `@nestjs/testing` |
| **@nestjs/testing** | Bootstrap de módulos para tests | Permite testear con DI real de NestJS |
| **supertest** | Cliente HTTP para tests E2E | Permite testear el server sin levantarlo en puerto real |
| **pglite** (`@electric-sql/pglite`) | PostgreSQL embebido en memoria | Integration tests sin Docker, súper rápidos, schema real |

**Por qué pglite y no SQLite:** SQLite difiere de PostgreSQL en sintaxis (JSON, arrays, CTE, transacciones). Usar SQLite en tests deja pasar bugs específicos de Postgres. Pglite es Postgres real compilado a WASM.

### 4.2 Frontend (Next.js + React)

| Herramienta | Rol | Por qué |
|-------------|-----|---------|
| **Vitest** | Test runner para componentes y hooks | Más rápido que Jest, integración nativa con Vite/Turbopack, API compatible con Jest |
| **React Testing Library (RTL)** | Testear componentes desde la perspectiva del usuario | Filosofía: "test behavior, not implementation". Reduce tests frágiles |
| **@testing-library/user-event** | Simular interacciones reales | Más fiel que `fireEvent` (dispara cadena completa de eventos) |
| **Playwright** | E2E sobre navegador real | Estándar moderno, multi-browser, debugging excelente, network mocking |

**Por qué RTL y no Enzyme:** Enzyme expone internals (state, props), promueve tests acoplados al cómo en lugar del qué. RTL fuerza testear lo que el usuario ve.

**Por qué Playwright y no Cypress:** Playwright soporta multi-browser real (Chromium, Firefox, WebKit), múltiples tabs, mejor performance, y APIs más modernas.

### 4.3 Cross-cutting

| Herramienta | Rol |
|-------------|-----|
| **GitHub Actions** | Pipeline de CI/CD |
| **Husky** | Git hooks (pre-commit, pre-push) |
| **lint-staged** | Correr lint/format solo sobre archivos staged |
| **Codecov** (opcional) | Reporte de coverage en cada PR |

---

## 5. Estrategia por capa

### 5.1 Backend — tres niveles

#### Nivel 1: Unit tests (`*.spec.ts`)
- **Ubicación:** junto al archivo bajo prueba (`auth.service.ts` → `auth.service.spec.ts`)
- **Aislamiento:** Prisma se mockea con `jest.fn()` o un repository fake
- **Cubre:**
  - Lógica de servicios
  - Validadores custom
  - Máquinas de estado (`canTransition`, `canTransitionOc`)
  - DTOs (validaciones de class-validator)

#### Nivel 2: Integration tests (`*.integration.spec.ts`)
- **Ubicación:** `apps/backend/test/integration/`
- **DB:** pglite levantado por test suite con `beforeAll` / `afterAll`
- **Schema:** se aplica el `prisma migrate deploy` sobre pglite
- **Cubre:**
  - Transacciones que tocan múltiples tablas
  - Cascadas de Prisma (`onDelete: Cascade`)
  - Constraints únicos y foreign keys
  - Lógica que depende de SQL real (índices, ordenamientos)

#### Nivel 3: E2E tests (`*.e2e-spec.ts`)
- **Ubicación:** `apps/backend/test/`
- **App:** instancia completa de NestJS levantada con supertest
- **DB:** pglite poblada con seeds mínimos por test
- **Cubre:**
  - Flujos HTTP completos (auth → controller → service → DB → response)
  - Comportamiento de guards y middlewares (JWT, throttler, helmet)
  - Status codes y forma del response

### 5.2 Frontend — dos niveles

#### Nivel 1: Component tests (`*.test.tsx`)
- **Ubicación:** junto al componente o página
- **Backend:** mockeado con `vi.fn()` o MSW (Mock Service Worker)
- **Cubre:**
  - Renderizado condicional (loading, empty, error states)
  - Validaciones de formularios (inputs inválidos muestran mensajes)
  - Interacciones de usuario (click, type, select)
  - Custom hooks aislados

#### Nivel 2: E2E tests (`tests-e2e/*.spec.ts`)
- **Ubicación:** `apps/frontend/tests-e2e/`
- **App:** Next.js corriendo en preview build, backend con DB de testing
- **Cubre:**
  - Login → Dashboard
  - Crear cliente con ubigeo en cascada
  - Crear pedido y ver el flujo completo
  - **Pocos pero contundentes** (5–10 tests máximo)

---

## 6. Métricas y umbrales de calidad

| Métrica | Umbral mínimo | Acción si falla |
|---------|---------------|-----------------|
| **Branch coverage** (lógica de dominio) | 80% | Build CI rojo, PR no mergeable |
| **Mutation score** (servicios críticos) | 70% | Warning, no bloqueante (revisión manual) |
| **Tiempo de unit suite** | < 30s | Investigar tests lentos |
| **Tiempo de integration suite** | < 2 min | Optimizar setup/teardown |
| **Tiempo de E2E suite** | < 5 min | Reducir tests, paralelizar |

### Política de exclusión de coverage

Quedan excluidos del cálculo de coverage:

- Archivos generados (Prisma Client, build outputs)
- Configuraciones (`next.config.ts`, `nest-cli.json`)
- Migraciones SQL
- DTOs puros sin lógica
- Constantes (`*.constants.ts`)

---

## 7. Pre-commit hooks (Husky + lint-staged)

Antes de cada commit, automáticamente:

1. **ESLint** corre solo sobre archivos staged
2. **Prettier** formatea archivos staged
3. **TypeScript** verifica tipos del proyecto
4. **Tests rápidos** (solo unit) corren sobre archivos staged

Si alguno falla, **el commit se cancela**. Esto previene que código roto entre al historial.

---

## 8. CI/CD — GitHub Actions

### Workflow `ci.yml`

Cada push a cualquier rama y cada Pull Request dispara:

```
1. Checkout
2. Setup Node 20 + pnpm
3. Install dependencies (con cache)
4. Lint (pnpm lint)
5. Type check (pnpm tsc --noEmit)
6. Unit tests backend (pnpm --filter backend test)
7. Integration tests backend (pglite)
8. E2E tests backend
9. Component tests frontend (Vitest)
10. E2E tests frontend (Playwright headless)
11. Coverage report → Codecov (opcional)
12. Coverage gate check (≥80% branch)
```

**Si cualquier paso falla, el PR no es mergeable** (rama protegida en GitHub).

### Badges en README

```
[![CI](https://github.com/.../workflows/CI/badge.svg)]
[![Coverage](https://codecov.io/.../badge.svg)]
```

---

## 9. Plan de ejecución (7 fases)

| Fase | Entregable | Tiempo estimado |
|------|------------|-----------------|
| **0** | Este documento (`docs/TESTING.md`) | 30 min |
| **1** | Infraestructura: configs Vitest, pglite, Playwright, Husky | 2 h |
| **2** | Unit tests backend (auth, transitions, DTOs, services) | 4 h |
| **3** | Integration tests backend (pglite) | 4 h |
| **4** | E2E backend (supertest) | 4 h |
| **5** | Component tests frontend (Vitest + RTL) | 6 h |
| **6** | E2E frontend (Playwright) | 4 h |
| **7** | CI/CD GitHub Actions + badges README | 2 h |

**Total estimado: ~26 horas de trabajo dedicado** (≈ 1 semana laboral con foco).

---

## 10. Cómo correr los tests

```bash
# Todo el proyecto
pnpm test

# Solo backend
pnpm --filter backend test            # Unit + Integration
pnpm --filter backend test:cov        # Con coverage
pnpm --filter backend test:e2e        # Solo E2E
pnpm --filter backend test:watch      # Watch mode (desarrollo)

# Solo frontend
pnpm --filter frontend test           # Component tests (Vitest)
pnpm --filter frontend test:e2e       # Playwright

# Mutation testing (esporádico, no en CI)
pnpm --filter backend test:mutation
```

---

## 11. Cómo agregar un test nuevo

### Para una función de dominio
1. Identificar **comportamiento** a probar (no implementación)
2. Crear `archivo.spec.ts` junto al archivo bajo prueba
3. Aplicar patrón **AAA**
4. Cubrir: caso feliz + casos borde + casos de error
5. Correr `pnpm test --watch` durante desarrollo

### Para un endpoint nuevo
1. Unit test del **service** (lógica)
2. Integration test del **repository** (SQL real)
3. E2E del **controller** (HTTP completo)

### Para un componente nuevo
1. Test de **renderizado inicial**
2. Test de **interacciones** (click, type)
3. Test de **estados** (loading, error, empty, success)
4. Test de **accesibilidad** (`aria-*`, roles, labels)

---

## 12. Referencias

- Cohn, M. (2009). *Succeeding with Agile* — origen de la pirámide de testing
- Fowler, M. (2012). *TestPyramid* — https://martinfowler.com/bliki/TestPyramid.html
- Khorikov, V. (2020). *Unit Testing Principles, Practices, and Patterns* — Manning
- Osherove, R. (2013). *The Art of Unit Testing* (2nd ed.) — Manning
- Documentación oficial de Jest, Vitest, Testing Library, Playwright

---

## 13. Glosario

- **AAA:** Arrange, Act, Assert — patrón estándar de estructura de tests
- **DI:** Dependency Injection — patrón usado por NestJS
- **DTO:** Data Transfer Object — objetos de validación de entrada
- **E2E:** End-to-end — test de flujo completo
- **Fixture:** datos predefinidos usados por tests
- **Mock:** doble que verifica interacciones
- **Mutation testing:** técnica de medir calidad de tests alterando el código
- **pglite:** PostgreSQL compilado a WebAssembly
- **RTL:** React Testing Library
- **Stub:** doble que devuelve valores predefinidos
- **TDD:** Test-Driven Development — escribir test antes que código

---

**Última actualización:** 2026-05-06
**Mantenedor:** equipo SIADLP
