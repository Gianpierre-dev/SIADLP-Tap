# ADR-003: Reducción del alcance a distribución pura (MVP)

## Status

Accepted (supersedes alcance original con módulos de compras, producción, inventario, precios y cobros)

## Context

La versión inicial de SIADLP modelaba el ciclo completo de negocio de La Cosecha S.A.C.: compras a proveedores con recepción y kardex, producción con insumos MP → productos PT (rendimiento, merma, costo/kg), inventario dual con movimientos y ajustes, precios con tarifa por ruta y cobros parciales/totales. El schema acumuló más de quince entidades, varias máquinas de estado interdependientes y una cantidad de invariantes que multiplicaba la superficie de testing y mantenimiento:

- Stock no-negativo en cada movimiento de inventario.
- Kardex consistente entre `movimientos_inventario` y el saldo de `items_inventario`.
- Cuadre de cobros: suma de cobros parciales ≤ total del pedido, con manejo de saldos pendientes.
- Producción consumiendo MP con merma controlada y generando PT con rendimiento medible.
- Recepción de OC actualizando stock automáticamente con consistencia transaccional.

Para el TAP el plazo es acotado, el equipo es de dos personas y el evaluador necesita ver un sistema **terminado, testeado y defendible**, no uno amplio pero parcialmente roto. Adicionalmente, el corazón del negocio que el cliente prioriza es la **distribución**: que los pedidos del día se asignen a una hoja de carga, salgan en ruta y se registre la entrega. Compras, producción y cobros eran "nice to have" en este ciclo.

La decisión, en términos de gestión de proyecto, es clásica: ante alcance amplio + plazo fijo + calidad innegociable, la única variable libre es **alcance**. Recortar es la respuesta correcta.

## Decision

Reducir el alcance del sistema a **distribución pura**: pedido → asignación a hoja de carga → despacho → entrega. Eliminar del schema y del código toda la cadena de aprovisionamiento, producción, inventario y dinero.

**Tablas eliminadas del schema:**

- `proveedores`, `ordenes_compra`, `detalle_ordenes_compra` — módulo de compras completo.
- `ordenes_produccion`, `productos_produccion`, `insumos_produccion` — módulo de producción completo.
- `items_inventario`, `movimientos_inventario` — kardex y stock.

**Campos eliminados** de `Pedido`, `HojaCarga` y `Entrega`: `total`, `precio_base`, `tarifa_ruta`, `monto_cobrado`, `saldo`, `metodo_pago` y similares. La consecuencia es que el dominio **no maneja dinero**.

**Tablas que se mantienen** (visibles en `apps/backend/prisma/schema.prisma`):

- Auth: `Usuario`, `Rol`, `Permiso`, `RolPermiso`.
- Geografía: `Departamento`, `Provincia`, `Distrito` (ubigeo Perú).
- Catálogos: `Cliente`, `Producto`, `Ruta`, `Vehiculo`, `Chofer`.
- Operación: `Pedido`, `DetallePedido`, `EstadoPedidoLog`, `HojaCarga`, `Entrega`.
- Cross-cutting: `RegistroAuditoria`, `Empresa`.

## Implementation notes

- El refactor se hizo en el PR #11 sobre la rama `feat/version-completa`.
- Se eliminaron las migraciones legacy de los módulos descartados y se consolidó un baseline limpio con `prisma migrate diff --from-empty`.
- Los seeds (`apps/backend/prisma/seed.ts`) se redujeron a usuarios, roles, permisos, ubigeo, catálogos mínimos y un puñado de pedidos de ejemplo.
- Los integration tests defensivos (`schema.integration.spec.ts`) consultan `information_schema.tables` y aseveran que las tablas eliminadas no figuran. Si alguien re-introduce una migración de compras por error, el test falla.
- El frontend eliminó las páginas de `/compras`, `/produccion`, `/inventario` y los componentes que mostraban precios o cobros.
- El dashboard se simplificó: ahora muestra KPIs operativos (pedidos del día, hojas de carga activas, entregas pendientes) y no financieros.

## Consequences

### Positive

- **Foco en el flujo crítico:** pedido → hoja → entrega es lo que el cliente realmente usa todos los días. Maximizar calidad sobre el flujo central da más valor que mediocridad sobre todo el negocio.
- **Suite de tests sostenible:** 165 tests pasando con cobertura ≥80% branch sobre el dominio reducido. Con el alcance original esto era inalcanzable en tiempo dado el tamaño del equipo.
- **Dominio explicable en una pizarra:** la sustentación se vuelve mucho más clara cuando el dominio cabe en un único diagrama de flujo (`docs/flujos/distribucion.html`). Un evaluador entiende el sistema en cinco minutos.
- **Mantenibilidad:** menos máquinas de estado que cuidar, menos invariantes, menos mocks/fakes en tests. Cada cambio futuro tiene menor superficie de impacto.
- **Onboarding más corto:** un nuevo desarrollador entiende el dominio en una tarde en lugar de una semana.
- **Validación defensiva:** integration tests verifican explícitamente que las tablas eliminadas **no existen** en el schema generado, evitando regresiones por copy-paste de migraciones viejas o re-introducción accidental.
- **Velocidad de iteración:** sin precios ni cobros, los tests E2E del flujo principal corren en segundos y se pueden ejercitar con seeds mínimos.

### Negative

- **Pérdida de funcionalidad:** no se modela aprovisionamiento, costos ni cobranza. Si el cliente quiere reactivar esos flujos, hay que re-introducirlos.
- **El sistema NO mide rentabilidad:** sin precios ni cobros, el dashboard no puede calcular margen, ticket promedio ni cartera.
- **Migración de datos en el futuro:** si se reactiva precio/cobro habrá que decidir si los datos históricos quedan sin esos campos o si se backfillean.
- **Documentación legacy:** algunos diagramas y comentarios del repo aún mencionan módulos eliminados; queda como deuda de limpieza.

## Alternatives considered

- **Mantener el alcance completo y reducir testing:** descartado. Entregar un sistema grande con tests débiles contradice la estrategia de calidad declarada en `docs/TESTING.md` (umbral 80% branch coverage, mutation score, pirámide). Un sistema amplio con tests débiles deja flancos abiertos en la sustentación: cualquier evaluador puede pedir "muéstrame el test del cobro parcial" y la suite no tendría respuesta.
- **Mantener alcance y entregar parcialmente probado:** descartado por la misma razón. Es peor admitir cobertura desigual que recortar honestamente.
- **Stub de los módulos eliminados (tablas vacías, endpoints no-op):** descartado. Aumenta confusión, ensucia el schema con tablas que nadie usa, deja código muerto que el evaluador podría cuestionar ("¿por qué existe `ordenes_compra` si nunca se inserta?").
- **Reducir a solo catálogos + pedidos sin despacho:** descartado por el extremo opuesto. Quedaba un sistema sin valor de negocio claro — un CRUD glorificado. La distribución es justamente lo que justifica que esto sea un sistema y no una hoja de cálculo.
- **Feature flags para activar/desactivar módulos:** complejidad adicional (configuración, paths condicionales en frontend, tests parametrizados por flag) sin ROI para un MVP académico. La eliminación física es más honesta y mantiene el código simple.
- **Branches paralelas (una con scope completo, otra reducida):** mantener dos versiones del mismo proyecto multiplica el trabajo y diverge rápido. La rama `feat/version-completa` consolida la decisión de scope reducido como camino oficial.

## References

- Flujo reducido — `docs/flujos/distribucion.html`
- PR #11 (refactor de reducción)
- Schema actual — `apps/backend/prisma/schema.prisma`
- Integration test defensivo — `apps/backend/test/integration/schema.integration.spec.ts`
- Lean Startup, Eric Ries (2011) — concepto de MVP
