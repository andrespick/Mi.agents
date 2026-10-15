# Mi.agents

[English](README.md) · [README original](README.original.md)

**Mi.agents combina skills adaptadas de
[Superpowers](https://github.com/obra/superpowers), la orquestación de
[Swarm](https://github.com/ZaxbyHub/opencode-swarm) e integraciones propias para
crear el entorno que uso en mi desarrollo personal.** Los cambios futuros estarán
guiados exclusivamente por mis propios casos de uso. Lo comparto bajo
[licencia MIT](LICENSE) para que otras personas puedan explorarlo, reutilizarlo
y adaptarlo a su forma de trabajar.

**Transparencia sobre el uso de IA:** desarrollé el código propio y las
integraciones con herramientas de inteligencia artificial; no escribí manualmente
ninguna línea de código. Los proyectos originales conservan su autoría y sus
créditos. Uso este entorno a diario e intento mantenerlo actualizado y corregir
los errores que encuentro. Ese mantenimiento responde a mi entorno y mis
necesidades personales.

El módulo opcional **Mi.router** añade selección automática de modelos y
coordinación de varios agentes **solo en OpenCode**. Se instala por separado de
la biblioteca compartida y su configuración refleja mis modelos y conexiones
personales. Su guía completa está en el
[README del router](opencode/router/README.md).

## ¿Para qué sirve este proyecto?

Permite mantener instrucciones reutilizables en un mismo lugar al cambiar de
herramienta de programación. Una **skill** es un conjunto de instrucciones y
archivos de apoyo para una tarea, como depurar o revisar una especificación. Un
**rol de agente** define el comportamiento de un especialista, sus skills y el
acceso que debería tener.

Las skills viven una sola vez en `~/.agents/skills`. El instalador lee el catálogo
compartido de agentes y genera la configuración que entiende cada herramienta.
Editas las fuentes de este repositorio y evitas mantener copias independientes
para cada aplicación.

| Componente | Para qué sirve |
|---|---|
| Skills compartidas | Flujos adaptados de Superpowers y skills adicionales de requisitos, especificación y seguridad. |
| Roles de agentes | Desarrollo, coordinación de seguridad y tres revisores especialistas. |
| Adaptadores | Configuración para Codex, OpenCode 2 y, opcionalmente, VS Code/Copilot. |
| Hooks | Scripts compartidos opcionales, incluido un hook Git de validación de esta biblioteca. |
| Mi.router | Selección automática, trabajadores paralelos, reintentos y escalamiento sobre Swarm en OpenCode. |

Las skills de esta biblioteca se invocan manualmente o mediante un rol que elijas
expresamente. Una tarea pequeña puede seguir siendo pequeña. Cada aplicación
controla sus propios permisos, herramientas, autenticación y capacidad de
delegación. Las conexiones MCP y el registro de hooks de ejecución siguen siendo
específicos de cada aplicación.

## Empieza por la biblioteca compartida

La instalación documentada utiliza **Windows y PowerShell**, Git,
**Python 3.11 o posterior** y tus aplicaciones de programación ya instaladas y
autenticadas. Los adaptadores compartidos se comprobaron con Codex CLI 0.153.4 y
OpenCode 2.0.28; el router se comprobó con OpenCode 2.0.29. La configuración de
OpenCode corresponde a **V2**. Otros entornos pueden necesitar adaptaciones.

Clona el repositorio en la carpeta `.agents` de tu usuario **solo si esa carpeta
todavía no existe**. Si ya tienes una biblioteca allí, revisa e integra su
contenido primero.

```powershell
git clone https://github.com/andrespick/Mi.agents.git "$HOME/.agents"
Set-Location "$HOME/.agents"

python scripts/setup_agents.py --validate
python scripts/setup_agents.py
```

La validación comprueba la biblioteca; el segundo comando muestra una vista
previa de la instalación. Revisa los cambios propuestos y aplícalos:

```powershell
python scripts/setup_agents.py --apply
```

El instalador crea las instrucciones comunes y los adaptadores de agentes,
conservando ajustes ajenos, credenciales, plugins y configuración MCP. Guarda
copias de los archivos modificados en `.local/backups/`. Si encuentra una
configuración incompatible o una colisión de nombres, se detiene para que puedas
resolverla. Después, abre una conversación nueva.

Para añadir opcionalmente los adaptadores de agentes de Copilot:

```powershell
python scripts/setup_agents.py --copilot
python scripts/setup_agents.py --copilot --apply
```

## Tu primera tarea

Pide una skill por su nombre o elige un rol adecuado al trabajo:

| Rol | Cuándo usarlo |
|---|---|
| `mi-simple` (OpenCode) | Trabajo directo sin delegación automática. |
| `development` | Desarrollo, con requisitos y planificación cuando el alcance lo necesita. |
| `cybersecurity` | Revisión coordinada de seguridad del código, con evidencia y cobertura. |
| `security-auth` | Revisión de autenticación, autorización y aislamiento de usuarios. |
| `security-input` | Entradas, inyecciones, archivos y flujos de datos. |
| `security-dependencies` | Dependencias, secretos y configuración de despliegue. |

En OpenCode, selecciona un rol principal en una sesión nueva. En Codex, pide al
chat principal que siga las instrucciones del rol; las definiciones de agentes
generadas sirven para sesiones delegadas cuando la aplicación ofrece esa
capacidad.

Ejemplos de peticiones:

```text
Carga requirements-engineering-m y ayúdame a definir los requisitos de esta funcionalidad.

Usa el rol development de ~/.agents/agents/ para implementar este cambio.

Usa security-audit-m para revisar este repositorio sin modificarlo.
Indica evidencia, cobertura y lo que no hayas podido comprobar.
```

Los identificadores de las skills se mantienen iguales en ambos idiomas.
Parte de las skills y de las instrucciones de los roles está escrita en español.

## Opcional: router automático en OpenCode

Mi.router envuelve **opencode-swarm 7.197.1**. En su configuración personal actual:

- Luna clasifica las peticiones y Sol planifica los desarrollos grandes.
- Hasta tres trabajadores Luna/Haiku atienden tareas independientes; Swarm
  gestiona dependencias, worktrees aislados y controles de revisión.
- Los fallos QA repetidos elevan una tarea a Sol, después a Astra y finalmente
  la pausan.
- Si Haiku falla por saldo o cuota, el trabajo pendiente pasa a Luna.
- Las llamadas OpenAI quedan ligadas a la credencial OAuth de suscripción
  configurada; Haiku utiliza la conexión API de Anthropic configurada.
- Incluye estado persistente, presupuestos, pausa, cancelación y recuperación.

El router necesita además **Node.js 24 o posterior**, npm, una versión compatible
de OpenCode y acceso a los modelos configurados. Los nombres de los modelos,
variantes y credenciales deben coincidir con tu entorno. Las etiquetas de
conexión predeterminadas son las que uso yo; sigue la guía para seleccionar tus
propias credenciales. El repositorio no proporciona acceso a cuentas. El
instalador de la biblioteca compartida no instala ni activa el router.

Para instalación, comandos, política de modelos, conexiones y restauración,
consulta el **[README del router](opencode/router/README.md)**. Su versión fijada
de Swarm utiliza una entrada de compatibilidad generada localmente; revisa esa
adaptación antes de actualizar la dependencia.

## Personaliza y sincroniza

| Fuente | Qué editar |
|---|---|
| `skills/<id>/SKILL.md` | Instrucciones y recursos reutilizables de cada skill. |
| `agents/catalog.json` y `agents/*.md` | Roles, skills asignadas y comportamiento. |
| `instructions/common.md` | Política compartida. |
| `hooks/` | Scripts opcionales de hooks compartidos. |
| `scripts/setup_agents.py` | Generación de adaptadores para cada herramienta. |
| `opencode/router/` | Política, implementación y documentación del router. |

Después de cambiar roles o configuración compartida, valida y regenera los
adaptadores. En otro equipo, descarga las fuentes e instala de nuevo: las rutas
generadas son locales y absolutas. Mantén `.local/`, las credenciales, los
backups y el estado de ejecución en su propio equipo.

```powershell
Set-Location "$HOME/.agents"
git pull --ff-only
python scripts/setup_agents.py --validate
python scripts/setup_agents.py
python scripts/setup_agents.py --apply
```

Para presets por proyecto, controles MCP, hooks y comandos exactos de
backup/restauración, consulta el [README original detallado](README.original.md).
Se conserva como referencia e incluye detalles del entorno del autor.

## Verificación y mantenimiento

La validación registrada del router incluye 30 pruebas Node, 23 pruebas Python y
comprobaciones nativas de clasificación y cambio de modelo. Como parte de esa
instalación no se validó una funcionalidad completa desarrollada por tres
trabajadores con modelos reales; los fallos de cuota y QA se ejercitaron mediante
pruebas controladas. Consulta la [validación de la biblioteca](docs/VALIDATION.md)
y la [validación del router](docs/opencode-router-validation.md) para conocer su
alcance y sus límites.

Para ejecutar las comprobaciones desde la raíz del repositorio:

```powershell
python scripts/setup_agents.py --validate
python -X utf8 -m unittest discover -s tests -v

# Comprobaciones opcionales del router:
Set-Location opencode/router
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

Los comentarios, reportes de errores y pull requests son bienvenidos. Reviso e
integro cambios cuando tengo tiempo y encajan con mi forma personal de trabajar.
Si necesitas otra dirección para el proyecto, puedes mantener tu propio fork.

## Privacidad al publicar

Las credenciales locales, backups, logs y estado de ejecución quedan excluidos
de Git. El hook pre-commit y GitHub Actions comprueban los archivos públicos sin
mostrar valores de secretos. El companion usa atribución de texto local. Consulta
la [guía de privacidad](docs/PRIVACY.md) para configuración, límites e historial.

## Créditos y licencia

- [Superpowers](https://github.com/obra/superpowers), de obra: base original de
  las skills. Las adaptaciones locales y su procedencia están registradas en
  [UPSTREAM.md](docs/UPSTREAM.md).
- [opencode-swarm](https://github.com/ZaxbyHub/opencode-swarm), de ZaxbyHub:
  orquestación utilizada por el router opcional de OpenCode.
- Codex, OpenCode y VS Code/Copilot proporcionan los entornos con los que se
  integra esta configuración.

Mi.agents se publica bajo [licencia MIT](LICENSE). Conserva las licencias y los
avisos de atribución correspondientes al reutilizar material de los proyectos
originales.
