# Publication privacy

This repository keeps public sources separate from local credentials, account
bindings, runtime state, and restore backups. Copyright and upstream attribution
remain public. Operational paths and session identifiers use generic labels.

## Local files

`.gitignore` excludes `.local/`, `.superpowers/`, `.swarm/`, dependencies,
environment files, common credential files, private-key containers, logs, and
local databases. Empty configuration examples such as `.env.example` and
`credentials.example.json` remain publishable and are still scanned for secrets.

Backups can contain the exact contents of previous configuration, including
credentials. Base64 encoding does not encrypt them. Keep these files local;
ignore rules do not remove anything already committed or prevent `git add -f`.

## Checks before publication

```powershell
# Current tracked and non-ignored new files:
python scripts/check_publication.py --all

# Exact staged blobs and the prospective author/committer email:
python scripts/check_publication.py --check-identity
```

The optional `hooks/pre-commit` runs the existing library validator, then scans
the staged content and requires GitHub noreply email addresses. To enable it for
this repository, first check `git config --get core.hooksPath`. If another hook
system is configured, integrate the checks into it. Otherwise:

```powershell
git config --local core.hooksPath hooks
```

Use the noreply address shown in your GitHub email settings for both author and
committer. Configure it locally in this repository; global settings for other
projects do not need to change. These settings affect future commits only.

The GitHub Actions workflow runs the same file checks and their regression tests
on pushes to `main` and pull requests. It uses a pinned
[official checkout action](https://github.com/actions/checkout), read-only content
permissions, and disabled credential persistence. It does not need model/API
credentials or third-party scanning services.

Checks report only a file, line, and category. They do not print matched values.
They cover known token formats, private-key headers, literal credentials,
personal emails, machine-specific paths, live session/credential IDs, sensitive
file names, and binary files requiring review. They are heuristics, not a
guarantee of detecting every possible secret. There is no blanket test-directory
exception; synthetic test values should be constructed rather than embedding
realistic complete credentials.

The workflow checks the current tree, not all historical commits. Local hooks
can be bypassed and a workflow failure does not itself prevent a direct push;
repository rules must require the check if that enforcement is desired.

## Companion resources and history

The local brainstorming companion renders text attribution without an automatic
remote logo request. User-supplied mockups and upstream documentation may still
contain external resources; review those separately when offline operation matters.

Cleaning the current files and changing Git identity does not remove personal
data from published historical commits. A history rewrite requires a separately
coordinated operation. This cleanup does not rewrite or force-push that history.

## Resumen en español

Los datos locales, backups y credenciales quedan excluidos por `.gitignore`.
El hook comprueba los blobs preparados para commit, sin mostrar los valores
detectados, y exige correo noreply. GitHub Actions repite el control sobre los
archivos actuales. Las comprobaciones no garantizan detectar cualquier secreto
ni borran información de commits antiguos.

El companion conserva la atribución con texto local, sin solicitar el logo
remoto. Se mantienen las licencias y los créditos públicos. Los detalles de
despliegue y las evidencias con identificadores reales deben permanecer locales.
