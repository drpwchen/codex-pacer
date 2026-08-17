#!/bin/sh
# schedule-resume.sh — macOS/Linux one-shot resume after the active reset.
# Waits until primary.resets_at + 3 min, then runs `codex exec resume --last`
# driven by handoff.md. Survives the terminal closing (nohup), but not logout/
# reboot — for that, register the same command with `at`, cron, or launchd.
#
# Usage: ./schedule-resume.sh [/path/to/project-dir]
# Requires: handoff.md written in the state dir first; `codex` on PATH.
set -eu

DIR="${CODEX_PACER_DIR:-$HOME/.codex/codex-pacer}"
HANDOFF="$DIR/handoff.md"
LOG="$DIR/resume-log.txt"
WORKDIR="${1:-$PWD}"

[ -f "$HANDOFF" ] || { echo "Handoff file not found: $HANDOFF — write the resume instructions first." >&2; exit 1; }

RESETS_AT=$(python3 -c "import json;print(json.load(open('$DIR/limits.json'))['primary']['resets_at'])") \
  || { echo "No resets_at in $DIR/limits.json" >&2; exit 1; }
NOW=$(date +%s)
DELAY=$(( RESETS_AT + 180 - NOW ))
[ "$DELAY" -lt 0 ] && DELAY=0

PROMPT="Read $HANDOFF and continue that work, following its instructions exactly. \
When finished (or blocked), append a '## Result' section with the current date to that same handoff file \
summarizing what was done and what remains."

nohup sh -c "
  sleep $DELAY
  cd '$WORKDIR'
  echo \"=== \$(date '+%Y-%m-%d %H:%M:%S') resume fired ===\" >> '$LOG'
  codex exec resume --last \"$PROMPT\" >> '$LOG' 2>&1
  echo \"=== exit code: \$? ===\" >> '$LOG'
" >/dev/null 2>&1 &

echo "OK: resume armed in $(( DELAY / 60 )) min (reset + 3 min), workdir $WORKDIR"
echo "Handoff: $HANDOFF"
echo "Log:     $LOG"
