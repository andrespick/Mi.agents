# Verificación del router — 14 de octubre de 2026

Versiones comprobadas: OpenCode 2.0.29; Swarm 7.197.1, fuente `b94acae84ddd750a4aa50d455cb123fa5ed50cb4`. Bundle original SHA-256 `8e3397ce13f461b47aed43a018f1bfe2a3129428488386eda70e5d679d1457c9`.

## Evidencia

- 30 pruebas Node: política de calidad 3/3/2, separación de fallos técnicos, OAuth real frente a clave API, selección concurrente por sesión, estado con bloqueo entre instancias, fallback en la misma sesión, cancelación, recuperación y compatibilidad ejecutando funciones reales del bundle Swarm.
- 23 pruebas Python: biblioteca previa (16) e instalador del router (7), conservación de configuración ajena, colisiones, backup/restauración exacta y espera de carga asíncrona nativa.
- Plugin `mi-opencode-router` confirmado activo mediante `plugin.list`; agentes de Swarm y comando `/router` registrados.
- Sesión real `consulta-01`: clasificación y respuesta de consulta.
- Sesión real `coordinacion-01`: payload de clasificador `gpt-6-luna` / `none`, selección complex y payload posterior `gpt-6.1-sol` / `high`.
- Sesión real con entrada privada corregida `compatibilidad-01`: clasificación query con `readOnly:true`, respuesta `ROUTER_LISTO`. `/router status` ejecutado nativamente sin otra generación.

## Revisión independiente y correcciones

Una revisión de código independiente reprodujo cinco problemas. Se corrigieron y se añadieron regresiones:

| Problema reproducido | Corrección verificada |
|---|---|
| «Read-only» de un reviewer congelaba al arquitecto | Solo las órdenes raíz pueden establecer restricción global |
| El shim Swarm negaba también herramientas con valor `true` | Entrada privada conserva `true` y solo deniega `false`; prueba con funciones reales |
| Error anterior de Haiku ocultaba éxito posterior de Luna | Éxito terminal del turno actual domina el error antiguo; terminales anteriores no validan el turno nuevo |
| Una herramienta abortada convertía cancelación en pausa reanudable | Cancelación condicional y conservación del estado terminal |
| Un evento idle de un hijo eliminado detenía todo el monitor | Errores aislados por evento; sesiones eliminadas se marcan terminales |

También se verificó que una finalización del estado anterior no escriba sobre una ejecución nueva: los bindings y operaciones llevan epoch. La revisión posterior de confirmación del mismo revisor no pudo ejecutarse por su límite de uso; la comprobación de las correcciones se hizo con las regresiones y la carga nativa descritas arriba. No se afirma una segunda aprobación independiente.

## Decisiones y límites

- Extensión envolvente y entrada privada derivada, en vez de editar el paquete original o la caché. Cuatro sustituciones se aplican únicamente a un hash exacto. Coste de mantenimiento: revisar esta adaptación al actualizar Swarm.
- Autorización OAuth comprobada al enviar, porque la suscripción moderna también usa `api.openai.com`. Un refresh concurrente puede producir una pausa segura; nunca una alternativa por clave API.
- Estado compartido ignorado por Git con bloqueo entre procesos: los worktrees necesitan compartir circuito y cancelación. Una contención persistente produce un error, no una actualización sin bloqueo.
- Clasificación obligatoria en el payload HTTP: esta versión no conservó el `tool_choice` del agente en la prueba nativa. Si falta la herramienta, se bloquea antes de responder sin ruta.
- Integración local en la biblioteca canónica para completar la instalación aprobada. No se publicó un fork ni se enviaron estos commits al remoto.
- No se agotó saldo real de Haiku ni se desarrolló una feature completa con tres LLM reales. Cuota y fallos QA se verifican mediante pruebas controladas. La semántica de planes y revisiones depende del modelo; el alcance de los controles está en el README.

No quedan hallazgos menores aplazados de esa revisión. Las limitaciones de validación anteriores se conservan expresamente.

## Instalación definitiva

El plugin se instala desde `~/.agents/opencode/router/index.js`. Se ejecutaron las 53 pruebas sobre la biblioteca canónica. OpenCode tiene `mi-router` como agente predeterminado; se recomienda iniciar una sesión nueva.

Las rutas concretas de los backups y el historial de instalación se conservan en notas locales bajo `.local/`, fuera de Git. Para restaurar, utiliza el backup que mostró el instalador y consulta la guía del router.
