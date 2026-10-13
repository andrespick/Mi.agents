# Thin wrapper; all arguments go to the stdlib-only Python installer.
$ErrorActionPreference = 'Stop'
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCommand) { throw 'Instale Python 3.11+ y añádalo al PATH, o ejecute setup_agents.py con su ruta completa.' }
& $pythonCommand.Source (Join-Path $PSScriptRoot 'setup_agents.py') @args
exit $LASTEXITCODE
