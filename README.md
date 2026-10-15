# Mi.agents

[Español](README.es.md) · [Original README (Spanish)](README.original.md)

**Mi.agents combines adapted [Superpowers](https://github.com/obra/superpowers)
skills, [Swarm](https://github.com/ZaxbyHub/opencode-swarm) orchestration, and my
own integrations into the setup I use for personal software development.**
Future development is driven exclusively by my own use cases. I share it under
the [MIT license](LICENSE) so others can explore, reuse, and adapt it to their
own workflows.

**AI development disclosure:** I created the custom code and integrations with
AI tools; I did not manually write any lines of code. The upstream projects
retain their own authorship and credits. I use this setup in my daily work and
try to keep it updated and fix the bugs I encounter. That maintenance reflects
my own environment and needs.

The optional **Mi.router** module adds automatic model selection and multi-agent
coordination to **OpenCode only**. It is a separate installation from the shared
skills library; its configuration reflects my personal model and account setup.
See the [router README (Spanish)](opencode/router/README.md) for its full guide.

## What does this project do?

It keeps reusable instructions in one place when you switch between coding
tools. A **skill** is a set of instructions and supporting files for a task,
such as debugging or reviewing a specification. An **agent role** describes a
specialist's behavior, available skills, and intended access.

Skills live once in `~/.agents/skills`. The installer reads the shared agent
catalog and generates the configuration each supported tool understands.
You edit the sources in this repository rather than maintaining separate copies
for each application.

| Component | Purpose |
|---|---|
| Shared skills | Adapted Superpowers workflows and additional requirements, specification, and security skills. |
| Agent roles | Development, security coordination, and three specialist security reviewers. |
| Tool adapters | Configuration for Codex, OpenCode 2, and optionally VS Code/Copilot. |
| Hooks | Optional shared scripts, including a Git validation hook for this repository. |
| Mi.router | Optional Swarm-based routing, parallel workers, retries, and escalation for OpenCode. |

Skills in this library are manually invoked, or loaded through a role you
explicitly choose. Small tasks can stay small. Each application still controls
its own permissions, tools, authentication, and delegation capabilities. MCP
connections and runtime hook registration remain specific to each application.

## Start with the shared library

The documented setup uses **Windows and PowerShell**, Git, **Python 3.11+**, and
your coding applications already installed and authenticated. The shared
adapters were checked with Codex CLI 0.153.4 and OpenCode 2.0.28; the router was
checked with OpenCode 2.0.29. OpenCode configuration targets **V2**.
Other environments may need adaptation.

Clone the repository into your user's `.agents` directory **only if that
directory does not already exist**. If you already have a library there, review
and integrate its contents first.

```powershell
git clone https://github.com/andrespick/Mi.agents.git "$HOME/.agents"
Set-Location "$HOME/.agents"

python scripts/setup_agents.py --validate
python scripts/setup_agents.py
```

Validation checks the library; the second command previews the installation.
Review the proposed changes, then apply them:

```powershell
python scripts/setup_agents.py --apply
```

The installer creates shared instructions and agent adapters, preserving unrelated
settings, credentials, plugins, and MCP configuration. It backs up changed files
under `.local/backups/`. If it encounters unsupported configuration or a naming
collision, it stops for you to resolve it. Open a new conversation afterward.

For optional Copilot agent adapters:

```powershell
python scripts/setup_agents.py --copilot
python scripts/setup_agents.py --copilot --apply
```

## Your first task

Ask for a skill by name or choose a role appropriate to the work:

| Role | Use it for |
|---|---|
| `mi-simple` (OpenCode) | Direct work without automatic delegation. |
| `development` | Development, with requirements and planning when the scope needs them. |
| `cybersecurity` | Coordinated code security review with evidence and coverage. |
| `security-auth` | Authentication, authorization, and user isolation review. |
| `security-input` | Input handling, injection, files, and data flows. |
| `security-dependencies` | Dependencies, secrets, and deployment configuration. |

In OpenCode, select a main role in a new session. In Codex, ask the main chat to
follow the role's instructions; generated agent definitions are for delegated
sessions when the application exposes that capability.

Example requests:

```text
Load requirements-engineering-m and help define the requirements for this feature.

Use the development role from ~/.agents/agents/ to implement this change.

Use security-audit-m to review this repository without modifying it.
Report evidence, coverage, and anything you could not verify.
```

The skill IDs stay the same in either language. Some skills and role instructions
are written in Spanish; this English introduction does not translate those files.

## Optional: automatic routing in OpenCode

Mi.router wraps **opencode-swarm 7.197.1**. In its current personal configuration:

- Luna classifies requests; Sol plans larger development work.
- Up to three Luna/Haiku workers handle independent tasks, with Swarm managing
  dependencies, isolated worktrees, and review gates.
- Repeated QA failures escalate a task to Sol, then Astra, then pause it.
- Haiku balance or quota failures send pending work to Luna.
- OpenAI calls are bound to the configured subscription OAuth credential;
  Haiku uses the configured Anthropic API connection.
- Persistent state, budgets, pause, cancellation, and recovery controls are included.

The router additionally needs **Node.js 24+**, npm, compatible OpenCode, and
access to the configured models. Model names, variants, and credential selection
must match your own setup. The default connection labels reflect mine; follow
the guide to select your own credentials. No account access is bundled with this
repository. The shared-library installer does not install or activate the router.

For installation, commands, model policy, connection setup, and restoration,
read the **[router README](opencode/router/README.md)**. Its pinned Swarm version
includes a locally generated compatibility entry; review that adaptation before
upgrading the dependency.

## Customize and keep it in sync

| Source | What to edit |
|---|---|
| `skills/<id>/SKILL.md` | Reusable skill instructions and resources. |
| `agents/catalog.json` and `agents/*.md` | Roles, skill assignments, and behavior. |
| `instructions/common.md` | Shared policy. |
| `hooks/` | Optional shared hook scripts. |
| `scripts/setup_agents.py` | Tool adapter generation. |
| `opencode/router/` | Router policy, implementation, and documentation. |

After changing roles or shared configuration, validate and regenerate adapters.
On another computer, pull the sources and install again: generated paths are
local and absolute. Keep `.local/`, credentials, backups, and runtime state on
their own machine.

```powershell
Set-Location "$HOME/.agents"
git pull --ff-only
python scripts/setup_agents.py --validate
python scripts/setup_agents.py
python scripts/setup_agents.py --apply
```

For project presets, MCP controls, hooks, and exact backup/restore commands,
consult the [original detailed README](README.original.md). That document is
preserved as a reference and includes details of the author's environment.

## Verification and maintenance

The recorded router validation includes 30 Node tests, 23 Python tests, and
native classification/model-switch checks. A complete feature developed by three
real model workers has not been validated as part of that installation; quota
and QA failure paths were exercised with controlled tests. See
[library validation](docs/VALIDATION.md) and
[router validation](docs/opencode-router-validation.md) for scope and limits.

To run the checks yourself, from the repository root:

```powershell
python scripts/setup_agents.py --validate
python -X utf8 -m unittest discover -s tests -v

# Optional router checks:
Set-Location opencode/router
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

Feedback, bug reports, and pull requests are welcome. I review and integrate
changes as time allows, when they fit my personal workflow. For different needs,
you are welcome to maintain your own fork.

## Publication privacy

Local credentials, backups, logs, and runtime state are excluded from Git.
The pre-commit hook and GitHub Actions check public files without printing
matched secret values. The companion uses local text branding. See the
[privacy guide](docs/PRIVACY.md) for setup, limits, and historical-data handling.

## Credits and license

- [Superpowers](https://github.com/obra/superpowers), by obra: the upstream skill
  foundation. Local adaptations and provenance are recorded in
  [UPSTREAM.md](docs/UPSTREAM.md).
- [opencode-swarm](https://github.com/ZaxbyHub/opencode-swarm), by ZaxbyHub:
  orchestration used by the optional OpenCode router.
- Codex, OpenCode, and VS Code/Copilot provide the host environments this setup
  integrates with.

Mi.agents is published under the [MIT license](LICENSE). Preserve the applicable
upstream license and attribution notices when reusing their material.
