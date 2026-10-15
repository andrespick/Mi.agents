# Router de OpenCode aprobado

Fuente de requisitos: requisitos aprobados para el desarrollo del router.
Codex y las skills compartidas conservan su comportamiento.

- Entrada Luna none; una segunda clasificación low si hay ambigüedad. Consultas y cambios pequeños no fuerzan SDD.
- Desarrollo sustancial: arquitecto Sol 6.1 high; contratos, tareas y dependencias reutilizan artefactos aprobados. Swarm conserva planificación, carriles, worktrees y puertas QA.
- Hasta tres trabajadores Luna high / Haiku 5.5 high. Son pares, con ámbito declarado, sin delegación recursiva. Reviewer independiente Sol high; test engineer Sol medium.
- Por tarea: intento inicial y dos correcciones de calidad; después Sol high (tres intentos) y Astra high (dos). Cambiar de proveedor no reinicia contadores. Infraestructura, baseline y rojo TDD no son fallos de calidad.
- Haiku sin saldo/cuota: circuito abierto durante la ejecución; continuar con Luna high conservando sesión, código y contexto, sin consumir corrección.
- OpenAI exclusivamente credencial OAuth seleccionada de suscripción, incluyendo auxiliares. Verificar autorización real al enviar HTTP/WebSocket; nunca usar una clave API como alternativa. Anthropic exclusivamente Haiku. Sin suscripción disponible, detener.
- Estado durable, deduplicación, intentos y límites por ejecución; recuperación explícita sin repetir operaciones inciertas. Pausar/cancelar interrumpe hijos gestionados. Comandos de estado, explicación, simulación y pin permitido.
- No ampliar permisos, desactivar pruebas, empujar cambios ni desplegar por escalar un modelo. Conservar instrucciones y restricciones del proyecto.

Decisiones de integración: extensión versionada que envuelve Swarm 7.197.1 sin parchear su caché ni entrada original. Una entrada privada derivada con hash fijado corrige incompatibilidades V2 confirmadas: herramientas habilitadas no se convierten en denies y errores viejos no invalidan un éxito del turno actual. Modelos por sesión/llamada; no mutar el registro global de coder durante ejecuciones concurrentes. La suscripción moderna usa api.openai.com con OAuth: la URL por sí sola NO prueba cómo se factura. Comprobar token contra la credencial OAuth fijada, sin registrar secretos. El paralelismo operativo es Lean Turbo, no parallelization.enabled (fundación inactiva).
