# Guion de Sustentación — SIADLP

**Trabajo de Aplicación Profesional (TAP)**
Sistema Integrado de Administración y Distribución Logística de Papas — *La Cosecha S.A.C.*
IDAT — Lima, Perú · 2026

---

## Datos de la exposición

| | |
|---|---|
| **Integrantes** | Anthony Gianpierre Terrazas Tello · Paulo Cesar Wong Diaz |
| **Presentación** | `SIADLP_Presentacion_Defensa_v2.pptx` (29 diapositivas, estilo ejecutivo) |
| **Duración objetivo** | ~46 minutos (exposición) + preguntas del jurado |
| **Modalidad** | Dos expositores alternados, correlacionados con las diapositivas |

### Roles de expositor

| Rol | Integrante | Bloques que lidera |
|-----|-----------|--------------------|
| **Scrum Master · Backend · Líder Técnico** | **Gianpierre** | Resumen ejecutivo, negocio, problema y proceso actual, objetivos, factibilidad, metodología, evidencias Scrum, arquitectura, base de datos, seguridad, conclusiones |
| **Frontend · QA** | **Paulo** | Agenda, FODA, alcance, propuesta y proceso propuesto, recursos, cronograma, backlog, reportes, pruebas, resultados |

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
| 3 | Resumen Ejecutivo | G | 1:30 | 3:45 |
| 4 | La Empresa | G | 1:30 | 5:15 |
| 5 | Análisis FODA | P | 1:45 | 7:00 |
| 6 | Identificación del Problema | G | 1:45 | 8:45 |
| 7 | El Proceso Actual (AS-IS) | G | 1:45 | 10:30 |
| 8 | Objetivo General | G | 1:15 | 11:45 |
| 9 | Objetivos Específicos | G | 1:45 | 13:30 |
| 10 | Alcance — Módulos | P | 1:30 | 15:00 |
| 11 | Fuera de Alcance | P | 1:00 | 16:00 |
| 12 | Propuesta SIADLP | P | 1:30 | 17:30 |
| 13 | El Proceso Propuesto (TO-BE) | P | 1:45 | 19:15 |
| 14 | Factibilidad Económica | G | 2:00 | 21:15 |
| 15 | Metodología Scrum | G | 1:45 | 23:00 |
| 16 | Recursos y Equipo | P | 1:00 | 24:00 |
| 17 | Cronograma (Gantt) | P | 1:15 | 25:15 |
| 18 | Product Backlog + MoSCoW | P | 1:45 | 27:00 |
| 19 | Scrum en Acción (tableros) | G | 1:30 | 28:30 |
| 20 | Burn Down Charts | G | 1:30 | 30:00 |
| 21 | Arquitectura de Software | G | 2:00 | 32:00 |
| 22 | Base de Datos — Modelo ER | G | 2:00 | 34:00 |
| 23 | Consultas y Reportes | P | 1:15 | 35:15 |
| 24 | Seguridad del Sistema | G | 1:45 | 37:00 |
| 25 | Demostración del Sistema | G+P | 4:00 | 41:00 |
| 26 | Pruebas de Calidad | P | 1:30 | 42:30 |
| 27 | Resultados e Impacto | P | 1:15 | 43:45 |
| 28 | Conclusiones | G | 1:30 | 45:15 |
| 29 | Recomendaciones + Cierre | G+P | 1:30 | 46:45 |

**Total estimado: ~46 min 45 s** (sin contar el turno de preguntas).

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

*[Transición: Paulo presenta la agenda.]*

---

## Diapositiva 2 — Agenda  ⏱ 0:45 · **[P]**

> **[P]** Gracias, Gianpierre. Buenos días, señores del jurado.
> Nuestra exposición sigue diez puntos: la **empresa y el problema**; el **proceso actual y el propuesto** — el antes y el después—; los **objetivos y el alcance**; la **propuesta SIADLP**; su **factibilidad económica**; la **metodología Scrum con sus evidencias**; la **arquitectura y base de datos**; la **seguridad y calidad de software**; la **demostración del sistema en producción**; y cerramos con **resultados, conclusiones y recomendaciones**.
>
> Y para que conozcan el destino antes del viaje, Gianpierre abre con el resumen ejecutivo.

*[Transición: Gianpierre.]*

---

## Diapositiva 3 — Resumen Ejecutivo  ⏱ 1:30 · **[G]**

> **[G]** Señores del jurado, este es **el proyecto en treinta segundos** — cuatro cifras que luego sustentaremos una por una:
>
> - **Relación Beneficio/Costo de 1.25**, con recuperación de la inversión en menos de diez meses: el proyecto es económicamente viable.
> - **75 % de reducción** en los tiempos de distribución y control.
> - **20 historias de usuario entregadas** en 4 sprints, en solo 8 semanas.
> - Y el dato más importante: el sistema está **EN VIVO**, en producción, en la nube.
>
> En una frase: SIADLP digitalizó el ciclo completo pedido → despacho → entrega de La Cosecha S.A.C., eliminando los registros manuales y dando a la gerencia visibilidad en tiempo real. Todo lo que sigue es la evidencia de estas afirmaciones. Empecemos por conocer a la empresa.

*[Transición: misma persona.]*

---

## Diapositiva 4 — La Empresa  ⏱ 1:30 · **[G]**

> **[G]** **La Cosecha S.A.C.** es una empresa peruana dedicada a la comercialización y **distribución mayorista de papa**, atendiendo a **pollerías y negocios gastronómicos de Lima Metropolitana**.
>
> Su operación diaria: recibir pedidos, armar la carga por ruta y repartir en unidades de transporte. Es un negocio de alto volumen y baja tolerancia al error: si un pedido llega tarde o incompleto, la pollería se queda sin insumo en plena jornada.
>
> Y noten la tarjeta resaltada en color distinto —el **reto**—: toda esa operación se manejaba de forma **100 % manual, sin trazabilidad ni visibilidad**. Ese es el terreno del que nace este proyecto. Paulo presenta el diagnóstico estratégico.

*[Transición: Paulo.]*

---

## Diapositiva 5 — Análisis FODA  ⏱ 1:45 · **[P]**

> **[P]** Para entender el punto de partida realizamos un **análisis FODA** de la operación logística.
>
> En las **Fortalezas**: cartera de clientes fidelizada y experiencia en el rubro. En las **Oportunidades**: la digitalización creciente del sector y la posibilidad de diferenciarse por servicio.
>
> Lo determinante está en las **Debilidades** y **Amenazas**: procesos manuales propensos a error, ausencia total de trazabilidad, y el riesgo de perder clientes frente a distribuidores más ordenados.
>
> El cruce nos dio la estrategia: **convertir las debilidades internas en fortalezas mediante la digitalización del proceso**. Con ese diagnóstico, Gianpierre precisa el problema central.

*[Transición: Gianpierre.]*

---

## Diapositiva 6 — Identificación del Problema  ⏱ 1:45 · **[G]**

> **[G]** El **problema central**: *la gestión manual de pedidos y distribución genera errores, re-despachos y nula visibilidad operativa en tiempo real.*
>
> Las cinco tarjetas lo descomponen en causas concretas: **registros dispersos** en cuadernos y hojas de cálculo; **errores y duplicidad** que derivan en re-despachos y reclamos; **cero trazabilidad** —nadie sabe quién hizo qué—; **asignación informal** de vehículos y choferes; y una **gerencia a ciegas**, sin indicadores para decidir.
>
> Y fíjense en la cifra de la esquina: este problema le cuesta a la empresa **S/ 20,400 al año**. No es un problema teórico; es un problema con precio. Para verlo con total claridad, veamos el proceso completo tal como operaba.

*[Transición: misma persona.]*

---

## Diapositiva 7 — El Proceso Actual (AS-IS)  ⏱ 1:45 · **[G]**

> **[G]** Este es el **proceso AS-IS** — el flujo real de la operación manual, de punta a punta:
>
> El pedido entra **por teléfono o WhatsApp y se anota en un cuaderno**; luego alguien lo **re-digita** en hojas de cálculo dispersas; la carga se arma **“de memoria”**, sin control de rutas; el reparto sale **sin registro** de entregas ni novedades; y la gerencia, al final de la cadena, queda **sin indicadores**.
>
> Debajo de cada paso están sus consecuencias, en rojo: errores de transcripción, duplicidad, re-despachos, cero trazabilidad y ceguera del negocio. **Cada eslabón manual agrega su propio punto de falla.** Este diagrama ES el problema. Y contra este diagrama van a comparar, en unos minutos, el proceso propuesto. Antes, formalicemos qué nos propusimos lograr.

*[Transición: misma persona.]*

---

## Diapositiva 8 — Objetivo General  ⏱ 1:15 · **[G]**

> **[G]** Nuestro **objetivo general**: **desarrollar e implementar un sistema de información web para La Cosecha S.A.C. que automatice y digitalice los procesos de gestión de pedidos y distribución logística**, eliminando los registros manuales y proporcionando **visibilidad en tiempo real**.
>
> Como indica la línea inferior, son **tres promesas verificables**: automatizar, eliminar lo manual y dar visibilidad. Las tres se demuestran hoy. El objetivo se desglosa en diez objetivos específicos.

*[Transición: misma persona.]*

---

## Diapositiva 9 — Objetivos Específicos  ⏱ 1:45 · **[G]**

> **[G]** Los **diez objetivos específicos**; cada uno se convirtió en un **módulo verificable** del sistema:
>
> - **OE-01 y OE-02** — seguridad de acceso con **RBAC** y catálogos maestros.
> - **OE-03** — el corazón operativo: **pedidos con máquina de estados y log histórico**.
> - **OE-04 y OE-05** — **despacho** y **registro de entregas en campo**.
> - **OE-06 y OE-07** — **dashboard ejecutivo** y **reportes a Excel**.
> - **OE-08** — **auditoría automática** de operaciones críticas.
> - **OE-09 y OE-10** — **despliegue en producción** y **capacitación y documentación**.
>
> Ningún objetivo quedó en el papel: los diez están implementados y desplegados. Paulo detalla el alcance.

*[Transición: Paulo.]*

---

## Diapositiva 10 — Alcance: Módulos del Sistema  ⏱ 1:30 · **[P]**

> **[P]** El alcance se materializa en **nueve módulos funcionales**: **Autenticación** con JWT y rate limiting; **Usuarios y Roles** con RBAC granular; los **Catálogos** de clientes, productos, rutas, vehículos y choferes; **Pedidos** con estados y log; **Despacho** con hojas de carga; **Entregas en campo**; **Reportes y Dashboard**; **Auditoría**; y **Empresa y Ubigeo** con el catálogo geográfico del Perú.
>
> Estos módulos cubren el **flujo completo del negocio, de punta a punta**. No es un prototipo parcial. Pero un buen proyecto también sabe decir «no»:

*[Transición: misma persona.]*

---

## Diapositiva 11 — Fuera de Alcance  ⏱ 1:00 · **[P]**

> **[P]** Definimos explícitamente **fuera de alcance**: compras a proveedores, producción con rendimiento y merma, inventario y kardex, precios y cobranza, facturación electrónica con SUNAT, app móvil nativa, rastreo GPS y pasarela de pagos.
>
> ¿Por qué? Para resolver el **núcleo logístico con calidad**, sin dispersarnos. Son **decisiones de alcance conscientes** — y como indica la nota, varias reaparecen al final como recomendaciones de evolución. Con el alcance claro, la propuesta.

*[Transición: misma persona.]*

---

## Diapositiva 12 — Propuesta de Solución: SIADLP  ⏱ 1:30 · **[P]**

> **[P]** Nuestra propuesta es **SIADLP: Sistema Integrado de Administración y Distribución Logística de Papas**.
>
> El esquema resume su esencia: una aplicación web que digitaliza el ciclo completo **Pedido → Despacho → Asignación de vehículo y chofer → Entrega en campo → Reportes y Auditoría**. Cada flecha es una transición **controlada por el sistema**, no por un cuaderno.
>
> La idea fuerza: **una sola fuente de verdad** — cada operación queda registrada, auditada y visible desde el dashboard. ¿Y cómo se ve ese proceso digitalizado, rol por rol? Exactamente así:

*[Transición: misma persona.]*

---

## Diapositiva 13 — El Proceso Propuesto (TO-BE)  ⏱ 1:45 · **[P]**

> **[P]** Este es el **proceso TO-BE** — el mismo negocio, ahora dentro de SIADLP, organizado por **carriles de responsabilidad**:
>
> - El **Vendedor** registra el pedido con cliente y detalle → el sistema lo pone en estado **REGISTRADO**.
> - El **Jefe de Despacho** arma la hoja de carga, agrupa por ruta y asigna vehículo y chofer → estado **DESPACHADO**.
> - El **Chofer** confirma la entrega o registra la novedad en campo → estado **ENTREGADO**.
> - Y la **Gerencia** decide con el dashboard en vivo y los siete reportes a Excel.
>
> Comparen mentalmente este diagrama con el AS-IS de hace unos minutos: donde había cuadernos y llamadas, ahora hay **estados controlados por una máquina de estados y roles con permisos**. Esa es la transformación. Y como toda propuesta seria, se sostiene con números — Gianpierre.

*[Transición: Gianpierre.]*

---

## Diapositiva 14 — Factibilidad Económica  ⏱ 2:00 · **[G]**

> **[G]** Un sistema no se justifica por moderno; se justifica porque **conviene**. Los números:
>
> **Inversión inicial: S/ 13,600** — 320 horas-persona. **Ahorro anual: S/ 17,112**. ¿De dónde sale? De la tabla: sin sistema, las pérdidas anuales por errores, re-despachos y reprocesos eran **S/ 20,400**; con el sistema bajan a **S/ 3,288**.
>
> Esto da una **relación Beneficio/Costo de 1.25** —mayor a 1— y **recuperación en menos de diez meses**. Por cada sol invertido, la empresa recibe 1.25 soles de retorno. Con la viabilidad demostrada, veamos **cómo** lo construimos.

*[Transición: misma persona.]*

---

## Diapositiva 15 — Metodología: Scrum  ⏱ 1:45 · **[G]**

> **[G]** Adoptamos el marco ágil **Scrum**, por una razón directa: necesitábamos **entregar valor incremental** y ajustar en cada iteración, en lugar de apostar todo a una entrega final.
>
> El proyecto se organizó en **cuatro fases** —Inicio, Planificación, Ejecución, y Transición y Cierre— con la ejecución dividida en **4 sprints a lo largo de 8 semanas**, de marzo a junio de 2026:
>
> - **Sprint 1** — Autenticación, Usuarios/RBAC y Catálogos.
> - **Sprint 2** — Gestión de Pedidos.
> - **Sprint 3** — Despacho, Hojas de Carga y Entregas.
> - **Sprint 4** — Dashboard, Reportes, Auditoría y despliegue.
>
> Cada sprint entregó un **incremento funcional utilizable**. Paulo presenta el equipo y los recursos.

*[Transición: Paulo.]*

---

## Diapositiva 16 — Recursos y Equipo  ⏱ 1:00 · **[P]**

> **[P]** El **equipo Scrum** se organizó en cuatro roles: Scrum Master/Gerente de Proyecto, Desarrollador Backend, Desarrollador Frontend y QA/DevOps — asumidos por nosotros dos, cada uno cubriendo dos responsabilidades.
>
> Los **recursos tecnológicos**: equipos Core i5 con Internet de 900 Mbps, VS Code, Node.js 20 LTS, Docker, **PostgreSQL 15 con Prisma ORM 7**, Git y GitHub, y despliegue en **Railway.app**. Stack **actual y de nivel de industria**. Veamos el cronograma.

*[Transición: misma persona.]*

---

## Diapositiva 17 — Cronograma (Diagrama de Gantt)  ⏱ 1:15 · **[P]**

> **[P]** El **diagrama de Gantt** muestra la planificación temporal real: **cuatro sprints de dos semanas**, distribuidos en ocho semanas, de marzo a junio de 2026.
>
> La secuencia respeta las **dependencias técnicas**: primero seguridad y catálogos —porque todo lo demás depende de ellos—, luego pedidos, después despacho, y al final reportes y despliegue. La planificación **se cumplió en los plazos previstos**. Ahora, el «qué»: las historias de usuario.

*[Transición: misma persona.]*

---

## Diapositiva 18 — Product Backlog + MoSCoW  ⏱ 1:45 · **[P]**

> **[P]** Este es el **Product Backlog real** del proyecto: **20 historias de usuario, priorizadas y estimadas** — en total **117 story points**.
>
> A la derecha ven la priorización **MoSCoW**: **12 Must** —imprescindibles—, **6 Should** —importantes— y **2 Could** —deseables. Las **Must**, como iniciar sesión, registrar pedidos, armar hojas de carga y registrar entregas, son el **camino crítico del negocio** y se atendieron primero. Cada historia tiene su código, descripción, prioridad y estimación.
>
> ¿Y cómo se gestionó este backlog día a día? Gianpierre, como Scrum Master, lo muestra.

*[Transición: Gianpierre.]*

---

## Diapositiva 19 — Scrum en Acción  ⏱ 1:30 · **[G]**

> **[G]** Como Scrum Master, gestioné el trabajo en **tableros digitales**. Aquí ven dos de ellos: el **Scrum Board del Sprint 1** y el del **Sprint 4**.
>
> Cada fila es una historia de usuario y sus tareas fluyen por las columnas **Por Hacer → Proceso → Pruebas → Terminado**. Lo que quiero que noten es la columna final: **todas las tareas de los cuatro sprints cerraron en «Terminado»**.
>
> Esto no es una diapositiva de teoría de Scrum: es la **evidencia operativa** de que el marco se aplicó de verdad, tarea por tarea. Y la medición cuantitativa de ese avance está en los Burn Down.

*[Transición: misma persona.]*

---

## Diapositiva 20 — Burn Down Charts  ⏱ 1:30 · **[G]**

> **[G]** Los **Burn Down Charts** de los cuatro sprints. La lectura: la **línea ideal** marca cómo debería descender el trabajo pendiente; la **línea real**, cómo descendió efectivamente.
>
> Hubo variaciones —es normal en cualquier proyecto real—, pero los cuatro gráficos terminan igual: **en cero**. Los cuatro sprints se completaron; ninguno quedó inconcluso. Es la **medición objetiva** del cumplimiento del plan. Con el «qué» y el «cuánto» cubiertos, entramos al «cómo» técnico.

*[Transición: misma persona.]*

---

## Diapositiva 21 — Arquitectura de Software  ⏱ 2:00 · **[G]**

> **[G]** Esta es la **arquitectura real** del sistema, en capas con separación clara de responsabilidades:
>
> - **Frontend**: Next.js 16 con React 19, TypeScript y Tailwind — la capa del usuario.
> - **Backend**: NestJS 11 exponiendo una **API REST** con JWT, guards, RBAC y validación — aquí vive toda la lógica de negocio.
> - **Prisma ORM 7** con migraciones versionadas conecta con la base.
> - **PostgreSQL 15** con sus **20 tablas relacionales**.
> - Y el despliegue en **Railway.app**, contenerizado con Docker.
>
> ¿Por qué así? Porque el frontend **nunca toca la base directamente**: todo pasa por la API, y la API valida seguridad en cada petición. Eso hace al sistema **mantenible, seguro y escalable**. Bajemos un nivel más: el modelo de datos.

*[Transición: misma persona.]*

---

## Diapositiva 22 — Base de Datos: Modelo ER  ⏱ 2:00 · **[G]**

> **[G]** El **modelo entidad-relación completo**: **20 tablas** en PostgreSQL, con **cardinalidades en notación pata de gallo** — la leyenda está en el propio diagrama: el trazo simple es «uno», el trazo en abanico es «muchos».
>
> Los colores agrupan los **dominios**: seguridad y acceso —Usuario, Rol, Permiso—, el ubigeo del Perú, los catálogos, y el **núcleo operativo**: Pedido, DetallePedido, **EstadoPedidoLog**, HojaCarga y Entrega.
>
> Dos tablas concentran la calidad del diseño: **EstadoPedidoLog**, que guarda el historial completo de cada cambio de estado —esa es la trazabilidad que el negocio no tenía—, y **RegistroAuditoria**, que registra automáticamente toda operación crítica. Esquema **normalizado**: sin redundancia, con integridad garantizada. Paulo muestra qué información entrega este modelo.

*[Transición: Paulo.]*

---

## Diapositiva 23 — Consultas y Reportes  ⏱ 1:15 · **[P]**

> **[P]** Todos esos datos se convierten en decisiones mediante el **dashboard ejecutivo en tiempo real** y **siete reportes exportables a Excel**: Pedidos, Despachos, Novedades, Entregas por Chofer, por Ruta, por Cliente y Auditoría — todos filtrables por rango de fechas.
>
> Esto responde directamente al problema inicial: la gerencia pasó de **cero indicadores** a **siete reportes y un tablero en vivo**. Gianpierre explica cómo protegemos todo esto.

*[Transición: Gianpierre.]*

---

## Diapositiva 24 — Seguridad del Sistema  ⏱ 1:45 · **[G]**

> **[G]** La seguridad fue un **requisito de diseño**, no un agregado. Seis capas, como muestran las tarjetas:
>
> **Autenticación** con JWT y contraseñas cifradas con bcrypt —nunca texto plano—; **autorización RBAC** granular por módulo y acción, validada por guards en cada petición; **rate limiting** contra fuerza bruta; **recuperación de contraseña** con tokens de un solo uso; **validación estricta** de toda entrada con class-validator; y **auditoría automática** de usuario, módulo, acción, IP y detalle.
>
> Autenticar, autorizar, validar y registrar — capas que trabajan juntas. Y ahora sí: el sistema funcionando.

*[Transición: ambos se ubican frente a la pantalla para la demostración.]*

---

## Diapositiva 25 — Demostración del Sistema  ⏱ 4:00 · **[G+P]**

> **[G]** *(introduce)* Mostraremos el **sistema en producción**, en la nube. Paulo conduce la interfaz; yo comento la lógica que ocurre por detrás.
>
> **1) Inicio de Sesión** — **[P]** *(muestra login)* Ingresamos con un usuario real. **[G]** El backend valida las credenciales con bcrypt y emite un **token JWT** que autoriza cada acción según el rol.
>
> **2) Dashboard Ejecutivo** — **[P]** La primera pantalla de la gerencia: indicadores del día en tiempo real. **[G]** Cada número se calcula sobre la base de datos; no hay planillas intermedias.
>
> **3) Registro de un Pedido** — **[P]** *(crea un pedido)* Cliente, fecha de entrega y detalle de productos. **[G]** Al guardar, el pedido nace **REGISTRADO** y se crea su primer registro en el log histórico.
>
> **4) Hoja de Carga** — **[P]** El Jefe de Despacho agrupa por ruta y asigna **vehículo y chofer**. **[G]** Los pedidos transicionan a **DESPACHADO**, controlados por la máquina de estados.
>
> **5) Registro de la Entrega** — **[P]** El chofer confirma la entrega o registra una novedad. **[G]** El ciclo se cierra y el dashboard se actualiza al instante.
>
> **6) Reporte a Excel** — **[P]** *(exporta)* Un reporte filtrado por fechas, descargado en Excel. **[G]** Y todo lo que acaban de ver quedó en la **auditoría**: quién, qué, cuándo y desde dónde.
>
> **[G]** En cuatro minutos recorrimos el proceso que antes vivía en cuadernos — exactamente el diagrama TO-BE que les mostramos, funcionando en vivo. Paulo explica cómo garantizamos su confiabilidad.

*[Transición: Paulo, QA.]*

*Nota: si la conexión falla, usar las capturas de esta misma diapositiva como respaldo y narrar el flujo igual.*

---

## Diapositiva 26 — Pruebas de Calidad de Software  ⏱ 1:30 · **[P]**

> **[P]** Como responsable de **QA**: este sistema **no se entregó sin pruebas**. Dos niveles complementarios:
>
> **Pruebas unitarias** con **Jest**: validan servicios, reglas de negocio, la **máquina de estados de los pedidos**, DTOs y permisos — cada pieza por separado.
>
> **Pruebas integrales end-to-end**: el flujo completo pedido → despacho → entrega, la autenticación y autorización de punta a punta, y las pruebas de aceptación por sprint — las piezas **juntas**.
>
> Una **suite automatizada** que corre ante cada cambio: confianza para evolucionar sin romper lo que funciona. Con la calidad asegurada, el impacto.

*[Transición: misma persona.]*

---

## Diapositiva 27 — Resultados e Impacto  ⏱ 1:15 · **[P]**

> **[P]** El indicador que resume todo: **75 % de reducción en los tiempos** de distribución, seguimiento y control.
>
> Y la lista de la derecha: **cero registros manuales**, **trazabilidad completa del ciclo**, **visibilidad gerencial en tiempo real**, sistema **en producción**, relación **B/C de 1.25**, y los **diez objetivos cumplidos al 100 %**.
>
> Cada promesa del objetivo general **se cumplió y es verificable**. Gianpierre cierra con las conclusiones.

*[Transición: Gianpierre.]*

---

## Diapositiva 28 — Conclusiones  ⏱ 1:30 · **[G]**

> **[G]** Cinco conclusiones, cada una con su evidencia:
>
> 1. **Automatización total** — el ciclo pedido → despacho → entrega opera sin registros manuales.
> 2. **Visibilidad gerencial** — dashboard en tiempo real y siete reportes a Excel.
> 3. **Trazabilidad y seguridad** — RBAC granular y auditoría automática.
> 4. **Sistema en producción** — desplegado en la nube, con los diez objetivos cumplidos.
> 5. **Valor incremental** — Scrum con cuatro sprints y entregas funcionales cada dos semanas.
>
> En síntesis: un **problema real de negocio**, resuelto con una **solución profesional, medible y en producción**. Cerramos con las recomendaciones.

*[Transición: ambos.]*

---

## Diapositiva 29 — Recomendaciones y Cierre  ⏱ 1:30 · **[G+P]**

> **[P]** SIADLP tiene un camino natural de evolución: **escalar hacia compras, producción e inventario con kardex**, e incorporar **facturación electrónica con SUNAT**.
>
> **[G]** Y en el plano operativo: una **app móvil para choferes con rastreo GPS**, y una **pasarela de pagos en línea**. Estas recomendaciones retoman, de forma ordenada, lo que delimitamos fuera de alcance: son la **hoja de ruta del producto**.
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

**¿Por qué el equipo indica 4 roles si sustentan dos personas?**
Los roles Scrum (Scrum Master, Backend, Frontend, QA/DevOps) fueron asumidos por los dos integrantes, cada uno cubriendo dos responsabilidades. Gianpierre: Scrum Master, Backend y liderazgo técnico; Paulo: Frontend y QA.

**¿Qué diferencia hay entre el proceso AS-IS y el TO-BE?**
El AS-IS es el proceso manual real que encontramos (cuaderno, re-digitación, armado de memoria, reparto sin registro); el TO-BE es el proceso digitalizado dentro de SIADLP, con roles, estados controlados (REGISTRADO → DESPACHADO → ENTREGADO) y trazabilidad total.

### Sobre arquitectura y datos

**¿Por qué PostgreSQL y no otra base de datos?**
Por ser relacional, robusto, de código abierto y con integridad referencial fuerte, ideal para un modelo transaccional normalizado. Prisma ORM aporta tipado y migraciones versionadas.

**¿Cuántas tablas tiene el sistema y por qué esa cantidad?**
20 tablas, organizadas en cinco dominios: seguridad, ubigeo, catálogos, operación y soporte. La cantidad responde a la normalización: separamos entidades para evitar redundancia y garantizar integridad.

**¿Qué significa la notación «pata de gallo» del diagrama ER?**
Es la notación de cardinalidades crow's foot: el trazo simple representa «uno» y el trazo en abanico (tres líneas) representa «muchos». Toda relación se lee: un padre — N hijos.

**¿Cómo garantizan la trazabilidad de un pedido?**
Con la tabla EstadoPedidoLog, que guarda cada cambio de estado con fecha y responsable, y con RegistroAuditoria, que registra automáticamente toda operación crítica (usuario, módulo, acción, IP).

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
