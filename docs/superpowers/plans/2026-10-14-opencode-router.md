# Router de OpenCode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Activar el router aprobado con política comprobable y facturación protegida.
**Architecture:** Plugin V2 envolvente de Swarm; núcleo puro de políticas y estado durable; adaptadores de sesiones, herramientas y autenticación.
**Tech Stack:** Node 24, JavaScript ESM, node:test, OpenCode 2.0.29, Swarm 7.197.1, instalador Python.
**Spec:** docs/opencode-router-spec.md

## Global Constraints

No cambiar Codex. No editar caché npm de Swarm. No guardar secretos en repositorio/logs. Respetar permisos efectivos. No publicar ni empujar.

## Review Focus

Carreras entre cambio de conexión y envío; dos tareas concurrentes con modelos distintos; deduplicar fallos QA; reinicio con operación incierta; cancelación de hijos en otros worktrees.

### Task 1: Política y estado

Files: opencode/router/{policy.json,src/policy.mjs,src/state.mjs,test/policy.test.mjs}.
Interfaces: política produce selección Model.Ref y transiciones serializables para adaptador; estado recibe almacenamiento durable.
- [ ] Escribir y observar fallar pruebas de tres intentos, fallback sin penalidad, deduplicación, presupuestos y auth real.
- [ ] Implementar núcleo y ejecutar node --test; Expected: todas pasan.

### Task 2: Adaptador nativo y Swarm

Files: opencode/router/{package.json,src/index.mjs,src/runtime.mjs,test/runtime.test.mjs}.
Interfaces: usa política Task 1 y hooks oficiales; Swarm mantiene evidencia y carriles.
- [ ] Escribir y observar fallar pruebas de despacho concurrente, OAuth guard, fallback, recuperación/cancelación.
- [ ] Implementar y probar con SDK real y host controlado; Expected: modelos/variantes verificables, sin secretos ni efectos duplicados.

### Task 3: Instalación y activación

Files: scripts/setup_router.py, tests/test_router_setup.py, opencode/router/README.md, README.md.
Interfaces: instalador conserva configuración ajena y crea binding local ignorado; plugin lee ese binding.
- [ ] Pruebas RED de preservación/backup/restauración y ruta del plugin.
- [ ] Implementar; pruebas Node/Python y carga nativa; Expected: plugin y comandos presentes.
- [ ] Revisión independiente completa, corregir hallazgos importantes; activar en biblioteca canónica con backup y verificar configuración efectiva.

Ledger: .superpowers/sdd/2026-10-14-opencode-router/progress.md.
