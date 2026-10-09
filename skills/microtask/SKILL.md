---
name: microtask
description: Esegue un gruppo (o un singolo microtask) della coda microtask (TODO.md) con pipeline multi-agent: baseline → analisi SOLID → implementazione (agent o tu, in mentoring) → test → review indipendente → docs → commit di gruppo; in modalità --auto anche push e pull request.
disable-model-invocation: true
argument-hint: "[ID task (A29) o gruppo (G0) — opzionale] [--auto | --manual] [--resume]"
---
# Pipeline microtask

## Configurazione (dal CLAUDE.md del progetto)
Cerca nel `CLAUDE.md` del progetto la sezione `## Microtask config`. Valori mancanti → default:

| Chiave | Default | Uso |
|---|---|---|
| `Queue` | `TODO.md` | File con la tabella coda |
| `Done` | *(assente → task completati restano `[x]` in coda)* | File archivio dei task completati: la riga si sposta qui da `Queue` |
| `Branch` | `outcome_yyyyMMdd-<Gruppo>` | Branch di lavoro: `yyyyMMdd` = data odierna, `<Gruppo>` = gruppo selezionato (es. `outcome_20261002-G0`) |
| `Build` | sezione **Commands** del CLAUDE.md | Comando build |
| `Test` | sezione **Commands** del CLAUDE.md | Comando/i test |
| `Coverage` | *(assente → nessuna coverage)* | Comando test che produce coverage Cobertura XML; se presente sostituisce `Test` in baseline e passo III |
| `Watch dir` | `src` | Cartella codice sorgente (usata anche dall'hook) |
| `Docs` | `README.md, CHANGELOG.md` | File documentazione da tenere allineati |
| `Language` | `English` | Lingua output esterni (codice, README, CHANGELOG, commit) |

Build o Test non trovati → chiedimeli una volta e proponi di aggiungerli al CLAUDE.md.

## Formato coda
Tabella nel file `Queue`:
`| Stato | ID | Gruppo | Tipo | Task |` — Stato: `[ ]` `[/]` `[x]` · Tipo: `code` `analysis` `docs` `content`.

## Regole
- Nella pipeline **un microtask alla volta**; **commit a fine gruppo**.
- Branch `Branch`, **prima della baseline** (dopo la selezione, così il gruppo è noto):
  - modifiche non committate nel working tree → STOP e chiedi (non mescolarle al gruppo). Eccezioni: i file `Queue` e `Done` (es. righe aggiunte da `/microtask-pipeline:plan` o il `[/]` della selezione) non contano ed entrano nel commit del gruppo; con `--resume` le modifiche sono il codice dell'utente, vedi "Ripresa";
  - branch esistente e **non** mergiato nel branch di default → `git switch` e riusalo;
  - altrimenti → `git fetch origin` e `git switch -c <Branch> origin/<branch di default>`; se il nome esiste già (mergiato) aggiungi `-2`, `-3`…
- Max **2 giri** review → fix per microtask, poi STOP e chiedi (vale anche quando i fix li fa l'utente, in mentoring).
- Mai pubblicare su servizi esterni (tranne la review LLM della PR, se attiva: il diff va al provider configurato): i task `content` e le bozze Reddit (`outcomes/reddit/`) restano bozze.
- Regole del progetto in `.claude/rules/` (se esistono) valgono per tutti gli agent: passale nei prompt.
- Report a me nella lingua della conversazione; output esterni in `Language`. Eccezione: body e commenti delle PR sono **sempre in italiano**, qualunque sia `Language` (titolo PR = prima riga del commit message, resta com'è; comandi, path, nomi di tipi/metodi e codice restano invariati).
- I subagent girano in background: mentre aspetti, chiudi il turno con **una riga** (passo in corso), niente riepiloghi intermedi.
- Marker pipeline: all'avvio `touch "$(git rev-parse --git-dir)/microtask-active"`; a ogni STOP (fine gruppo o blocco) `rm -f` dello stesso file. Col marker l'hook Stop doc-sync tace: doc-sync è già nel passo IV.

## Selezione
Da `$ARGUMENTS` (token separati da spazi; `--auto` / `--manual` sono la modalità, vedi sotto):

| Argomento | Cosa esegue |
|---|---|
| ID di un **task** (es. `A29`, colonna ID) | Solo quel microtask, poi "Fine gruppo" e STOP |
| ID di un **gruppo** (es. `G0`, colonna Gruppo) | Tutti i `[ ]` di quel gruppo, nell'ordine delle righe, poi "Fine gruppo" e STOP |
| nessuno | Primo `[ ]` **dall'alto** (posizione della riga, non nome del gruppo) → il suo Gruppo, come sopra |

ID non trovato, o gruppo senza `[ ]` → dillo e fermati. Segna `[/]` nella coda il microtask in corso.

`--resume` (con o senza ID) non seleziona righe `[ ]`: riprende il microtask `[/]` fermo in mentoring (vedi "Ripresa"). Senza ID → la riga `[/]` della coda; nessuna `[/]`, più di una, o `outcomes/microtask/<ID>-plan.md` assente → dillo e fermati.

## Introduzione (primo output, prima di qualsiasi domanda)
**Ordine di avvio obbligatorio:** selezione → introduzione → domanda "procedo?" → domanda implementatore (obbligatoria se il gruppo ha un task `code`) → domanda modalità (solo senza flag) → branch → baseline. Mai chiedere la modalità prima dell'introduzione. Con `--resume` niente introduzione né domande: vai a "Ripresa".

Fonti: righe della coda selezionate, codice che toccano (lettura veloce, niente agent), obiettivi del `CLAUDE.md` del progetto (es. sezione **Obiettivi**). Lingua della conversazione, frasi brevi, niente giri di parole. Usa **esattamente** questo formato (markdown, non un paragrafo unico):

```markdown
## <Gruppo> — <titolo breve>

### 1. Rischio sul codice: 🟢 Basso | 🟡 Medio | 🔴 Alto
<1-2 righe: perché (API pubblica, file centrali, assenza di test, CI/build toccati, possibili bug che emergono)>

### 2. Cosa faremo
| ID | Cosa cambia (in parole semplici) |
|---|---|
| <ID> | <una riga> |

### 3. Impatto su <obiettivo del CLAUDE.md, es. "download NuGet">: ⬆️ Alto | ↗️ Medio | ➖ Basso/nessuno
<2-3 righe concrete: cosa vede in più chi valuta o usa il pacchetto (affidabilità, feature, docs, badge, README…) e perché sposta l'obiettivo. Impatto indiretto (es. solo test) → dillo e spiega il legame.>

_Stima pre-analisi: il piano del passo I può correggerla._
```
Sezione 3 obbligatoria anche con impatto basso. `CLAUDE.md` senza obiettivi → "Impatto su chi usa il codice".

Subito dopo, **una sola** chiamata `AskUserQuestion` con le seguenti domande sequenziali:
1. "Procedo con <Gruppo>?" → `Procedi` / `Fermati` (Fermati → rimuovi `[/]`, STOP).
2. "Chi scrive il codice di produzione?" → `Io (mentoring)` / `Agent`. **Obbligatoria** se il gruppo ha almeno un task `code`: si fa sempre, anche in `--auto`, e nessuna config la salta (gruppi solo `analysis`/`docs`/`content` → niente domanda). Metti per prima, con `(consigliato)`, l'opzione suggerita dalla regola `.claude/rules/mentoring-mode.md` se il progetto ce l'ha, altrimenti da questi criteri: `Io (mentoring)` per feature e decisioni architetturali (nuovo file, interfaccia, endpoint, progetto, cambio di layer, area mai toccata dall'utente); `Agent` per fix su codice esistente, refactor meccanici, task sotto le 5 righe senza nuove astrazioni, config, docs. Nella descrizione dell'opzione consigliata, una riga sul perché. Vale per tutto il gruppo; i test li scrive sempre `test-runner`.
3. Solo senza `--auto`/`--manual`: "Modalità?" → `Manuale` / `Auto`, una riga ciascuna su cosa comporta (vedi sotto).
4. Solo senza `--manual` e se la review LLM è configurata: "Dopo la PR, chiedo a <modello @ host> una review pubblicata come commento? (vale solo in Auto)" → `Sì` / `No`.

Prima della `AskUserQuestion` lancia `node "${CLAUDE_PLUGIN_ROOT}/scripts/pr-review.mjs" --check` (legge l'ambiente e il `.env` del progetto, non stampa la chiave): exit 0 → configurata, la riga stampata dà `<modello @ host>` per la domanda 4; altrimenti niente domanda 4, review disattivata, e scrivi la riga stampata (`Review LLM non configurata: ...`).

## Modalità
- `--manual` → si ferma ai gate (⏸ GATE 1, ⏸ GATE 2) e attende la mia approvazione. Nessun push.
- `--auto` → nessuna attesa ai gate: decidi tu e annota nel report (`GATE n: auto-approvato` + motivo). A fine gruppo commit, push e pull request (passo 4 di "Fine gruppo"). In mentoring gli stop di II-user, dei fix review e dello Step 3 restano: senza codice e risposte dell'utente non si va avanti. La modalità è salvata nel piano e vale anche dopo `--resume`.
- Nessuno dei due → la modalità è la terza domanda dell'Introduzione.

**STOP anche in `--auto`** (fermati, spiega, attendi):
- 🔴 ancora presenti dopo i 2 giri review → fix;
- build o test rossi **non preesistenti** alla baseline;
- `implementer` o `test-runner` segnalano una modifica fuori piano o un bug di produzione;
- breaking change (piano I) o bump `major` suggerito (review V);
- push o `gh` falliscono (passo 4).

🟡 grande o fuori scope in `--auto`: niente STOP, diventa follow-up in coda (passo IV) e va nelle Note della PR.
Le richieste di permesso di Claude Code (es. `git push`, `gh pr create`) non dipendono dalla modalità: le governa il `settings.json` del progetto.

## Passi per tipo
| Tipo | Passi |
|---|---|
| `code` | 0 → I → ⏸G1 → II → III → V → IV |
| `code` in mentoring | 0 → I → ⏸G1 → II-user (⏸ STOP) · `--resume` → III → V → ⏸ Step 3 → IV |
| `analysis` | 0 → I → report in `outcomes/audits/<ID>.md` → IV |
| `docs` | I (solo impatto) → ⏸G1 → IV → doc-sync |
| `content` | bozza in `outcomes/content/<ID>.md` → ⏸G1 → IV |

**Corsia veloce** (solo `code`, se il piano I dice `Corsia: veloce`): II (solo con implementatore `Agent`; in mentoring resta II-user), III e IV li esegui **tu** senza subagent, con le stesse regole degli agent (build completa, conteggio warning, test verdi, coda/CHANGELOG/Docs). Restano agent: I (analisi) e V (review indipendente). Al GATE 1 mostra la corsia: io posso chiedere la completa.

### 0. Baseline (una volta per gruppo)
Esegui `Build` **completa** (non incrementale: .NET `--no-incremental`, altri stack clean prima) + `Test`, oppure **`Coverage` se configurato** (obbligatorio, anche in corsia veloce: mai `Test` al suo posto). Annota errori, **numero di warning**, fallimenti **preesistenti** (non sono regressioni) e, con `Coverage`, la **line coverage globale di produzione** (stesse regole di `test-runner`).
`Coverage` configurato ma nessun report Cobertura prodotto o leggibile → rilancia una volta; ancora niente → STOP (anche in `--auto`): senza baseline non si può confrontare.
Copertura: ogni progetto di test del repo deve essere eseguito da `Test` (.NET: ogni `*Tests*.csproj` nella solution usata, o elencato). Progetti esclusi → segnalali nel piano del GATE 1.

### I. Analisi → agent `microtask-pipeline:solid-analyst`
Passa: testo microtask, baseline, config. Ricevi: piano (spiegazione semplice se fix, file, SOLID, rischio, breaking, snapshot API pubblica, test).
**⏸ GATE 1:** se il microtask è un fix, mostra **prima** la "Spiegazione semplice" (problema → perché → come lo risolviamo), nella lingua della conversazione; poi il piano. Attendi approvazione.
Subito sotto il piano, **sempre** (anche in `--auto` e in corsia veloce), una riga da sola, fuori da tabelle ed elenchi:
- `Natura: feature` → `Bozza Reddit: la creo al passo IV (outcomes/reddit/<ID>.md)`
- altrimenti → `Il task <ID> non è una feature quindi non creo il documento per il post su reddit`
In `--auto`: mostra lo stesso testo e prosegui (salvo casi STOP). Spiegazione semplice e piano servono anche al body della PR.

### II. Implementazione → agent `microtask-pipeline:implementer`
Passa: piano approvato + comando `Build`. Riporta solo errori: la sua build è incrementale, i warning non sono affidabili.

### II-user. Mentoring: il codice lo scrive l'utente
Al posto dell'agent `implementer`. Il passo I ha già fatto lo "Step 1" di `mentoring-mode` (overview logica, nessun codice) ed è stato approvato al GATE 1.
1. **Step 2, firme.** Mostra **solo** le firme: interfacce, classi, record, metodi pubblici **senza body**, con il file in cui va ciascuna, e 2-4 righe su come si integrano nell'architettura esistente. Elenca i casi che `test-runner` coprirà. Niente implementazione, neanche parziale.
2. **Salva** `outcomes/microtask/<ID>-plan.md` (lingua della conversazione), unica fonte per la ripresa:
   - piano approvato del passo I (snapshot API pubblica, Corsia, Natura inclusi) e firme dello Step 2;
   - baseline del passo 0 (build, numero warning, test, fallimenti preesistenti, coverage se configurata) e `git rev-parse HEAD` su cui è stata presa;
   - Branch, modalità (`--auto`/`--manual`), scelta della review LLM;
   - sezione **Prossima sessione** (formato in "Fine gruppo") con comando `/microtask-pipeline:microtask <ID> --resume`.
3. **⏸ STOP** (anche in `--auto`): chiedi all'utente di sfidare il design e poi di scrivere il codice; mostra il comando di ripresa. Rimuovi il marker pipeline; la riga resta `[/]`. Se l'utente cambia le firme, aggiorna `<ID>-plan.md` prima di fermarti.

Altri microtask `code` nello stesso gruppo: ognuno si ferma al proprio II-user dopo il `--resume` del precedente; i microtask `analysis`/`docs`/`content` del gruppo si eseguono dopo l'ultimo, prima di "Fine gruppo".

### Ripresa (`--resume`)
1. Leggi **solo** `outcomes/microtask/<ID>-plan.md`, la riga di coda e i file cambiati: niente nuova analisi.
2. `touch` del marker pipeline; `git switch` sul Branch salvato se serve.
3. `git status --short`: le modifiche non committate sono il codice dell'utente, nessuno STOP. File fuori dal piano → elencali e chiedi se includerli (in `--auto`: escludili e annotalo).
4. HEAD diverso da quello salvato (es. merge del branch di default) → avvisa che la baseline potrebbe non essere più confrontabile e proponi di rifarla con `git stash` → passo 0 → `git stash pop` (in `--auto`: rifalla).
5. Prosegui da dove si era fermato (III dopo II-user, III e V dopo un giro di fix) con baseline e snapshot API salvati.

### III. Test → agent `microtask-pipeline:test-runner`
Passa: piano + riepilogo implementer (in mentoring: file cambiati dall'utente, da `git status --short`) + comandi `Build`/`Test`/`Coverage` + warning della baseline. Deve chiudere verde, con build completa e confronto warning (nuovi warning = finding).
Con `Coverage` (obbligatorio anche in corsia veloce):
- righe di produzione modificate e non coperte = finding 🟡, gestito come i findings di V (salvo motivazione "non testabile" accettata al GATE 2);
- **mai peggiorare**: coverage globale di produzione sotto la baseline = finding 🟡, stessa gestione;
- coverage mancante a fine passo = errore, non `n/a`: rilancia `Coverage`.

### V. Review → agent `microtask-pipeline:reviewer`
Passa: snapshot API del passo I (**non** il piano). Ricevi: problemi + diff API + bump suggerito.
Gestione findings:

| Gravità | Azione |
|---|---|
| 🔴 | Torna a II con i findings (max 2 giri) |
| 🟡 piccolo: ≤10 righe, file già toccati dal microtask, nessun cambio API | Corretto nello stesso giro dei 🔴 (nessun 🔴 → un giro solo per loro, conta nei 2) |
| 🟡 grande o fuori scope | Proposto al GATE 2; se rifiutato → follow-up in coda (passo IV) |
| ⚪ | Solo nel report, nessuna azione |

Dopo ogni giro di fix → rilancia III (build completa + test) prima di chiudere.

In mentoring i fix dei 🔴 e dei 🟡 piccoli li fa l'utente: mostra i findings con `file:riga` e il fix proposto **a parole** (niente codice), annotali in `<ID>-plan.md` con il numero del giro, rimuovi il marker pipeline, poi ⏸ STOP con `/microtask-pipeline:microtask <ID> --resume`.

### Step 3. Domande da Senior (solo mentoring)
Dopo V senza 🔴: 4-5 domande da Senior .NET Developer sul codice scritto dall'utente (trade-off, GC e allocazioni, performance, concorrenza, edge case), ognuna ancorata a `file:riga`. ⏸ Attendi le risposte (anche in `--auto`), poi commentale in 1-2 righe ciascuna. Domande, risposte e commenti vanno in `<ID>-plan.md` sotto `## Step 3`. Poi passo IV.

### IV. Memoria → agent `microtask-pipeline:memory-updater`, poi `microtask-pipeline:doc-sync-reviewer`
Passa: config (`Queue`, `Done`, `Docs`, `Language`) + findings rimandati da trasformare in follow-up. Aggiorna coda (`[x]` + nota, oppure riga spostata in `Done`), CHANGELOG `## [Unreleased]`, `Docs`.
Solo `code` con piano I `Natura: feature` → **in parallelo** a `memory-updater` lancia l'agent `microtask-pipeline:reddit-writer` (anche in corsia veloce). Passa: ID e testo microtask, Obiettivo e piano I, riepiloghi di implementer e test-runner, diff API di V. Scrive solo la bozza inglese `outcomes/reddit/<ID>.md`, mai pubblicata; entra nel commit del gruppo. Errore dell'agent → annotalo nel report, nessuno STOP.
Ogni altro microtask (Natura `fix`/`altro`, o Tipo diverso da `code`) → niente agent; la riga `Il task <ID> non è una feature quindi non creo il documento per il post su reddit` è già al GATE 1 (Tipo senza passo I: scrivila qui) e torna al GATE 2.
Dopo doc-sync OK: `bash "${CLAUDE_PLUGIN_ROOT}/hooks/doc-sync-gate.sh" --mark` (evita che l'hook Stop lo rilanci).

## Fine gruppo
1. **Report** in `outcomes/microtask/<yyyy-MM-dd>-<Gruppo>.md` (lingua della conversazione):
   - baseline → finale (build, warning, test; con `Coverage`: line coverage globale e righe modificate coperte N/M);
   - per microtask: fatto, decisioni ai gate, deviazioni dal piano;
   - findings review: risolti / rimandati;
   - task follow-up aggiunti alla coda;
   - bozze Reddit: create (`outcomes/reddit/<ID>.md`), oppure le righe "non è una feature" del GATE 2;
   - da verificare dopo (es. CI al primo push);
   - bump suggerito;
   - in mentoring: link a `outcomes/microtask/<ID>-plan.md` per microtask;
   - **Prossima sessione**, ultima sezione, sempre, autosufficiente per ripartire a contesto vuoto:
     ```markdown
     ## Prossima sessione
     - **Comando:** /microtask-pipeline:microtask <prossimo ID o gruppo> --manual
     - **Prossimo in coda:** <ID> — <task> (<tipo>)
     - **Decisioni da portarsi dietro:** <dai gate e dallo Step 3, max 3 righe>
     - **Follow-up aperti:** <ID aggiunti in coda>
     - **Da leggere prima:** <file del perimetro del prossimo task, se noti>
     ```
     Coda vuota → `**Comando:** nessuno, coda esaurita`.
2. **File del commit**: elenco esplicito dei file toccati dal gruppo (dai riepiloghi dei passi + coda, `Done`, CHANGELOG, Docs, report, bozze Reddit, `<ID>-plan.md` in mentoring). Confrontalo con `git status --short`: il resto va in "esclusi".
3. **⏸ GATE 2:** mostra `git diff --stat -- <file del commit>` + i file nuovi (non compaiono nel diff), i file esclusi, link al report, bump suggerito, commit message (conventional, in `Language`). Poi, **sempre**, una riga per microtask, da sola: `Bozza Reddit: outcomes/reddit/<ID>.md` oppure `Il task <ID> non è una feature quindi non creo il documento per il post su reddit`; se nessun microtask del gruppo è una feature, anche `Il gruppo <Gruppo> non è una feature quindi non creo il documento per il post su reddit`. Il gruppo tocca CI o build (workflow, solution/progetti, props) → aggiungi `⚠ CI non verificata: controllare la prima esecuzione dopo il push`. Il report entra nel commit del gruppo. Commit solo dopo conferma, con `git add -- <file del commit>` (mai `git add -A` / `git add .`). Poi STOP.
   In `--auto`: mostra lo stesso riepilogo, fai il commit senza attendere e passa al punto 4.
4. **PR** (solo `--auto`):
   - Mai push su `main`/`master`: se sei lì, STOP.
   - `git push -u origin <branch>`.
   - PR già aperta per il branch (`gh pr view --json number,url,state`) → aggiungi il body come commento (`gh pr comment`), in italiano. Altrimenti `gh pr create --base <branch di default> --title "<prima riga del commit message>" --body-file <file temporaneo>`, poi, con il numero della PR ora noto, completa i link ai file nel body e `gh pr edit <n> --body-file <file temporaneo>`.
   - `gh` assente/non autenticato o push rifiutato → STOP con il comando da lanciare a mano; il commit resta locale.
   - Mostra il link della PR.
   - Review LLM (solo se scelta `Sì` all'avvio): `node "${CLAUDE_PLUGIN_ROOT}/scripts/pr-review.mjs" <n>`. Pubblica un commento sulla PR. Errore (es. `PR_REVIEW_API_KEY` mancante, HTTP 429 anche dopo i tentativi, API non raggiungibile) → riporta a me in chat la riga `Review LLM fallita (...)` stampata dallo script, senza modificare il report di gruppo (che è già stato committato), nessuno STOP aggiuntivo.
   - STOP.

### Body della PR
Un **report** che spiega il lavoro a chi non l'ha seguito, **sempre in italiano** (indipendente da `Language`), frasi brevi; intestazioni ed etichette sono quelle italiane dell'esempio. Fonti: report di gruppo, Spiegazione semplice e piano del passo I, riepiloghi di implementer e test-runner.

```markdown
## <Gruppo> — <titolo breve>

### ⚠ Modifiche di comportamento
- <cosa cambia per chi usa il codice: prima → ora>

<details><summary><b><ID></b> — <problema in una riga></summary>

**Problema:** <cosa succedeva, esempio concreto>          ← fix
**Impatto:** <cosa comportava per l'utente/chiamante>     ← fix
**Obiettivo:** <cosa aggiunge e perché>                        ← feature / non-fix

**Cosa abbiamo fatto:** <2-3 frasi semplici: come funziona ora e cosa vede chi usa il codice>

| File | Cosa è cambiato | Perché |
|---|---|---|
| [`<nome file>`](https://github.com/<owner>/<repo>/pull/<n>/changes#diff-<sha256 del percorso>) | <modifica in poche parole> | <motivo> |

</details>

## Verifica
| | Baseline | Ora |
|---|---:|---:|
| Warning | M | N |
| Test superati | X | Y |
| Coverage (produzione) | a% | b% |

## Note
- Follow-up aggiunto: <ID> — <titolo>
- Bozza Reddit: `outcomes/reddit/<ID>.md` (solo feature)
- Bump suggerito: patch | minor | major (<motivo>)
- ⚠ CI non verificata (solo se il gruppo tocca CI/build)
```
Regole:
- Un blocco `<details>` per microtask del gruppo: su GitHub resta chiuso e mostra solo ID e problema, si apre al click.
- "Cosa abbiamo fatto": spiega la soluzione a chi non conosce il codice (come si comporta ora, non quali righe cambiano). Sempre presente, anche per le feature.
- Tabella file: **ogni** file del commit toccato da quel microtask (test inclusi), una riga ciascuno. Coda, `Done`, CHANGELOG e report di gruppo vanno solo in Note, se servono.
- Link ai file: il nome è un link al suo diff nella PR. `<owner>/<repo>` da `gh repo view --json nameWithOwner`; ancora = SHA-256 del percorso relativo alla root del repo, es. `printf '%s' "src/Foo/Bar.cs" | sha256sum`. Il numero `<n>` si conosce solo dopo `gh pr create`: vedi passo 4.
- **Niente codice né diff**: sono già nel tab "Files changed". Nomi di metodi/tipi tra backtick sì.
- "Modifiche di comportamento": ogni cambio visibile a chi usa il codice (eccezioni, valori di ritorno, config letta, API). Assenti → ometti la sezione. Presenti → il bump suggerito ne tiene conto.
- Riga Coverage solo se `Coverage` è configurato (allora è sempre valorizzata, vedi passo 0 e III). Sezioni vuote → omettile.

## Esempi di invocazione
- `/microtask-pipeline:microtask` → prossimo gruppo, chiede la modalità
- `/microtask-pipeline:microtask G0 --auto` → tutto G0, poi commit + push + PR
- `/microtask-pipeline:microtask A29 --manual` → solo A29, con i gate
- `/microtask-pipeline:microtask A29 --resume` → riprende A29 dopo che hai scritto il codice (mentoring)

## Esempio sezione CLAUDE.md
```markdown
## Microtask config
- Queue: TODO.md
- Done: DONE.md
- Branch: outcome_yyyyMMdd-<Gruppo>
- Build: dotnet build src/MySolution.slnx -c Release
- Test: dotnet test src/MyProject.Tests
- Coverage: dotnet test src/MySolution.slnx -c Release --collect "Code Coverage;Format=cobertura" --results-directory TestResults/coverage
- Watch dir: src
- Docs: README.md, CHANGELOG.md, docs/
```
