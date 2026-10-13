---
name: security-audit-m
description: Use when explicitly asked to audit source-code security or when the user selects the cybersecurity role. Produces evidence-backed findings and an explicit coverage report.
disable-model-invocation: true
metadata:
  opencode/autoinvoke: "false"
  opencode/slash: "true"
---

# Auditoría de seguridad con evidencia

1. Identifica repositorio, commit o estado local, alcance pedido, stack y puntos
   de entrada. Si faltan áreas, continúa con lo disponible y registra exclusiones.
2. Traza flujos y controles reales. Revisa identidad/permisos, entradas/datos y
   dependencias/configuración según apliquen. No ejecutes código no confiable ni
   ataques externos. No modifiques la aplicación ni expongas secretos.
3. Si eres el coordinador y el alcance lo justifica, puedes delegar hasta tres
   revisiones independientes en roles disponibles. Los trabajadores solo leen y
   no delegan. Si no hay herramienta de delegación, revisa secuencialmente.
4. Cada hallazgo debe incluir severidad razonada, archivo y línea, evidencia,
   condición necesaria, impacto, reproducción segura o razonamiento verificable,
   corrección sugerida y confianza. Separa hallazgos confirmados de hipótesis.
   Contrasta resultados delegados con código; no infles severidad por palabras clave.
5. Entrega un informe con: alcance y revisión, hallazgos priorizados, tabla de
   cobertura (área, archivos, comprobación, resultado), exclusiones, comprobaciones
   no ejecutadas, riesgos pendientes y próximos pasos. Escribe docs/security/
   solo si está autorizado; para solo lectura, responde en el chat.

«No se encontraron hallazgos en el alcance revisado» requiere indicar ese alcance.
No equivale a certificar que todo el sistema es seguro. La presión de tiempo no
justifica omitir exclusiones, inventar pruebas o atribuir trabajo a agentes inexistentes.
