# Comprobaciones de instalación

Validación de referencia: 13 de octubre de 2026.

- Python 3.14: 16 pruebas pasan, incluyendo conservación de configuración,
  idempotencia global/proyecto, cambio de preset, conflictos, rollback exacto,
  cambios posteriores del usuario, fallo de reemplazo, padres enlazados y MCP V2.
- Revisión independiente: se corrigieron escritura no atómica, comprobación de
  enlaces en padres y registro Git de renombrados a minúsculas. Revisión final
  focalizada sin bloqueos.
- Codex CLI 0.153.4: app-server con `--strict-config` inicia correctamente;
  `skills/list` detecta las 19 skills desde la biblioteca canónica, sin errores
  de carga. Los cinco TOML de agentes se analizaron y referencian esa biblioteca.
- OpenCode 2.0.28: `debug agents` registra development, cybersecurity,
  security-auth, security-input, security-dependencies y mi-simple; los permisos
  efectivos listados del revisor security-auth deniegan edit y shell.
- Se compararon hashes antes/después: la instalación global conservó íntegros
  `.codex/config.toml` y `.config/opencode/service.json` existentes.
- Una segunda vista previa de instalación marca los ocho archivos como IGUAL.
- Evaluación de instrucciones: explicación sencilla y cambio claro de texto
  no exigen un flujo pesado; la auditoría con un módulo ausente exige exclusiones
  y no permite declarar todo el sistema seguro.

Estas comprobaciones no son una auditoría de los proyectos del usuario ni una
ejecución de tareas con modelos en ambos programas. No se ejercitó una delegación
Codex completa, el adaptador opcional Copilot ni hooks de sesión. Los avisos de
iconos y de acceso al catálogo remoto de plugins de Codex no afectaron la carga
de esta biblioteca. Las sesiones abiertas pueden requerir recarga o un chat nuevo.
