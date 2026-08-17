# codex-pacer

Codex 用量狀態、原生額度警戒 hook，以及 GO／PACE／STOP 配速判定。

這是 [claude-pacer](https://github.com/drpwchen/claude-pacer) 的 Codex 移植版。核心的重置時間判斷與配速邏輯保留，但整合層改用 Codex lifecycle hooks、session transcript 事件、plugin data 目錄與 `codex exec resume`。

## 安裝

把本目錄放入本機 Codex marketplace 後安裝 plugin。安裝完成請開新對話，執行 `/hooks`，檢查並信任兩個 hook。

Codex 實際執行的是依版本號快取的複本，不是本目錄。之後改任何 plugin 檔案，都要先在 `.codex-plugin/plugin.json` 調升 `version`，再跑一次 `codex plugin add`，改動才會生效；若 `hooks/hooks.json` 有變，還要在 `/hooks` 重新信任。

手動執行：

```bash
node scripts/pacer.cjs
python3 scripts/usage-verdict.py
```

Windows 請把 `python3` 換成 `python`。`pacer.cjs --json` 可輸出機器可讀資料，`--demo` 可預覽顯示。

## 三個部分

- `pacer.cjs`：讀取 Codex 最新的 `token_count` 事件，顯示額度、重置時間與 context 使用率。
- `budget-guard.cjs`：掛在 `UserPromptSubmit` 與 `PostToolUse`，85% 開始收斂，93% 要求乾淨收尾。
- `usage-verdict.py`：輸出 GO（0）、PACE（1）、STOP（2）或 NO-DATA（3）。

Codex 的 `tui.status_line` 目前只接受內建欄位名稱，不能掛外部 renderer，因此本工具提供獨立 status 指令，不取代 TUI footer。Codex 方案可能只提供一個 window，時長也不一定是 5h／7d，所以顯示名稱會依事件中的 `window_minutes` 自動產生。

安裝後狀態放在 plugin data 目錄；直接執行時預設為 `~/.codex/codex-pacer/`，可用 `CODEX_PACER_DIR` 覆寫。

授權：MIT；衍生自 Po-Wei Chen 的 claude-pacer。
