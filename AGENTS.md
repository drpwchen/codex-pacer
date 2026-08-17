# Codex Pacer development notes

- Keep runtime dependency-free: Node.js CommonJS and Python stdlib only.
- Treat Codex transcript JSONL as unstable input. Ignore unknown events and fail to NO-DATA without interrupting Codex.
- Hook output must use `hookSpecificOutput.additionalContext` and the incoming event name.
- Do not assume fixed 5h/7d windows; derive labels and reset arithmetic from `window_minutes` and `resets_at`.
- Keep Windows, macOS, and Linux commands working.
- Verify with the plugin and skill validators, `node scripts/pacer.cjs --demo`, a synthetic transcript, and synthetic hook stdin.
