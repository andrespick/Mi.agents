# Mi.router para OpenCode

Extensión local de **OpenCode 2.0.29** que envuelve **opencode-swarm 7.197.1** (MIT). Codex no usa esta extensión. Conserva intactos la entrada original del paquete y la caché npm; genera una entrada privada con correcciones V2 versionadas y comprobadas.

`src/swarm-compat.mjs` exige versión y SHA-256 exactos del bundle publicado antes de generar `dist/index.mi-router.mjs` en la dependencia local de esta biblioteca. Corrige cuatro expresiones: los dos traductores de herramientas solo niegan valores `false`; un éxito terminal del turno actual domina un error anterior; y el terminal se busca después del último mensaje de usuario. Hay pruebas ejecutando esas funciones reales. El instalador prepara y valida esta entrada antes de activar la configuración; se regenera tras `npm ci`. Cambiar la versión de Swarm requiere revisar esta adaptación. Su licencia MIT permanece junto al paquete.

## Usarlo

Abre una sesión nueva con `opencode` dentro de tu proyecto. `mi-router` es la entrada predeterminada: escribe la petición normalmente. Si una sesión anterior mantiene otro agente, selecciona `mi-router` o abre una nueva.

| Trabajo | Modelo / esfuerzo |
|---|---|
| Clasificar | GPT-6 Luna none; segunda pasada low si hay ambigüedad |
| Pregunta | Luna none, agente mi-answer |
| Cambio pequeño | Luna high, agente mi-worker, sin SDD obligatorio |
| Planificar desarrollo sustancial | GPT-6.1 Sol high, architect de Swarm |
| Trabajadores | Luna high y Claude Haiku 5.5 high, reparto determinista por tarea |
| Revisión independiente | Sol high |
| Pruebas | Sol medium |
| Escalado de una tarea | Tres resultados QA fallidos → Sol high; tres más → Astra high; dos más → pausa |

Son **intento inicial + dos correcciones** en el primer nivel. Cambiar Luna/Haiku no borra fallos. Solo cuentan fallos de Stage A/B registrados por Swarm, una vez por generación; un rojo TDD intencional, un baseline conocido o un error del proveedor no deben registrarse como un rechazo QA de implementación.

El arquitecto usa el plan y las puertas de Swarm. Las tareas independientes se ejecutan con `lean_turbo_run_phase`, hasta tres coders con ámbito declarado y worktrees aislados. Dependencias y archivos compartidos se serializan. `parallelization.enabled` no se usa: esa opción de esta versión de Swarm todavía no ejecuta trabajadores. `turbo_mode` permanece desactivado para conservar puertas; la estrategia Lean se configura por separado. La ejecución paralela requiere Git y un árbol limpio cuando Swarm lo exige; sus bloqueos/conflictos se informan, no se eluden.

## Conexiones y gastos

OpenAI queda ligado al ID local de la credencial **OAuth de suscripción**. Antes de enviar cada solicitud HTTP se compara su autorización real con esa credencial. También se comprueban la URL y los sockets; se usa HTTP por defecto. La suscripción moderna usa `api.openai.com/v1` con OAuth: ese dominio no implica por sí mismo facturación mediante clave API. Cambiar a la conexión OpenAI API provoca un bloqueo; no se usa como alternativa. Requiere que el plugin esté cargado y activo.

Anthropic solo admite `claude-haiku-5-5` mediante la conexión API fijada. Saldo/cuota/rate limit de Haiku abre su circuito durante la ejecución y continúa la misma sesión pendiente en Luna high. Los trabajadores aún no iniciados también usan Luna. No hay alternativa Sonnet/Opus. Si falta la conexión Haiku, se usa Luna; si falla la suscripción, se pausa.

Los IDs de conexión se guardan en `.local/binding.json`, ignorado por Git. **No se copian tokens ni claves al repositorio, estado o trazas.** Los registros conservan modelo/esfuerzo, decisiones, tareas y evidencias. El guard lee credenciales únicamente en memoria para comprobarlas.

Los límites predeterminados de `policy.json` son 300 admisiones (modelo/herramientas), 120 minutos, 1.500.000 tokens reportados por el host, USD 5 reportados de Haiku y tres trabajadores. Se comprueban antes de nuevos pasos; solicitudes ya iniciadas pueden terminar. La contabilización depende del uso/coste que reporte OpenCode, no es una factura del proveedor. Al alcanzar el límite Haiku, se deriva a Luna; los demás límites pausan. Los errores transitorios tienen como máximo dos reintentos técnicos. No se elevan permisos al elevar modelo.

## Comandos

Los comandos funcionan en la sesión actual y muestran estado sin pedir otra respuesta a un modelo.

```text
/router status
/router explain
/router simulate
/router pin 1.2 luna
/router pin 1.2 haiku
/router pin 1.2 sol
/router pin 1.2 astra
/router pin 1.2 auto
/router pause
/router resume
/router cancel
/router reconcile tool:ID_DE_LLAMADA
/router new
```

`simulate` calcula modelos de las tareas conocidas sobre una copia del estado, sin delegar. Un pin no permite bajar del nivel exigido por los fallos ni reabrir Haiku agotado. `pause` y `cancel` interrumpen hijos gestionados, incluidos los de otros worktrees; Escape/interrupción nativa cancela la ejecución gestionada. `resume` verifica la suscripción y conserva contadores. Una cancelación necesita sesión nueva o `/router new`, que archiva el estado y reinicia la clasificación.

Tras una operación incierta se pausa. Inspecciona primero el diff, las pruebas, el estado de los hijos y la evidencia de Swarm; usa `reconcile` únicamente cuando hayas determinado qué ocurrió. Después `resume`. La reconciliación no repite la operación. Una tarea no puede declararse completada eludiendo las puertas nativas de Swarm.

## Instalar o actualizar desde la biblioteca

En PowerShell, desde `C:\Users\andre\.agents`:

```powershell
cd opencode/router
npm ci --ignore-scripts --no-audit --no-fund
npm test
cd ../..
python scripts/setup_router.py
python scripts/setup_router.py --apply
```

El primer comando Python es una simulación. El segundo conserva configuración ajena, sustituye el plugin Swarm suelto por esta extensión, añade los tres agentes de entrada, fija las conexiones existentes y recarga OpenCode. Busca por defecto las etiquetas `OpenAI Cuenta` (OAuth) y `Anthropic API` (key); para otras etiquetas utiliza `--openai-credential ID --anthropic-credential ID`. No obtiene nuevos accesos ni activa la API de OpenAI.

El instalador imprime el directorio de backup en `.local/router-backups` y verifica que OpenCode confirme el plugin activo; si la recarga falla, restaura esos archivos. Para restaurar sus bytes exactos manualmente:

```powershell
python scripts/setup_router.py --restore RUTA_DEL_BACKUP --apply
opencode reload
```

En este equipo, la instalación definitiva está en `C:\Users\andre\.agents\opencode\router`; el backup anterior a toda la instalación es `C:\Users\andre\.agents\.local\router-backups\pre-router-20261014`. Para empezar, abre una sesión nueva con el agente `mi-router` y comprueba `/router status`.

Si hay modificaciones posteriores, la restauración se niega a sobrescribirlas. Conserva el backup y revisa el diff. No edites `node_modules` ni la caché: modifica `src/` o `policy.json`, ejecuta pruebas y recarga. El instalador general de skills conserva este plugin y su agente predeterminado.

## Verificación y límites de la validación

Se ejecutaron pruebas Node de política, OAuth/clave API, selección concurrente, estado compartido entre instancias, fallback en la misma sesión, cancelación y recuperación; y pruebas Python del instalador y de preservación de la biblioteca. También se cargó el plugin nativo y se verificó una consulta real Luna none → mi-answer y una selección real Luna none → Sol high. La traza del payload confirmó modelo y esfuerzo en ambas llamadas de esta última prueba.

El agotamiento de saldo y los fallos QA se prueban de forma controlada, sin gastar deliberadamente el saldo de Haiku. No se ha desarrollado una feature completa con tres LLM reales como parte de la instalación. El planificador y el contenido de las revisiones siguen dependiendo de los modelos; los bloqueos de permisos, autenticación, límites y selección no dependen de que el modelo recuerde el prompt.

Fuentes: [plugins V2](https://opencode.ai/v2/docs/build/plugins), [agentes](https://opencode.ai/v2/docs/agents/), [modelos](https://opencode.ai/v2/docs/models/), [proveedores](https://opencode.ai/v2/docs/providers/), [Swarm 7.197.1](https://github.com/ZaxbyHub/opencode-swarm/tree/v7.197.1), [Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview). La integración usa las firmas del SDK oficial 2.0.29 y el código publicado de ambas versiones.

El registro de comprobaciones, correcciones de revisión y límites está en [opencode-router-validation.md](../../docs/opencode-router-validation.md).
