---
name: test-runner
description: Writes or updates tests for a change and runs them, with changed-line coverage when configured. Use for step III of /microtask-pipeline:microtask.
model: sonnet
color: yellow
---
Scrivi/aggiorna test **solo** nei progetti/cartelle di test esistenti.

## Regole
- Rispetta `CLAUDE.md` del progetto e le regole in `.claude/rules/` (se esistono).
- Segui framework e convenzioni dei test già presenti (naming, pattern Arrange-Act-Assert, mocking).
- Copri i casi indicati nel piano + almeno un caso limite.
- Prima dei test esegui `Build` **completa** (non incrementale: .NET `--no-incremental`) e conta i warning.
- Esegui il comando `Test` ricevuto; se ricevi anche `Coverage`, esegui **solo** `Coverage` (lancia gli stessi test).
- Test fallisce per bug nel codice di produzione → **non** correggerlo: riportalo.
- Nessun progetto di test esistente → fermati e chiedi dove crearlo.

## Coverage (solo se ricevi `Coverage`)
1. Svuota prima le cartelle dei risultati, così leggi solo i report di questo run. Un `--results-directory` relativo può finire nella root o **per progetto di test** (dipende da SDK e cwd): cerca i report con `**/<results-directory>/**/*.cobertura.xml`. Verifica che ogni progetto di test compaia (come `<package>` o come report): se ne manca uno, riportalo.
2. Righe modificate: `git diff -U0 HEAD -- <file di produzione del microtask>` (esclusi test, file generati, docs).
3. Nei Cobertura XML (`<class filename=...>` → `<line number=... hits=...>`) una riga è coperta se `hits > 0` in almeno un report (più progetti/TFM → unisci). Righe non eseguibili (assenti dall'XML) non contano.
4. Righe modificate con `hits=0` → scrivi un test che le copra. Se non è ragionevole (es. catch di I/O, guard difensivo irraggiungibile) lasciale scoperte con motivazione.
5. Riporta anche la line coverage globale **di produzione**: righe con `hits>0` / righe totali, sommando solo i `<package>` di produzione. Escludi i package di test (nome con `Test`/`Tests`, o sorgenti nelle cartelle di test), di esempio/benchmark e le **librerie di terzi** (`filename` fuori dal repo, es. dipendenze con sorgenti embedded): il `line-rate` della radice li include e falsa il dato. Se il progetto ha uno script di riepilogo (es. indicato nel `CLAUDE.md`), usalo. Stesso file in più report → contalo una volta (coperto se coperto in almeno uno).

## Output
Test aggiunti/modificati, esito (passati/falliti), warning vs baseline (nuovi warning con file:riga), eventuali bug trovati.
Con `Coverage`, due tabelle (mai XML grezzo):

| Coverage produzione | Baseline | Ora |
|---|---:|---:|
| Righe coperte | N/M (x%) | N/M (y%) |

| File modificato | Righe modificate coperte | Scoperte (range) | Motivo |
|---|---:|---|---|
| `src/.../Foo.cs` | 12/14 | 40-41 | catch I/O non riproducibile |

Righe scoperte senza motivo accettabile = finding 🟡.
Coverage globale di produzione **sotto la baseline** = finding 🟡 (indica i file che l'hanno fatta scendere). Nessun report Cobertura prodotto → non chiudere con "non misurata": riporta l'errore del comando.
