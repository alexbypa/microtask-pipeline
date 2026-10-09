#!/usr/bin/env bash
# =============================================================================
# Stop hook (microtask-pipeline)
#
# Claude Code esegue questo script ogni volta che Claude finisce un turno.
# Due possibili risposte:
#   - esce senza stampare nulla         → Claude può chiudere il turno
#   - stampa {"decision":"block",...}   → Claude deve prima lanciare doc-sync-reviewer
#
# Blocca solo se la cartella sorgente è cambiata dall'ultimo controllo documentazione.
#
# Uso manuale:  bash doc-sync-gate.sh --mark
#   → segna lo stato attuale del codice come "documentazione già verificata".
#     Lo lancia Claude a fine passo IV di /microtask, dopo doc-sync OK.
# =============================================================================

# --- 1. Modalità: --mark oppure controllo normale ---------------------------
modalita_mark=false
if [ "$1" = "--mark" ]; then
  modalita_mark=true
else
  dati_hook=$(cat)   # JSON che Claude Code passa all'hook
  # Claude sta già continuando per colpa di questo hook? Lascia chiudere (evita loop).
  if echo "$dati_hook" | grep -q '"stop_hook_active": *true'; then
    exit 0
  fi
fi

# --- 2. Siamo in un repository git del progetto? -----------------------------
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi
cartella_git=$(git rev-parse --git-dir)

# --- 3. Pipeline /microtask in corso? Allora non disturbare. -----------------
# /microtask crea questo file all'avvio e lo cancella a fine pipeline.
# Durante la pipeline il turno si chiude a ogni subagent in background:
# il controllo documentazione lo fa già il passo IV.
# Una nuova sessione cancella il file (config-check.sh), quindi non resta appeso.
cartello="$cartella_git/microtask-active"
if [ "$modalita_mark" = false ] && [ -f "$cartello" ]; then
  exit 0
fi

# --- 4. Il progetto usa la pipeline? -----------------------------------------
# Serve la sezione "## Microtask config" nel CLAUDE.md, altrimenti hook spento.
file_config=""
for candidato in CLAUDE.md .claude/CLAUDE.md; do
  if grep -q '^## Microtask config' "$candidato" 2>/dev/null; then
    file_config="$candidato"
    break
  fi
done
if [ -z "$file_config" ]; then
  exit 0
fi

# --- 5. Quale cartella sorvegliare ("- Watch dir: X", default src) -----------
sezione_config=$(awk '/^## Microtask config/ {dentro=1; next}  /^## / {dentro=0}  dentro' "$file_config")
cartella_sorgente=$(echo "$sezione_config" | sed -n 's/^[-*] *Watch dir: *//p' | head -1 | tr -d '`\r' | sed 's/[[:space:]]*$//')
if [ -z "$cartella_sorgente" ]; then
  cartella_sorgente="src"
fi

# --- 6. Ci sono modifiche nella cartella sorgente? ---------------------------
modifiche=$(git diff HEAD -- "$cartella_sorgente" 2>/dev/null)
file_nuovi=$(git ls-files --others --exclude-standard -- "$cartella_sorgente" 2>/dev/null)
stato_codice="$modifiche$file_nuovi"
if [ -z "$stato_codice" ]; then
  exit 0
fi

# --- 7. Questo stato del codice è già stato verificato? ----------------------
# Impronta (hash) delle modifiche: cambia se cambia anche un solo carattere.
impronta=$(printf '%s' "$stato_codice" | sha1sum | cut -d' ' -f1)
file_impronta="$cartella_git/microtask-doc-sync-last"

if [ "$modalita_mark" = true ]; then
  echo "$impronta" > "$file_impronta"   # segna come verificato
  exit 0
fi

if [ -f "$file_impronta" ] && [ "$(cat "$file_impronta")" = "$impronta" ]; then
  exit 0   # già verificato
fi

# Salva subito l'impronta: lo stesso stato non verrà bloccato una seconda volta.
echo "$impronta" > "$file_impronta"

# --- 8. Blocca: serve il controllo documentazione ----------------------------
echo "{\"decision\":\"block\",\"reason\":\"$cartella_sorgente/ changed since last doc check. Run the microtask-pipeline:doc-sync-reviewer subagent and show its report before finishing.\"}"
exit 0
