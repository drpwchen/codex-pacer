# codex-pacer

Usage status, a native budget-guard hook, and GO/PACE/STOP verdicts for Codex.

[繁體中文說明](README.zh-TW.md)

```text
7d ▓▓░░░░ 34%·3d2h │ Ctx 42% │ gpt-5.6-sol
```

This is a Codex port of [claude-pacer](https://github.com/drpwchen/claude-pacer). It keeps the reset arithmetic and pacing behavior, but uses Codex's own lifecycle hooks, transcript events, plugin data directory, and `codex exec resume` command.

## Components

- `scripts/pacer.cjs`: reads the latest Codex `token_count` event, prints quota/context status, and persists a snapshot.
- `scripts/budget-guard.cjs`: native `UserPromptSubmit` and `PostToolUse` hook that injects pacing guidance at 85% and 93%.
- `scripts/usage-verdict.py`: returns GO (0), PACE (1), STOP (2), or NO-DATA (3).
- `skills/codex-pacer/SKILL.md`: lets Codex invoke the status and verdict workflow when relevant.

No npm or pip dependencies are required. Node.js, Python 3, and Codex CLI are enough.

## Install as a local plugin

Place this directory at `<marketplace-root>/plugins/codex-pacer`, add a `codex-pacer` local-source entry to `<marketplace-root>/.agents/plugins/marketplace.json`, then run `codex plugin marketplace add <marketplace-root>` and `codex plugin add codex-pacer@<marketplace-name>`. Start a new Codex thread after installing, then run `/hooks` and trust the two plugin hooks.

Codex runs a version-keyed materialized copy of the plugin, not this directory. After editing any plugin file, bump the `version` in `.codex-plugin/plugin.json` and run `codex plugin add codex-pacer@<marketplace-name>` again, or your changes will never load; if `hooks/hooks.json` changed, also re-trust via `/hooks`.

## Run manually

```bash
node scripts/pacer.cjs
python3 scripts/usage-verdict.py
```

On Windows, use `python` instead of `python3`. Useful flags:

```bash
node scripts/pacer.cjs --json
node scripts/pacer.cjs --transcript /path/to/rollout.jsonl
node scripts/pacer.cjs --demo
python3 scripts/usage-verdict.py --json
```

State is stored in Codex's plugin data directory when installed, otherwise in `~/.codex/codex-pacer/`. Override it with `CODEX_PACER_DIR`.

## Codex differences

Codex `tui.status_line` accepts built-in item identifiers, not an external renderer command, so `pacer.cjs` is a standalone status command rather than a footer replacement. Codex plans may expose one or two windows with varying durations; labels come from each event's `window_minutes` instead of assuming fixed 5h/7d windows. Transcript JSONL is convenient but not a stable public hook interface, so parse failures degrade to NO-DATA without blocking Codex.

## Auto-resume

The optional scripts in `extras/` wait until the recorded reset, then run:

```bash
codex exec resume --last "Read handoff.md and continue the task."
```

## License

MIT. Derived from claude-pacer by Po-Wei Chen.
