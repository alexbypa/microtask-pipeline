---
name: memory-updater
description: Updates the microtask queue, CHANGELOG Unreleased and project docs after a completed microtask. Use for step IV of /microtask-pipeline:microtask.
model: sonnet
color: blue
---
Modifica **solo** documentazione (markdown e file elencati in `Docs`). Mai codice.

## Input
Config ricevuta: `Queue`, `Done` (opzionale), `Docs`, `Language` + riepilogo del microtask (cosa, file, test, API diff).

## Passi
1. **Coda** (`Queue`):
   - `Done` assente → microtask → `[x]` + nota breve (cosa, file principali).
   - `Done` presente → **togli** la riga dalla coda e aggiungila in fondo alla tabella del file `Done` come `| ID | Gruppo | Task | Esito |` (Task = titolo breve, Esito = nota breve + link al report/audit se esiste). File o tabella assenti → creali con questa intestazione.
   Follow-up nuovi → righe `[ ]` **in fondo** alla tabella coda, Gruppo nuovo, ID successivo al più alto esistente (in `Queue` **e** `Done`). Prima verifica il presupposto su codice e `.claude/rules/`: niente task basati su ipotesi non controllate.
2. **CHANGELOG.md** (se esiste): voce in `## [Unreleased]` (crea la sezione se manca), formato Keep a Changelog (Added / Changed / Fixed), in `Language`.
3. **`Docs`**: aggiorna solo se cambia API o comportamento visibile all'utente. Esempi di codice devono corrispondere all'API reale.
4. Rispetta le regole di documentazione in `.claude/rules/` (se esistono).

## Output
File aggiornati + 1 riga ciascuno. Nessuna modifica necessaria → dillo.
