# codex-pacer

Usage status, a native budget-guard hook, and GO/PACE/STOP verdicts for Codex.

[繁體中文說明](README.zh-TW.md) · [Toolbox overview (blog)](https://drpwchen.com/posts/my-ai-toolbox/)

Try the rendering without installing anything: `node scripts/pacer.cjs --demo` (see Quickstart).

```text
7d ▓▓░░░░ 34%·3d2h │ Ctx 42% │ gpt-5.6-sol
```

This is a Codex port of [claude-pacer](https://github.com/drpwchen/claude-pacer). It keeps the reset arithmetic and pacing behavior, but uses Codex's own lifecycle hooks, transcript events, plugin data directory, and `codex exec resume` command.

## Requirements & cost

Node.js and Python 3 (stdlib only, no npm or pip packages), plus the Codex CLI. Works on Windows, macOS and Linux. The usage numbers come from the rate-limit data Codex writes into its own session transcripts, so you need a Codex plan that reports it. No accounts, no API keys, no network calls, free (MIT).

## Quickstart

```bash
git clone https://github.com/drpwchen/codex-pacer.git
cd codex-pacer
node scripts/pacer.cjs --demo
node scripts/pacer.cjs
python3 scripts/usage-verdict.py
```

On Windows, use `python` instead of `python3`. `--demo` prints a sample status line (window labels, usage bars, context, model). The last two commands read your most recent Codex session: the first prints the status line, the second prints GO / PACE / STOP and exits 0 / 1 / 2 (3 = NO-DATA, e.g. no Codex session found yet).

> 🧋 Saved you some time? [Buy me a drink](https://drpwchen.com/en/support/).

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

Useful flags:

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

## Limitations

- Not a TUI footer: Codex `tui.status_line` takes only built-in items, so `pacer.cjs` is a standalone command.
- Depends on Codex's transcript JSONL, which is not a stable public interface. If the format changes you get NO-DATA, not a guess.
- The guard injects pacing guidance into the model's context; it cannot force Codex to stop.
- Hooks must be trusted once via `/hooks`, and edits to plugin files only load after a `version` bump and re-install (see above).

## Related tools

[claude-pacer](https://github.com/drpwchen/claude-pacer) — the original for Claude Code.

## License

MIT. Derived from claude-pacer by Po-Wei Chen.

## Support 支持

If this tool helped you, you can [buy me a drink](https://drpwchen.com/en/support/) 🧋
覺得這個工具有幫助嗎？歡迎[請我喝飲料](https://drpwchen.com/support/)。
