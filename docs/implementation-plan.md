# Configuración compartida aprobada

Objetivo: biblioteca única, modo ligero por defecto, agentes y perfiles nativos de Codex/OpenCode, adaptador Copilot, instalación reversible y README en español.

1. Normalizar -M a -m, referencias locales y activación manual; política proporcional y flujo SDD sin diseño duplicado.
2. Definir cybersecurity, tres revisores y desarrollo desde JSON + instrucciones comunes; generar archivos nativos y conservar configuración ajena.
3. Implementar instalador con vista previa, ámbito global/proyecto, MCP explícitos, respaldo, restauración y validación.
4. Probar generación, conservación, idempotencia, conflictos, rollback y aislamiento; revisar con contexto nuevo.
5. Integrar y activar en este PC, verificar descubrimiento real en ambos runtimes y documentar limitaciones.

Decisiones: Python 3.11+ sin dependencias para TOML/JSON y pruebas; PowerShell como entrada Windows. No sustituir configuraciones completas. Heredar modelos por defecto y permitir fijarlos por herramienta en cada manifest. No inventar equivalencia entre agentes principales OpenCode y sesiones delegadas Codex. Conservar herramientas del runtime. Hooks opcionales de validación del catálogo, sin activar automatizaciones no necesarias.

Prueba de comportamiento: baseline independiente encontró carga de skills obligatoria para preguntas sencillas, no obligación demostrada de diseño para todo cambio. Seguridad requiere evidencias y cobertura explícitas. Nueva política elimina el disparador del 1% y hace explícitos esos requisitos.
