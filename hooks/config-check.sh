#!/usr/bin/env bash
# SessionStart hook (microtask-pipeline): if the project has no "## Microtask config"
# in CLAUDE.md, asks Claude to suggest /microtask-pipeline:init. Otherwise silent.
cat >/dev/null   # consume the hook input (not needed)

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# New session (or /clear) = no /microtask pipeline in progress: remove the marker
# left by an interrupted pipeline, so the doc-sync Stop hook becomes active again.
git_dir=$(git rev-parse --git-dir 2>/dev/null)
if [ -n "$git_dir" ]; then
  rm -f "$git_dir/microtask-active"
fi

for f in CLAUDE.md .claude/CLAUDE.md; do
  grep -q '^## Microtask config' "$f" 2>/dev/null && exit 0
done

cat <<'EOF'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"The microtask-pipeline plugin is installed in this project but not configured (no '## Microtask config' section in CLAUDE.md). In your first reply, briefly tell the user to run /microtask-pipeline:init to configure it. Mention it once, then continue with the user's request."}}
EOF
exit 0
