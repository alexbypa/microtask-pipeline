#!/usr/bin/env bash
# =============================================================================
# Stop hook (microtask-pipeline)
#
# Claude Code runs this script every time Claude finishes a turn.
# Two possible responses:
#   - exits without printing anything   → Claude may end the turn
#   - prints {"decision":"block",...}   → Claude must first run doc-sync-reviewer
#
# Blocks only if the source folder changed since the last documentation check.
#
# Manual use:  bash doc-sync-gate.sh --mark
#   → marks the current code state as "documentation already verified".
#     Claude runs it at the end of step IV of /microtask, after doc-sync OK.
# =============================================================================

# --- 1. Mode: --mark or normal check -----------------------------------------
mark_mode=false
if [ "$1" = "--mark" ]; then
  mark_mode=true
else
  hook_data=$(cat)   # JSON that Claude Code passes to the hook
  # Is Claude already continuing because of this hook? Let it finish (avoids loops).
  if echo "$hook_data" | grep -q '"stop_hook_active": *true'; then
    exit 0
  fi
fi

# --- 2. Are we in the project's git repository? ------------------------------
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi
git_dir=$(git rev-parse --git-dir)

# --- 3. /microtask pipeline in progress? Then don't interfere. ---------------
# /microtask creates this file at startup and deletes it at the end of the pipeline.
# During the pipeline the turn ends at every background subagent:
# step IV already does the documentation check.
# A new session deletes the file (config-check.sh), so it is never left dangling.
marker="$git_dir/microtask-active"
if [ "$mark_mode" = false ] && [ -f "$marker" ]; then
  exit 0
fi

# --- 4. Does the project use the pipeline? -----------------------------------
# Requires the "## Microtask config" section in CLAUDE.md, otherwise the hook is off.
config_file=""
for candidate in CLAUDE.md .claude/CLAUDE.md; do
  if grep -q '^## Microtask config' "$candidate" 2>/dev/null; then
    config_file="$candidate"
    break
  fi
done
if [ -z "$config_file" ]; then
  exit 0
fi

# --- 5. Which folder to watch ("- Watch dir: X", default src) ----------------
config_section=$(awk '/^## Microtask config/ {inside=1; next}  /^## / {inside=0}  inside' "$config_file")
source_dir=$(echo "$config_section" | sed -n 's/^[-*] *Watch dir: *//p' | head -1 | tr -d '`\r' | sed 's/[[:space:]]*$//')
if [ -z "$source_dir" ]; then
  source_dir="src"
fi

# --- 6. Are there changes in the source folder? ------------------------------
changes=$(git diff HEAD -- "$source_dir" 2>/dev/null)
new_files=$(git ls-files --others --exclude-standard -- "$source_dir" 2>/dev/null)
code_state="$changes$new_files"
if [ -z "$code_state" ]; then
  exit 0
fi

# --- 7. Has this code state already been verified? ---------------------------
# Fingerprint (hash) of the changes: it changes if even a single character changes.
fingerprint=$(printf '%s' "$code_state" | sha1sum | cut -d' ' -f1)
fingerprint_file="$git_dir/microtask-doc-sync-last"

if [ "$mark_mode" = true ]; then
  echo "$fingerprint" > "$fingerprint_file"   # mark as verified
  exit 0
fi

if [ -f "$fingerprint_file" ] && [ "$(cat "$fingerprint_file")" = "$fingerprint" ]; then
  exit 0   # already verified
fi

# Save the fingerprint right away: the same state will not be blocked a second time.
echo "$fingerprint" > "$fingerprint_file"

# --- 8. Block: the documentation check is needed -----------------------------
echo "{\"decision\":\"block\",\"reason\":\"$source_dir/ changed since last doc check. Run the microtask-pipeline:doc-sync-reviewer subagent and show its report before finishing.\"}"
exit 0
