---
name: codex-pacer
description: Inspect Codex subscription usage and context headroom, return a GO/PACE/STOP verdict, and prepare safe continuation after a rate-limit reset. Use when the user asks about Codex quota, usage limits, remaining runway, pacing multi-agent work, avoiding a cap, or resuming long work after reset.
---

# Codex Pacer

Use the plugin scripts through `$PLUGIN_ROOT`.

1. Refresh and display the latest snapshot with `node "$PLUGIN_ROOT/scripts/pacer.cjs"`.
2. Use `python "$PLUGIN_ROOT/scripts/usage-verdict.py"` on Windows or `python3 "$PLUGIN_ROOT/scripts/usage-verdict.py"` on macOS/Linux before starting another large or multi-agent wave.
3. Treat exit code 0 as GO, 1 as PACE, 2 as STOP, and 3 as unknown.
4. On STOP, finish the current atomic step, save a clean checkpoint, and avoid new work.
5. For unattended continuation, write `handoff.md` in the plugin data directory and schedule `codex exec resume --last` a few minutes after `reset_at`.

Do not infer a fixed five-hour or seven-day policy. Codex supplies the active window duration in its session events, and plans can expose different windows.
