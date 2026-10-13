# Mi.agents

Biblioteca personal compartida entre **Codex, OpenCode 2 y VS Code/Copilot**.
Las skills viven una sola vez en `~/.agents/skills`. Los agentes se mantienen en
`agents/catalog.json` y sus Markdown; el instalador genera los formatos que cada
programa entiende. No se copian las skills a las carpetas de cada aplicación.

Adaptación comprobada con Codex CLI **0.153.4** y OpenCode **2.0.28** en Windows.
OpenCode V1 utiliza otros campos: este instalador genera **V2**. Consulta la
[configuración oficial V2](https://opencode.ai/v2/docs/config/) para sus ubicaciones
y la combinación de configuración global y de proyecto.

## Instalar en este PC u otro

Necesitas Git, Python 3.11 o posterior y las aplicaciones instaladas/autenticadas.
Clona este repositorio exactamente en la carpeta `.agents` de tu usuario. Si ya
existe, úsala; no clones encima ni crees una segunda biblioteca.

```powershell
# Solo en un PC donde todavía no exista ~/.agents:
git clone https://github.com/andrespick/Mi.agents.git "$HOME/.agents"

Set-Location "$HOME/.agents"
python scripts/setup_agents.py --validate
python scripts/setup_agents.py
python scripts/setup_agents.py --apply
```

Sin `--apply` se muestra la lista de archivos afectados sin escribir. También
puedes usar `./scripts/setup.ps1 --apply`; es un envoltorio del mismo programa.
Si `python` no está en PATH, usa la ruta completa a tu Python. `--home` existe
para pruebas o una instalación explícita en otro usuario; no cambia el usuario
con el que se ejecutan las aplicaciones.

La instalación global crea los agentes e instrucciones comunes. Conserva modelos,
autenticación, plugins, MCP y ajustes ajenos. Un `default_agent` existente de
OpenCode se conserva; si falta, se establece `mi-simple`. Inicia una conversación
nueva para usar las instrucciones actuales. Si no aparecen los agentes, reinicia
la aplicación; no se interrumpen sesiones desde el instalador.

## Uso diario

No necesitas activar un proceso para hacer una pregunta o cambiar algo pequeño.
Las 19 skills de esta biblioteca tienen activación manual. Los roles indican
cuáles cargar cuando tú los eliges. Esto no cambia las políticas de plugins o
skills del sistema instalados por cada programa.

| Rol | Cuándo usarlo |
|---|---|
| `mi-simple` (OpenCode) | Trabajo directo, sin delegación automática. |
| `development` | Desarrollo proporcional; SDD para cambios sustanciales. |
| `cybersecurity` | Auditoría con evidencia, cobertura e informe. |
| `security-auth` | Autenticación, autorización y aislamiento. |
| `security-input` | Entradas, inyecciones, archivos y flujos de datos. |
| `security-dependencies` | Dependencias, secretos y configuración. |

El flujo sustancial es requisitos → especificación técnica → revisión de
especificación → plan. `brainstorming` se usa antes solo si falta definir la idea.
No se repite el diseño ni se generan documentos para cambios triviales.

### Codex

Codex descubre las skills en `~/.agents/skills`. La opción
`policy.allow_implicit_invocation: false` de cada `agents/openai.yaml` evita su
selección implícita. Puedes solicitar una skill por nombre; en CLI/IDE también
puedes usar `$nombre` y explorar `/skills`.
[Documentación de skills](https://learn.chatgpt.com/docs/build-skills).

Ejemplos de mensajes:

```text
$requirements-engineering-m Convierte esta idea en requisitos: ...

Usa la skill security-audit-m para revisar este repositorio en solo lectura.
Incluye evidencia y qué partes no pudiste revisar.

Delega la auditoría al agente cybersecurity. Puede utilizar sus tres revisores
si el alcance lo justifica. Guarda el informe en docs/security/.

Usa las instrucciones del rol development de mi biblioteca ~/.agents/agents/
para implementar esta funcionalidad: ...
```

Los TOML de `~/.codex/agents/` definen sesiones delegadas. No son un selector de
agente principal equivalente al de OpenCode. Para trabajar en el chat principal,
pide aplicar las instrucciones del rol. Si la interfaz no expone roles o la
delegación está deshabilitada, aplica el flujo en ese chat y deja constancia.
Los valores `sandbox_mode` son valores por defecto: los permisos efectivos del
padre y de la aplicación pueden prevalecer.
[Agentes personalizados de Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents).

El instalador añade un bloque a `~/.codex/AGENTS.md`; conserva el texto anterior.
Los proyectos pueden aportar sus propias instrucciones.
[Jerarquía AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

### OpenCode 2

En una sesión nueva selecciona `development` o `cybersecurity` en el selector de
agentes. Los tres revisores están definidos como subagentes: pide al coordinador
que los utilice cuando convenga. Los agentes se definen bajo `agents`, las
instrucciones bajo `system` y los permisos como una lista `permissions`.
[Agentes y selección en V2](https://opencode.ai/v2/docs/agents/).

Para activar una skill directamente:

```text
@requirements-engineering-m Define los requisitos de esta funcionalidad: ...

@security-audit-m Revisa este repositorio y presenta el informe en el chat.
```

También puedes pedir «carga la skill security-audit-m por su ID». V2 reconoce
`~/.agents/skills`, y `opencode/autoinvoke: false` la mantiene disponible para
invocación explícita. Los IDs son los nombres de carpeta y distinguen mayúsculas.
Por eso las skills propias ahora terminan en **-m**, no **-M**.
[Descubrimiento e invocación de skills V2](https://opencode.ai/v2/docs/skills/).

Comprueba el registro local sin hacer una consulta al modelo:

```powershell
opencode debug config
opencode debug agents
```

El coordinador permite editar `docs/security/**`; los revisores deniegan edición,
shell y nueva delegación. Son reglas de herramientas de OpenCode, no aislamiento
del sistema operativo ni garantía para herramientas externas añadidas después.
[Reglas de permisos](https://opencode.ai/v2/docs/permissions/).

## Configuración global y por proyecto

Lo global sirve en todos tus repositorios. Para filtrar las skills de esta
biblioteca en un proyecto, instala un preset local:

```powershell
python "$HOME/.agents/scripts/setup_agents.py" --project 'C:/codigo/mi-app' --profile security
python "$HOME/.agents/scripts/setup_agents.py" --project 'C:/codigo/mi-app' --profile security --apply
```

| Preset del instalador | Skills en el contexto principal del proyecto |
|---|---|
| `simple` | Deshabilita las skills de esta biblioteca. |
| `development` | Habilita el conjunto del rol de desarrollo. |
| `security` | Habilita `security-audit-m`. |

El preset `simple` de proyecto es más restrictivo que la instalación global:
una skill deshabilitada no puede cargarse explícitamente en ese contexto.
Los roles seleccionados aportan sus propios conjuntos y pueden habilitarlos.
Estas selecciones **no son perfiles `codex --profile`**. Son presets de este
instalador que generan `.codex/config.toml` y `opencode.json` en el proyecto.
No se alteran las configuraciones globales al instalar un proyecto. Codex exige
confianza en el proyecto para cargar ciertas configuraciones locales.
[Configuración de Codex](https://learn.chatgpt.com/docs/config-file/config-basic).

Las rutas generadas son locales y absolutas. En otro PC regenera la instalación;
no sincronices los adaptadores generados ni los backups como si fueran las fuentes.
Para cambiar el preset, repite la instalación con otro `--profile`.

### MCP

Por defecto el instalador deja intactos los MCP existentes. Si quieres controlar
un servidor Codex concreto, debe estar configurado previamente con su comando o URL:

```powershell
# Deshabilitar globalmente SOLO este servidor ya configurado:
python "$HOME/.agents/scripts/setup_agents.py" --manage-mcp gemini-notebook-mcp --apply

# Habilitarlo en un proyecto concreto:
python "$HOME/.agents/scripts/setup_agents.py" --project 'C:/codigo/mi-app' --profile development --manage-mcp gemini-notebook-mcp --enable-mcp gemini-notebook-mcp --apply
```

En Codex se cambia `enabled` y se conservan los demás campos. En OpenCode se cambia
`disabled` solo si ese mismo ID ya está definido allí, bajo `mcp.servers` en V2.
V2 reemplaza el objeto completo del servidor al redefinirlo por proyecto: si
existe globalmente, prepara primero su definición completa local usando variables
de entorno para secretos. El instalador se detiene si falta esa definición.
Las configuraciones de conexión y credenciales siguen siendo propias de cada
programa; el instalador no copia sus secretos a proyectos. Deshabilitar una herramienta por
permisos y apagar su servidor son acciones diferentes.
[MCP Codex](https://learn.chatgpt.com/docs/config-file/config-reference),
[MCP OpenCode V2](https://opencode.ai/v2/docs/mcp-servers).

## Personalizar y sincronizar

| Fuente que editas | Contenido |
|---|---|
| `skills/<id>/SKILL.md` | Instrucciones reutilizables y recursos de la skill. |
| `skills/<id>/agents/openai.yaml` | Política de invocación Codex. |
| `agents/catalog.json` | Roles, skills asociadas, acceso, delegados y modelos. |
| `agents/*.md` | Comportamiento de cada rol. |
| `instructions/common.md` | Política común ligera. |
| `hooks/` | Entradas opcionales a scripts compartidos. |
| `scripts/setup_agents.py` | Generador y restauración. |

`models: {}` hereda la elección actual. Para fijar un modelo, añade a un rol
`models.codex` con un ID disponible en tu cuenta, o `models.opencode` con
`proveedor/modelo` (V2 admite `#variante`). Puedes añadir
`reasoning_effort.codex` con un esfuerzo soportado. No todos los proveedores
comparten modelos ni nombres. En OpenCode V2 cambiar el agente principal no
sustituye el modelo ya guardado en la sesión; selecciona también el modelo en la UI.

Después de editar fuentes:

```powershell
Set-Location "$HOME/.agents"
python scripts/setup_agents.py --validate
python -X utf8 -m unittest discover -s tests -v
python scripts/setup_agents.py --apply
git status
# Revisa el diff antes de guardar y compartir tus cambios con git commit / git push.
```

En el otro equipo: `git pull --ff-only`, valida y vuelve a ejecutar el instalador.
Las modificaciones a skills se leen de la carpeta compartida; los cambios a
roles requieren regenerar. Repite también las instalaciones de proyecto que
quieras actualizar. Para retirar o renombrar un rol ya instalado, restaura primero
la instalación correspondiente; el generador no borra archivos huérfanos.

Los archivos y bloques marcados como generados se reemplazan al reinstalar.
Modifica sus fuentes, no sus copias. El resto del JSON se conserva semánticamente
(puede cambiar el formato); el texto ajeno de AGENTS.md se conserva. Ante JSONC
existente, V1 o una colisión con un agente ajeno, el instalador se detiene sin
escribir. Integra ese caso manualmente para preservar comentarios y decisiones.

## Backups y restauración

Cada aplicación efectiva guarda los bytes anteriores y hashes del resultado en
`.local/backups/`. Esa carpeta está excluida de Git y puede contener configuración
privada; permanece en el equipo. La consola muestra el archivo exacto.

```powershell
python scripts/setup_agents.py --restore '.local/backups/ARCHIVO.json' --apply
```

Restaura en orden inverso, desde el backup más reciente. Si algún archivo cambió
después de instalar, se rechaza toda la restauración antes de tocar archivos.
Esto evita destruir modificaciones posteriores. Revisa e integra esos cambios
manualmente; no fuerces una restauración sobre ellos. Restaurar adaptadores no
revierte commits de la biblioteca ni elimina carpetas vacías.

## VS Code/Copilot y hooks

Las skills compartidas también son compatibles con Copilot. Opcionalmente:

```powershell
python scripts/setup_agents.py --copilot --apply
```

Genera `~/.copilot/agents/*.agent.md` (o `.github/agents/` con `--project`). Este
adaptador comparte instrucciones; no traduce automáticamente sandbox, permisos
ni delegación. Selecciona las herramientas y modelos de Copilot según tu entorno.
[Skills de VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills),
[agentes personalizados](https://code.visualstudio.com/docs/agent-customization/custom-agents).

`hooks/pre-commit` es un hook Git opcional para validar **esta biblioteca** antes
de cada commit. Para activarlo aquí: `git config --local core.hooksPath hooks`.
Consulta primero `git config --local --get core.hooksPath` y conserva su valor si
ya usas otros hooks. No se activa automáticamente. En Windows usa Git for Windows.
El mismo validador puede invocarse manualmente desde cualquier editor.

Los eventos de ejecución no son universales: Codex usa su formato de hooks y
OpenCode V2 sus plugins. Se comparte el script, pero cada aplicación necesita su
registro nativo. No instalamos automatizaciones de sesión para forzar skills.
[Hooks de Codex](https://learn.chatgpt.com/docs/hooks),
[plugins de OpenCode V2](https://opencode.ai/v2/docs/plugins/).

Consulta [UPSTREAM.md](docs/UPSTREAM.md) antes de actualizar Superpowers para
conservar las adaptaciones locales. No hay certificación de seguridad automática:
una auditoría siempre debe indicar evidencia, alcance y exclusiones.
