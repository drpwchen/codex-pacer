# Changelog

## [0.1.0] — 2026-08-17 — Codex port of claude-pacer, with a hardened budget-guard

- Port claude-pacer to Codex lifecycle hooks and plugin packaging.
- Read Codex `token_count` transcript events and support variable quota windows.
- Replace Claude headless continuation with `codex exec resume --last`.
- Keep the cached quota window when the newest `token_count` event carries no
  `rate_limits`. Preferring such an event both suppressed the warning and
  overwrote the last good snapshot, so the fallback was destroyed too; the
  previous window is now carried forward and marked so it never re-enters the
  history series as a fresh sample.
- Validate numbers instead of truthiness: a non-numeric `resets_at` used to reach
  the message as `NaN min (Invalid Date)`, and a non-numeric `rearm_min` in
  `config.json` made every re-arm comparison false, warning on every prompt.
- Tolerate a `guard-state.json` that is valid JSON but not an object (assigning to
  a primitive threw under strict mode and the warning was silently swallowed), and
  prune session entries untouched for over 24h so the file cannot grow unbounded.
- Windows: prefix the hook command with `cmd /c` so `%PLUGIN_ROOT%` expands. Codex
  runs hooks under PowerShell, which leaves the token literal — node then exits 1
  with MODULE_NOT_FOUND and the only symptom is an undiagnosable "hook Failed".
- Add `tests/test_guard.js`: 13 cases run the real hook as a child process with
  `CODEX_PACER_DIR` pointed at a temp dir, so live state is never touched.
