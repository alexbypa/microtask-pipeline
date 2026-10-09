#!/usr/bin/env bash
# SessionStart hook (microtask-pipeline): se il progetto non ha "## Microtask config"
# nel CLAUDE.md, chiede a Claude di suggerire /microtask-pipeline:init. Altrimenti silenzio.
cat >/dev/null   # consuma l'input dell'hook (non serve)

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Nuova sessione (o /clear) = nessuna pipeline /microtask in corso: togli il cartello
# lasciato da una pipeline interrotta, così l'hook Stop doc-sync torna attivo.
cartella_git=$(git rev-parse --git-dir 2>/dev/null)
if [ -n "$cartella_git" ]; then
  rm -f "$cartella_git/microtask-active"
fi

for f in CLAUDE.md .claude/CLAUDE.md; do
  grep -q '^## Microtask config' "$f" 2>/dev/null && exit 0
done

cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"The microtask-pipeline plugin is installed in this project but not configured (no '## Microtask config' section in CLAUDE.md). In your first reply, briefly tell the user to run /microtask-pipeline:init to configure it. Mention it once, then continue with the user's request."}}
EOF
exit 0
