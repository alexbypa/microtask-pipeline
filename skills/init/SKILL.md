---
name: init
description: Configura microtask-pipeline nel progetto corrente: rileva build/test/cartelle, propone la sezione "## Microtask config" per CLAUDE.md e crea la coda in TODO.md se manca.
disable-model-invocation: true
---
# Setup microtask-pipeline

Obiettivo: scrivere la sezione `## Microtask config` nel `CLAUDE.md` del progetto, così skill `/microtask-pipeline:microtask` e hook sanno come lavorare.

## 1. Stato attuale
- Cerca `CLAUDE.md` in root o `.claude/CLAUDE.md`.
- Sezione `## Microtask config` già presente → mostrala e chiedi se aggiornarla. No → STOP.
- Nessun `CLAUDE.md` → proponi di crearlo (solo intestazione + sezione config); consiglia `/init` di Claude Code per il resto.

## 2. Rileva (sola lettura)
| Chiave | Come rilevarla |
|---|---|
| `Build` | sezione **Commands** del CLAUDE.md; altrimenti `*.slnx`/`*.sln` → `dotnet build <file> -c Release`; `package.json` → script `build`; `pyproject.toml`/`Makefile`/`Cargo.toml`/`go.mod` → comando standard |
| `Test` | sezione **Commands**; altrimenti progetti `*.Tests*`/`*Test*` → `dotnet test <solution>` se tutti i progetti di test sono nella solution, altrimenti segnala quelli esclusi e proponi di aggiungerli; `package.json` → script `test`; `pytest`, `cargo test`, `go test ./...` |
| `Coverage` | opzionale. .NET con `Microsoft.NET.Test.Sdk` → `<Test> --collect "Code Coverage;Format=cobertura" --results-directory TestResults/coverage` (nessun pacchetto nuovo; `TestResults/` nel `.gitignore`); altri stack → comando che produce Cobertura XML, altrimenti ometti |
| `Watch dir` | `src/` se esiste, altrimenti cartella principale del codice |
| `Docs` | `README.md`, `CHANGELOG.md`, `docs/` — solo quelli esistenti |
| `Queue` | `TODO.md` |
| `Done` | opzionale: `DONE.md` se esiste, altrimenti ometti (task completati restano `[x]` in coda) |
| `Branch` | `outcome_yyyyMMdd-<Group>` (`<Group>` resta letterale: la skill lo sostituisce col gruppo eseguito) |
| `Language` | lingua di README/CHANGELOG esistenti; default English |
| `Social drafts` | opzionale: ometti (default `off`); `on` solo se l'utente vuole bozze di post social per le feature |

Verifica i comandi rilevati eseguendoli **solo se** innocui e veloci (build/test); altrimenti segnala "non verificato".

## 3. Proponi e conferma
Mostra la sezione completa pronta da incollare:
```markdown
## Microtask config
- Queue: TODO.md
- Done: DONE.md        # opzionale
- Branch: outcome_yyyyMMdd-<Group>
- Build: <comando>
- Test: <comando>
- Coverage: <comando>   # opzionale
- Watch dir: src
- Docs: README.md, CHANGELOG.md
- Language: English
```
**⏸ Attendi conferma o correzioni.** Poi aggiungila in fondo al `CLAUDE.md` (Edit, mai sovrascrivere il file).

## 4. Coda
File `Queue` inesistente o senza tabella coda → proponi di aggiungere:
```markdown
## Microtask queue

| Status | ID | Group | Type | Task |
|---|---|---|---|---|
| [ ] | T1 | G1 | code | <primo task> |
```
Tipi: `code` `analysis` `docs` `content`. Stati: `[ ]` `[/]` `[x]`.
**⏸ Attendi conferma** prima di scrivere.

## 5. Chiusura
Riepiloga file modificati e ricorda:
- da una roadmap ai task in coda: `/microtask-pipeline:plan <file roadmap>`;
- avvio pipeline: `/microtask-pipeline:microtask` (oppure `/microtask-pipeline:microtask <ID>`);
- l'hook Stop ora è attivo su `Watch dir`.
