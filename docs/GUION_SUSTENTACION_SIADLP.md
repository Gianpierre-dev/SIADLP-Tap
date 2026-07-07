# Guion de Sustentación — SIADLP

**Trabajo de Aplicación Profesional (TAP)**
Sistema Integrado de Administración y Distribución Logística de Papas — *La Cosecha S.A.C.*
IDAT — Lima, Perú · 2026

---

## Datos de la exposición

| | |
|---|---|
| **Integrantes** | Anthony Gianpierre Terrazas Tello · Paulo Cesar Wong Diaz |
| **Presentación** | `SIADLP_Presentacion_Defensa.pptx` (25 diapositivas) |
| **Duración objetivo** | ~45 minutos (exposición) + preguntas del jurado |
| **Modalidad** | Dos expositores alternados, correlacionados con las diapositivas |

### Roles de expositor

| Rol | Integrante | Bloques que lidera |
|-----|-----------|--------------------|
| **Scrum Master · Backend · Líder Técnico** | **Gianpierre** | Negocio, objetivos, metodología, arquitectura, base de datos, seguridad, conclusiones |
| **Frontend · QA** | **Paulo** | Agenda, alcance, propuesta funcional, planificación ágil, reportes, demo, pruebas, resultados |

### Convenciones del guion

- **[G]** = habla Gianpierre · **[P]** = habla Paulo · **[G+P]** = ambos.
- El texto en *cursiva entre corchetes* son **acotaciones escénicas** (no se leen en voz alta).
- `⏱` indica la duración estimada de cada diapositiva y el acumulado.
- El guion es una **guía**: hay que interiorizarlo, no leerlo palabra por palabra. Mantener contacto visual con el jurado.

---

## Distribución de tiempos (resumen)

| # | Diapositiva | Expositor | Duración | Acumulado |
|---|-------------|-----------|:--------:|:---------:|
| 1 | Portada | G | 1:30 | 1:30 |
| 2 | Agenda | P | 0:45 | 2:15 |
| 3 | La Empresa | G | 1:45 | 4:00 |
| 4 | Análisis FODA | P | 2:00 | 6:00 |
| 5 | Identificación del Problema | G | 2:15 | 8:15 |
| 6 | Objetivo General | G | 1:15 | 9:30 |
| 7 | Objetivos Específicos | G | 2:00 | 11:30 |
| 8 | Alcance — Módulos | P | 1:45 | 13:15 |
| 9 | Fuera de Alcance | P | 1:15 | 14:30 |
| 10 | Propuesta SIADLP | P | 1:45 | 16:15 |
| 11 | Factibilidad Económica | G | 2:15 | 18:30 |
| 12 | Metodología Scrum | G | 2:00 | 20:30 |
| 13 | Recursos y Equipo | P | 1:15 | 21:45 |
| 14 | Cronograma (Gantt) | P | 1:15 | 23:00 |
| 15 | Historias de Usuario | P | 2:00 | 25:00 |
| 16 | Burn Down Charts | G | 1:45 | 26:45 |
| 17 | Arquitectura de Software | G | 2:30 | 29:15 |
| 18 | Base de Datos (20 tablas) | G | 2:15 | 31:30 |
| 19 | Consultas y Reportes | P | 1:30 | 33:00 |
| 20 | Seguridad del Sistema | G | 2:00 | 35:00 |
| 21 | Demostración del Sistema | G+P | 4:00 | 39:00 |
| 22 | Pruebas de Calidad | P | 2:00 | 41:00 |
| 23 | Resultados e Impacto | P | 1:30 | 42:30 |
| 24 | Conclusiones | G | 1:45 | 44:15 |
| 25 | Recomendaciones + Cierre | G+P | 1:30 | 45:45 |

**Total estimado: ~45 min 45 s** (sin contar el turno de preguntas).

---

# GUION

---

## Diapositiva 1 — Portada  ⏱ 1:30 · **[G]**

> **[G]** *(de pie, postura firme, mira al jurado)*
> Buenos días, señores miembros del jurado. Mi nombre es **Anthony Gianpierre Terrazas Tello** y me acompaña mi compañero **Paulo Cesar Wong Diaz**. En representación del equipo, les damos la más cordial bienvenida a la sustentación de nuestro Trabajo de Aplicación Profesional.
>
> El proyecto se titula **«Implementación de un Sistema Web Integrado de Administración y Distribución Logística de Papas para la empresa La Cosecha S.A.C.»**, desarrollado en Lima, durante el año 2026.
>
> A lo largo de esta exposición demostraremos cómo, aplicando desarrollo de software profesional y el marco ágil Scrum, transformamos una operación logística completamente manual en un sistema web trazable, seguro y desplegado en producción.
>
> Con su venia, comenzamos.

*[Transición: Paulo se ubica para presentar la agenda.]*

---

## Diapositiva 2 — Agenda  ⏱ 0:45 · **[P]**

> **[P]** Gracias, Gianpierre. Buenos días, señores del jurado.
> Para ordenar la exposición, seguiremos esta agenda de diez puntos: iniciaremos con **la empresa y el problema** que motivó el proyecto; luego los **objetivos** y el **alcance** de la solución; presentaremos la **propuesta SIADLP** y la **metodología Scrum** aplicada; y cerraremos con los aspectos técnicos —**arquitectura, base de datos, seguridad y pruebas de calidad**— para terminar en **conclusiones y recomendaciones**.
>
> Empecemos por conocer a nuestro cliente.

*[Transición: Gianpierre retoma.]*

---

## Diapositiva 3 — La Empresa  ⏱ 1:45 · **[G]**

> **[G]** **La Cosecha S.A.C.** es una empresa peruana dedicada a la comercialización y **distribución mayorista de papa**, atendiendo principalmente a **pollerías y negocios gastronómicos de Lima Metropolitana**.
>
> Como ven en las tarjetas, su operación diaria consiste en **recibir pedidos, armar la carga por ruta y repartir en unidades de transporte**. Es un negocio de alto volumen y baja tolerancia al error: si un pedido llega tarde o incompleto, la pollería se queda sin insumo en plena jornada.
>
> Y aquí está el punto crítico —el reto—: toda esa operación se manejaba de forma **100 % manual**, en cuadernos y hojas de cálculo sueltas, **sin trazabilidad ni visibilidad** de lo que ocurría en tiempo real. Ese es el terreno sobre el que trabajamos, y del que nace el problema que Paulo y yo analizamos a fondo.

*[Transición: Paulo presenta el diagnóstico estratégico.]*

---

## Diapositiva 4 — Análisis FODA  ⏱ 2:00 · **[P]**

> **[P]** Para entender el punto de partida realizamos un **análisis FODA** de la operación logística de la empresa.
>
> En las **Fortalezas** destacamos una cartera de clientes fidelizada y experiencia en el rubro. En las **Oportunidades**, la creciente digitalización del sector y la posibilidad de diferenciarse por servicio.
>
> Pero lo determinante está en las **Debilidades** y **Amenazas**: procesos manuales propensos a error, **ausencia total de trazabilidad**, dependencia del conocimiento de una sola persona, y el riesgo de perder clientes frente a distribuidores más ordenados.
>
> Este cruce nos dio la estrategia: **convertir las debilidades internas en fortalezas mediante la digitalización del proceso**. El FODA no fue un ejercicio decorativo; fue el que justificó técnicamente por qué el proyecto valía la pena. Con ese diagnóstico, Gianpierre precisa cuál es el problema central.

*[Transición: Gianpierre.]*

---

## Diapositiva 5 — Identificación del Problema  ⏱ 2:15 · **[G]**

> **[G]** El **problema central** lo definimos así: *la gestión manual de pedidos y distribución genera errores, re-despachos y nula visibilidad operativa en tiempo real.*
>
> Y no es una frase genérica; se descompone en causas concretas:
> - Los pedidos se anotaban en **cuadernos y hojas de cálculo dispersas**, sin control de estados.
> - Había **errores y duplicidad en el armado de cargas**, que derivaban en re-despachos y reclamos.
> - No existía **trazabilidad**: nadie podía decir con certeza quién hizo qué, ni en qué estado estaba cada entrega.
> - La asignación de **vehículos y choferes** era informal, sin registro.
> - Y, sobre todo, **la gerencia no tenía indicadores** para tomar decisiones.
>
> La consecuencia es un **riesgo operativo real**: quiebres de servicio y pérdida de imagen ante el cliente. Un problema de negocio que exige una solución de software. Por eso planteamos el siguiente objetivo.

*[Transición: misma persona, siguiente diapositiva.]*

---

## Diapositiva 6 — Objetivo General  ⏱ 1:15 · **[G]**

> **[G]** Nuestro **objetivo general** fue: **desarrollar e implementar un sistema de información web para La Cosecha S.A.C. que automatice y digitalice los procesos de gestión de pedidos y distribución logística**, eliminando el uso de registros manuales y proporcionando **visibilidad en tiempo real** del estado de las operaciones diarias.
>
> Fíjense que el objetivo es medible y verificable: no dice «mejorar»; dice **automatizar, eliminar lo manual y dar visibilidad**. Cada una de esas tres promesas la vamos a demostrar hoy. Y para lograrlo, lo desglosamos en diez objetivos específicos.

*[Transición: misma persona.]*

---

## Diapositiva 7 — Objetivos Específicos  ⏱ 2:00 · **[G]**

> **[G]** Estos son los **diez objetivos específicos**, y son importantes porque **cada uno se convirtió en un módulo verificable** del sistema:
>
> - **OE-01 y OE-02** — seguridad de acceso: gestión de usuarios con **RBAC** y catálogos maestros.
> - **OE-03** — el corazón operativo: **pedidos con máquina de estados y log histórico**.
> - **OE-04 y OE-05** — **despacho** y **registro de entregas en campo**.
> - **OE-06 y OE-07** — **dashboard ejecutivo** y **reportes a Excel**.
> - **OE-08** — **auditoría automática** de operaciones críticas.
> - **OE-09 y OE-10** — **despliegue en producción sobre la nube** y **capacitación y documentación**.
>
> No dejamos ningún objetivo en el papel: los diez están implementados y desplegados. Ahora Paulo detalla qué entra —y qué no— en el alcance.

*[Transición: Paulo.]*

---

## Diapositiva 8 — Alcance: Módulos del Sistema  ⏱ 1:45 · **[P]**

> **[P]** El alcance del sistema se materializa en **nueve módulos funcionales**:
> **Autenticación** con JWT, cifrado y rate limiting; **Usuarios y Roles** con RBAC granular; los **Catálogos** de clientes, productos, rutas, vehículos y choferes; el módulo de **Pedidos** con estados y log; el de **Despacho** con hojas de carga; el registro de **Entregas en campo**; **Reportes y Dashboard**; **Auditoría**; y el módulo de **Empresa y Ubigeo**, con el catálogo geográfico del Perú.
>
> Lo relevante es que estos módulos **cubren el flujo completo** del negocio, de punta a punta. No es un prototipo parcial: es el proceso operativo entero, digitalizado. Pero un buen proyecto también sabe decir «no»: veamos qué dejamos deliberadamente fuera.

*[Transición: misma persona.]*

---

## Diapositiva 9 — Fuera de Alcance  ⏱ 1:15 · **[P]**

> **[P]** Delimitar es tan importante como construir. Definimos explícitamente **fuera de alcance**:
> las **compras** a proveedores, la **producción** con rendimiento y merma, el **inventario dual y kardex**, el **cálculo de precios y cobranza**, la **facturación electrónica con SUNAT**, la **app móvil nativa**, y el **rastreo GPS** y la **pasarela de pagos**.
>
> ¿Por qué lo excluimos? Porque el objetivo era resolver el **núcleo logístico** —pedido, despacho y entrega— con calidad, y no dispersarnos. Estas exclusiones no son limitaciones; son **decisiones de alcance conscientes**, y varias de ellas reaparecerán como recomendaciones de evolución al final. Con el alcance claro, presentamos la propuesta.

*[Transición: misma persona.]*

---

## Diapositiva 10 — Propuesta de Solución: SIADLP  ⏱ 1:45 · **[P]**

> **[P]** Nuestra propuesta es **SIADLP: Sistema Integrado de Administración y Distribución Logística de Papas**.
>
> El esquema resume su esencia: una aplicación web que digitaliza el ciclo completo **Pedido → Despacho → Asignación de vehículo y chofer → Entrega en campo → Reportes y Auditoría**. Cada flecha es una transición controlada por el sistema, no por un cuaderno.
>
> La idea fuerza está abajo: **una sola fuente de verdad**. Cada operación queda registrada, auditada y visible para la gerencia desde el dashboard, en cualquier momento. Eso es exactamente lo que el negocio no tenía. Y como todo proyecto profesional, antes de programar validamos que fuera **económicamente viable**; eso lo sustenta Gianpierre.

*[Transición: Gianpierre.]*

---

## Diapositiva 11 — Factibilidad Económica  ⏱ 2:15 · **[G]**

> **[G]** Un sistema no se justifica solo por ser moderno; se justifica porque **conviene**. Estos son los números.
>
> La **inversión inicial** fue de **S/ 13,600**, equivalente a 320 horas-persona de desarrollo. Frente a eso, el **ahorro anual estimado** es de **S/ 17,112**.
>
> ¿De dónde sale ese ahorro? De la tabla: sin sistema, las pérdidas y sobrecostos anuales por errores, re-despachos y reprocesos ascendían a **S/ 20,400**; con el sistema se reducen a **S/ 3,288**. La diferencia son esos **S/ 17,112** que la empresa deja de perder cada año.
>
> Esto arroja una **relación Beneficio/Costo de 1.25** —mayor a 1—, y una **recuperación de la inversión en menos de diez meses**. En términos simples: por cada sol invertido, la empresa obtiene **1.25 soles** de retorno. El proyecto es económicamente viable, y con esa base pasamos a **cómo lo construimos**.

*[Transición: misma persona.]*

---

## Diapositiva 12 — Metodología: Scrum  ⏱ 2:00 · **[G]**

> **[G]** Adoptamos el marco ágil **Scrum**. La razón es directa: los requisitos de una operación logística evolucionan, y necesitábamos **entregar valor de forma incremental** y ajustar en cada iteración, en lugar de apostar todo a una entrega final.
>
> El proyecto se organizó en **cuatro fases** —Inicio, Planificación, Ejecución y Transición y Cierre— y la ejecución se dividió en **4 sprints a lo largo de 8 semanas**, entre marzo y junio de 2026.
>
> El foco de cada sprint fue claro:
> - **Sprint 1** — Autenticación, Usuarios/RBAC y Catálogos.
> - **Sprint 2** — Gestión de Pedidos, con estados y log histórico.
> - **Sprint 3** — Despacho, Hojas de Carga y Entregas.
> - **Sprint 4** — Dashboard, Reportes, Auditoría y despliegue.
>
> Como pueden notar, **cada sprint entregó un incremento funcional utilizable**. Paulo detalla ahora el equipo y los recursos.

*[Transición: Paulo.]*

---

## Diapositiva 13 — Recursos y Equipo  ⏱ 1:15 · **[P]**

> **[P]** El proyecto se ejecutó con un **equipo Scrum** organizado en los roles de **Scrum Master/Gerente de Proyecto, Desarrollador Backend, Desarrollador Frontend y QA/DevOps**.
>
> En cuanto a **recursos tecnológicos**, trabajamos con equipos de gama media con conectividad de 900 Mbps, y un stack profesional: **VS Code, Node.js 20 LTS, Docker Desktop, PostgreSQL 15, Prisma ORM 7**, control de versiones con **Git y GitHub**, y despliegue en **Railway.app**. Es un stack **actual y de nivel de industria**, no de laboratorio. Con el equipo y las herramientas definidas, veamos el cronograma.

*[Transición: misma persona.]*

---

## Diapositiva 14 — Cronograma (Diagrama de Gantt)  ⏱ 1:15 · **[P]**

> **[P]** Este **diagrama de Gantt** muestra la planificación temporal real del proyecto: los **cuatro sprints de dos semanas cada uno**, distribuidos a lo largo de las ocho semanas, de marzo a junio de 2026.
>
> Cada barra representa el trabajo de un sprint sobre el calendario, y como ven, la secuencia respeta las **dependencias**: primero seguridad y catálogos, porque todo lo demás depende de ellos; luego pedidos; después despacho; y al final reportes y despliegue. La planificación no fue improvisada: se cumplió en los plazos previstos. Ahora presento **qué** construimos en cada sprint: las historias de usuario.

*[Transición: misma persona.]*

---

## Diapositiva 15 — Historias de Usuario (Product Backlog)  ⏱ 2:00 · **[P]**

> **[P]** El **Product Backlog** se compone de **20 historias de usuario**, priorizadas con la técnica **MoSCoW**: **12 Must** (imprescindibles), **6 Should** (importantes) y **2 Could** (deseables).
>
> No voy a leerlas todas, pero sí quiero mostrar la lógica: las historias **Must** —como iniciar sesión, gestionar usuarios, registrar pedidos, armar hojas de carga y registrar entregas— son el **camino crítico** del negocio, y por eso se atendieron en los primeros sprints. Las **Should**, como el log histórico o la exportación a Excel, agregan valor y control. Y las **Could**, como la consulta de ubigeo o la configuración de la empresa, son mejoras de conveniencia.
>
> Cada historia tiene su **código, descripción, prioridad y sprint asignado**, y todas fueron gestionadas en un tablero digital. Gianpierre muestra cómo medimos el avance real de cada sprint.

*[Transición: Gianpierre.]*

---

## Diapositiva 16 — Burn Down Charts (4 Sprints)  ⏱ 1:45 · **[G]**

> **[G]** Como Scrum Master, uno de mis instrumentos de control fue el **Burn Down Chart** de cada sprint. Aquí están los cuatro.
>
> La lectura es simple: la **línea ideal** marca cómo debería descender el trabajo pendiente día a día, y la **línea real** muestra cómo descendió efectivamente. Cuando la línea real está sobre la ideal, vamos retrasados; cuando está por debajo, adelantados.
>
> Lo que estos cuatro gráficos evidencian es que **los cuatro sprints se completaron**, cerrando en cero el trabajo pendiente. Hubo variaciones —es normal—, pero **ningún sprint quedó inconcluso**. Esto no es una promesa: es la **medición objetiva** de que el plan se cumplió. Con el «qué» y el «cuánto» cubiertos, entramos al «cómo» técnico: la arquitectura.

*[Transición: misma persona.]*

---

## Diapositiva 17 — Arquitectura de Software  ⏱ 2:30 · **[G]**

> **[G]** La arquitectura de SIADLP es una **arquitectura web moderna en capas**, con separación clara de responsabilidades.
>
> - En el **Frontend**: **Next.js 16 con React 19**, TypeScript, Tailwind 4 y Zustand para el estado. Es la capa con la que interactúa el usuario.
> - En el **Backend**: **NestJS 11**, exponiendo una **API REST**, con **autenticación JWT, guards, RBAC y validación con class-validator**. Aquí vive toda la lógica de negocio y las reglas de seguridad.
> - Entre el backend y la base usamos **Prisma ORM 7**, con **migraciones versionadas**, lo que nos da tipado fuerte y control del esquema.
> - La **base de datos** es **PostgreSQL 15**, con **20 tablas relacionales**.
> - Y todo se **despliega en Railway.app**, contenerizado con **Docker**, sobre un **monorepo con pnpm workspaces**.
>
> ¿Por qué esta arquitectura? Porque **separa responsabilidades**: el frontend no toca la base directamente, todo pasa por la API, y la API valida seguridad en cada petición. Eso la hace **mantenible, segura y escalable**. Detengámonos ahora en el modelo de datos.

*[Transición: misma persona.]*

---

## Diapositiva 18 — Base de Datos: 20 Tablas  ⏱ 2:15 · **[G]**

> **[G]** El modelo de datos es un **esquema relacional normalizado en PostgreSQL**, con **20 tablas** organizadas por **dominios**:
>
> - **Seguridad y Acceso** — Usuario, Rol, Permiso, RolPermiso y SolicitudResetContrasena.
> - **Ubigeo** — Departamento, Provincia y Distrito, el catálogo geográfico del Perú.
> - **Catálogos** — Cliente, Producto, Ruta, Vehículo y Chofer.
> - **Operación** —el núcleo— Pedido, DetallePedido, EstadoPedidoLog, HojaCarga y Entrega.
> - **Soporte** — RegistroAuditoria y Empresa.
>
> Quiero resaltar dos tablas que reflejan calidad de diseño: **EstadoPedidoLog**, que guarda el historial completo de cada cambio de estado de un pedido —esa es la trazabilidad que el negocio no tenía—; y **RegistroAuditoria**, que registra automáticamente cada operación crítica. En total, **20 tablas** con sus claves primarias, foráneas, restricciones de unicidad e índices. El esquema está normalizado para **evitar redundancia y garantizar integridad**. Sobre ese modelo, veamos las consultas y reportes que entrega al usuario.

*[Transición: Paulo.]*

---

## Diapositiva 19 — Consultas y Reportes  ⏱ 1:30 · **[P]**

> **[P]** El valor de todos esos datos se materializa en información útil para decidir. SIADLP entrega un **dashboard ejecutivo en tiempo real** más **siete reportes operativos exportables a Excel**:
>
> Reporte de **Pedidos**, de **Despachos**, de **Novedades**, de **Entregas por Chofer**, por **Ruta**, por **Cliente**, y el reporte de **Auditoría**.
>
> Todos se generan **filtrados por rango de fechas** y se exportan a Excel con un clic. Esto responde directamente al problema inicial: **la gerencia pasó de no tener ningún indicador a contar con siete reportes y un tablero en vivo**. La información dejó de estar atrapada en cuadernos. Gianpierre explica cómo protegemos todo esto.

*[Transición: Gianpierre.]*

---

## Diapositiva 20 — Seguridad del Sistema  ⏱ 2:00 · **[G]**

> **[G]** La seguridad no fue un agregado final; fue un requisito de diseño. SIADLP implementa **varias capas**:
>
> - **Autenticación con JWT** y **contraseñas cifradas con bcrypt** —nunca se guardan en texto plano.
> - **Autorización RBAC**: permisos **granulares por módulo y acción**, validados por **guards globales** en cada petición. Un vendedor no puede acceder a lo que solo corresponde a un administrador.
> - **Rate limiting**, para protegernos de abusos y ataques de fuerza bruta.
> - **Recuperación de contraseña** mediante **tokens de un solo uso**.
> - **Validación estricta de entrada** con class-validator en cada DTO —nada entra sin ser validado.
> - Y **auditoría automática**: usuario, módulo, acción, IP y detalle de cada operación crítica.
>
> Estas capas trabajan juntas: **autenticar, autorizar, validar y registrar**. Con esto cubierto, pasamos a lo que más les interesa: ver el sistema funcionando.

*[Transición: ambos se ubican frente a la pantalla para la demostración.]*

---

## Diapositiva 21 — Demostración del Sistema  ⏱ 4:00 · **[G+P]**

> **[G]** *(introduce)* A continuación mostraremos el **sistema en producción**, desplegado en la nube. Recorreremos el flujo completo del negocio. Paulo conduce la interfaz y yo comento la lógica que ocurre por detrás.
>
> **1) Inicio de Sesión** — **[P]** *(muestra login)* Ingresamos con un usuario real. **[G]** Al autenticarse, el backend valida las credenciales, cifra la comparación con bcrypt y emite un **token JWT** que autoriza cada acción según el rol.
>
> **2) Dashboard Ejecutivo** — **[P]** Esta es la primera pantalla de la gerencia: indicadores del día en tiempo real. **[G]** Cada número que ven se calcula directamente sobre la base de datos; no hay planillas intermedias.
>
> **3) Registro de un Pedido** — **[P]** *(crea un pedido)* Seleccionamos cliente, fecha de entrega y agregamos el detalle de productos. **[G]** Al guardar, el pedido nace en estado **REGISTRADO** y se crea automáticamente su primer registro en el **log histórico de estados**.
>
> **4) Armado de la Hoja de Carga** — **[P]** El Jefe de Despacho agrupa los pedidos por ruta y asigna **vehículo y chofer**. **[G]** En ese momento, los pedidos transicionan a **DESPACHADO** de forma controlada por la máquina de estados.
>
> **5) Registro de la Entrega** — **[P]** El chofer confirma la entrega desde su dispositivo, o registra una novedad. **[G]** El sistema cierra el ciclo y actualiza el dashboard al instante.
>
> **6) Exportación de Reporte a Excel** — **[P]** *(exporta)* Finalmente, generamos un reporte filtrado por fechas y lo descargamos en Excel. **[G]** Y cada acción que acaban de ver quedó registrada en la **auditoría**: quién, qué, cuándo y desde dónde.
>
> **[G]** En menos de cuatro minutos recorrimos el proceso que antes vivía en cuadernos: **pedido, despacho, entrega y reporte**, con trazabilidad total. Paulo explica cómo garantizamos que esto funcione de forma confiable.

*[Transición: Paulo, QA.]*

*Nota: si la conexión falla, usar las capturas de esta misma diapositiva como respaldo y narrar el flujo igual.*

---

## Diapositiva 22 — Pruebas de Calidad de Software  ⏱ 2:00 · **[P]**

> **[P]** Como responsable de **QA**, quiero enfatizar que este sistema **no se entregó sin pruebas**. Aplicamos dos niveles complementarios.
>
> **Pruebas unitarias** —con **Jest**—: validan servicios y **reglas de negocio** de forma aislada; en particular, la **máquina de estados de los pedidos**, las validaciones de los DTOs y los permisos. Verifican que cada pieza, por separado, hace lo correcto.
>
> **Pruebas integrales (end-to-end)**: validan el **flujo completo** —pedido, despacho y entrega— y la **autenticación y autorización de punta a punta**, además de las **pruebas de aceptación por sprint**. Verifican que las piezas, **juntas**, funcionan.
>
> El resultado es una **suite automatizada** que se ejecuta ante cada cambio, lo que nos da confianza para evolucionar el sistema sin romper lo que ya funciona. Con la calidad asegurada, veamos el impacto.

*[Transición: misma persona.]*

---

## Diapositiva 23 — Resultados e Impacto  ⏱ 1:30 · **[P]**

> **[P]** ¿Y qué logramos, en concreto? El indicador que resume el impacto es una **reducción del 75 % en los tiempos** del proceso de distribución, seguimiento y control.
>
> Pero el impacto va más allá del tiempo:
> - **Eliminación total** de los registros manuales en papel.
> - **Trazabilidad completa** del ciclo pedido → despacho → entrega.
> - **Visibilidad gerencial en tiempo real** a través del dashboard.
> - Sistema **desplegado en producción** en la nube.
> - Proyecto **económicamente viable**, con relación B/C de 1.25.
> - Y los **10 objetivos específicos cumplidos al 100 %**.
>
> Es decir: **cada promesa del objetivo general se cumplió y se puede verificar**. Gianpierre cierra con las conclusiones.

*[Transición: Gianpierre.]*

---

## Diapositiva 24 — Conclusiones  ⏱ 1:45 · **[G]**

> **[G]** A modo de conclusión, cinco afirmaciones que sostenemos con evidencia:
>
> 1. **SIADLP automatizó el ciclo completo** pedido → despacho → entrega, **eliminando los registros manuales**.
> 2. La **gerencia obtuvo visibilidad en tiempo real** mediante el dashboard ejecutivo y siete reportes a Excel.
> 3. El **control de acceso RBAC y la auditoría automática** garantizan trazabilidad y seguridad de las operaciones.
> 4. El **sistema se desplegó en producción** en la nube, cumpliendo los **diez objetivos específicos**.
> 5. El **marco Scrum** permitió entregar valor de forma **incremental en cuatro sprints**.
>
> En síntesis: resolvimos un **problema real de negocio** con una **solución de software profesional, medible y en producción**. Paulo y yo cerramos con las recomendaciones.

*[Transición: ambos.]*

---

## Diapositiva 25 — Recomendaciones y Cierre  ⏱ 1:30 · **[G+P]**

> **[P]** Como todo sistema vivo, SIADLP tiene un camino de evolución. Recomendamos:
> - **Escalar** hacia compras, producción e inventario con kardex.
> - Incorporar **facturación electrónica con integración a SUNAT**.
>
> **[G]** Y en el plano operativo:
> - Desarrollar una **app móvil para choferes** con **rastreo GPS** de las unidades en ruta.
> - Integrar una **pasarela de pagos en línea** para los clientes.
>
> Estas recomendaciones retoman, de forma ordenada, aquello que dejamos fuera de alcance: son la **hoja de ruta natural** del producto.
>
> **[G+P]** *(juntos, mirando al jurado)* Con esto concluimos nuestra sustentación. **Agradecemos** al jurado por su tiempo y atención, y quedamos a su disposición para las preguntas que consideren pertinentes. **Muchas gracias.**

---

# Anexo — Banco de preguntas probables del jurado

*Preparen estas respuestas; son las preguntas más frecuentes en una defensa de este tipo.*

### Sobre negocio y metodología

**¿Por qué eligieron Scrum y no un modelo en cascada?**
Porque los requisitos de una operación logística evolucionan y necesitábamos entregar valor incremental y validar con el cliente en cada sprint. La cascada nos habría obligado a definir todo al inicio y arriesgar una única entrega final.

**¿Cómo calcularon el ahorro de S/ 17,112 y la relación B/C de 1.25?**
Estimamos los sobrecostos anuales de la operación manual (errores, re-despachos, reprocesos): S/ 20,400. Con el sistema se reducen a S/ 3,288. La diferencia es el ahorro (S/ 17,112). B/C = beneficio anual / costo de inversión (13,600), que da 1.25.

**¿Por qué el equipo del backlog indica 4 integrantes si sustentan dos?**
Los roles Scrum (Scrum Master, Backend, Frontend, QA/DevOps) fueron asumidos por los dos integrantes, cada uno cubriendo dos responsabilidades. Gianpierre: Scrum Master, Backend y liderazgo técnico; Paulo: Frontend y QA.

### Sobre arquitectura y datos

**¿Por qué PostgreSQL y no otra base de datos?**
Por ser relacional, robusto, de código abierto y con integridad referencial fuerte, ideal para un modelo transaccional normalizado como el nuestro. Prisma ORM nos dio tipado y migraciones versionadas sobre él.

**¿Cuántas tablas tiene el sistema y por qué esa cantidad?**
20 tablas, organizadas en cinco dominios: seguridad, ubigeo, catálogos, operación y soporte. La cantidad responde a la normalización: separamos entidades para evitar redundancia y garantizar integridad.

**¿Cómo garantizan la trazabilidad de un pedido?**
Con la tabla EstadoPedidoLog, que guarda cada cambio de estado con su fecha y responsable, y con RegistroAuditoria, que registra automáticamente toda operación crítica (usuario, módulo, acción, IP).

**¿Qué es RBAC y cómo lo implementaron?**
Control de Acceso Basado en Roles. Cada rol tiene permisos granulares por módulo y acción; guards globales en NestJS validan cada petición contra esos permisos antes de ejecutar la operación.

### Sobre seguridad y calidad

**¿Cómo protegen las contraseñas?**
Se almacenan cifradas con bcrypt (hash con salt); nunca en texto plano. La autenticación emite un token JWT firmado.

**¿Qué tipos de prueba realizaron y con qué herramientas?**
Pruebas unitarias con Jest (servicios, reglas de negocio, máquina de estados, validaciones) y pruebas integrales end-to-end del flujo completo y de autenticación/autorización, más pruebas de aceptación por sprint.

**¿Qué pasa si dos usuarios intentan despachar el mismo pedido?**
La máquina de estados solo permite transiciones válidas; una vez que un pedido pasa a DESPACHADO, no puede volver a tomarse. La lógica de estado en el backend evita la doble asignación.

### Sobre el alcance

**¿Por qué no incluyeron facturación o app móvil?**
Fueron decisiones de alcance conscientes para enfocarnos en el núcleo logístico con calidad. Ambas figuran como recomendaciones de evolución del producto.

**¿El sistema está realmente en producción?**
Sí, desplegado en Railway.app sobre la nube, contenerizado con Docker. La demostración se realizó sobre el entorno de producción.

---

*Consejos finales de exposición:* hablar pausado, mantener contacto visual, no dar la espalda al jurado, y ante una pregunta que no se sepa, responder con honestidad lo que sí se conoce y ofrecer fundamentar el resto. La seguridad se transmite: **ustedes construyeron el sistema, nadie lo conoce mejor.**
