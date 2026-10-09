---
name: plan
description: Trasforma un documento di roadmap in righe della coda microtask (Queue in CLAUDE.md): propone gruppi, ID, tipi e task con riferimento alla sezione, attende approvazione, poi le aggiunge in fondo alla coda.
disable-model-invocation: true
argument-hint: "<file roadmap> [--prefix R]"
---
# Roadmap → coda microtask

Questa skill **scrive solo la coda**: non esegue nessun task (quello lo fa `/microtask-pipeline:microtask`) e non tocca codice.

## Argomenti
- `<file roadmap>` (obbligatorio): un markdown qualsiasi (piano, spec, elenco puntato). Assente o non leggibile → dillo e fermati.
- `--prefix <lettera>` (opzionale): lettera degli ID, es. `R` → task `R0`, `R1`… e gruppi `RG0`, `RG1`…. Assente → prima lettera maiuscola non usata come iniziale di nessun ID in `Queue` e `Done`; gruppi `G<n>` dal primo numero libero.

## 1. Config
Leggi `## Microtask config` nel `CLAUDE.md` del progetto (`Queue`, default `TODO.md`; `Done`, opzionale). Sezione assente → STOP: "lancia prima `/microtask-pipeline:init`".

## 2. ID e gruppi esistenti
Raccogli tutti gli ID (colonna ID) e i gruppi (colonna Gruppo) già presenti in `Queue` **e** `Done`. I nuovi non devono sovrapporsi né tra loro né con quelli esistenti, e **nessun ID nuovo può coincidere con un nome di gruppo** (la pipeline cerca l'argomento in entrambe le colonne). `--prefix` già usato → continua la numerazione dal più alto esistente con quella lettera.

## 3. Lettura
Leggi **solo** il file roadmap, una volta. Niente codice, niente altri documenti, salvo un link esplicito del documento che serve a capire il perimetro di un task.

## 4. Scomposizione
- **Un gruppo per incremento o fase** del documento (un gruppo = un commit della pipeline). Documento senza fasi → gruppi da 3-6 task affini.
- **Un microtask per contratto o layer**: mai due progetti nello stesso task, mai due repository.
- **Tipo**: `analysis` per decisioni o punti aperti, `code` per codice e test, `docs` per documentazione, `content` per bozze.
- **Decisioni aperte prima**: se il documento ha punti aperti o domande, il primo gruppo è un task `analysis` che li chiude.
- **Task**: una riga, verbo all'imperativo, poi il riferimento alla sezione: `→ <percorso del file>#<slug dell'heading>`. Così la pipeline, eseguendo il task, legge solo quella sezione. Slug in stile GitHub (minuscolo, spazi → `-`, punteggiatura rimossa).
- **Ordine**: quello del documento (la pipeline prende il primo `[ ]` dall'alto). Dipendenza esplicita che lo contraddice → segui la dipendenza e annotalo.
- Lingua dei task: quella della conversazione.

## 5. Segnalazioni (prima della tabella)
- **Troppo grandi**: task che toccano più layer o progetti, con la divisione proposta (già applicata in tabella).
- **Altro repository**: task che appartengono a un repo diverso da quello corrente. **Non** vanno in tabella: elencali con il suggerimento di lanciare `plan` in quel repo.
- **Non convertiti**: parti del documento che non sono diventate task (contesto, decisioni già prese, punti fuori scope), una riga ciascuna, così si vede che non è sparito niente.

## 6. ⏸ GATE
Mostra, nella lingua della conversazione:
1. le segnalazioni;
2. la tabella proposta, nel formato della coda:
   ```markdown
   | Stato | ID | Gruppo | Tipo | Task |
   |---|---|---|---|---|
   | [ ] | R0 | RG0 | analysis | Decidere i punti aperti in un ADR → docs/plan.md#punti-aperti |
   ```
3. il riepilogo: numero di gruppi, task per tipo, file coda di destinazione.

Poi **una sola** `AskUserQuestion`: "Aggiungo questi task a `<Queue>`?" → `Aggiungi` / `Modifica` / `Annulla`.
- `Modifica` → chiedi cosa cambiare, applica, ripresenta tabella e domanda.
- `Annulla` → STOP, nessuna scrittura.

## 7. Scrittura
Solo dopo `Aggiungi`:
- righe **in fondo** alla tabella coda esistente, con Edit (mai riscrivere il file, mai riordinare righe esistenti);
- tabella assente → creala in fondo al file sotto `## Microtask queue` con l'intestazione `| Stato | ID | Gruppo | Tipo | Task |`;
- file `Queue` assente → crealo con quella sola sezione.
Rileggi il file e verifica che le righe preesistenti siano invariate.

## 8. Chiusura
Una riga con il comando per partire: `/microtask-pipeline:microtask <primo gruppo aggiunto> --manual`. Nessun commit: la coda entra nel commit del primo gruppo eseguito.
