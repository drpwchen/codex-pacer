'use strict';
const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || process.env.USERPROFILE;
const DIR = process.env.CODEX_PACER_DIR || process.env.PLUGIN_DATA || path.join(HOME, '.codex', 'codex-pacer');
const LIMITS_FILE = path.join(DIR, 'limits.json');
const HISTORY_FILE = path.join(DIR, 'limits-history.jsonl');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function latestTokenEvent(transcriptPath) {
  if (!transcriptPath) return null;
  let text;
  try { text = fs.readFileSync(transcriptPath, 'utf8'); } catch { return null; }
  const lines = text.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"token_count"')) continue;
    let obj; try { obj = JSON.parse(lines[i]); } catch { continue; }
    const payload = obj && obj.type === 'event_msg' && obj.payload;
    if (payload && payload.type === 'token_count') return { timestamp: obj.timestamp, payload };
  }
  return null;
}

function normalizeWindow(win, fallbackLabel) {
  // resets_at used to be checked for truthiness only, so a non-numeric value passed
  // through and every downstream calculation became NaN — the guard then warned with
  // "resets in NaN min (Invalid Date)" instead of staying quiet.
  if (!win || typeof win.used_percent !== 'number' || !Number.isFinite(win.used_percent)) return null;
  const resetsAt = Number(win.resets_at);
  if (!Number.isFinite(resetsAt) || resetsAt <= 0) return null;
  const mins = Number(win.window_minutes) || 0;
  const label = mins === 300 ? '5h' : mins === 10080 ? '7d' : mins && mins % 1440 === 0
    ? `${mins / 1440}d` : mins && mins % 60 === 0 ? `${mins / 60}h` : fallbackLabel;
  return { label, used_percentage: win.used_percent, resets_at: resetsAt, window_minutes: mins };
}

function snapshotFromTranscript(transcriptPath, model) {
  const event = latestTokenEvent(transcriptPath);
  if (!event) return null;
  const rl = event.payload.rate_limits || {};
  const info = event.payload.info || {};
  const primary = normalizeWindow(rl.primary, 'primary');
  const secondary = normalizeWindow(rl.secondary, 'secondary');
  const total = info.total_token_usage || {};
  const contextSize = Number(info.model_context_window) || null;
  const contextUsed = Number(total.input_tokens) || 0;
  return {
    ts: Date.parse(event.timestamp) || Date.now(),
    primary, secondary,
    context: contextSize ? { used_percentage: 100 * contextUsed / contextSize, used_tokens: contextUsed, size: contextSize } : null,
    model: model || null,
    plan_type: rl.plan_type || null,
    limit_id: rl.limit_id || null
  };
}

function persist(snapshot) {
  if (!snapshot) return;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    // Not every token_count event carries rate_limits, so snapshot.primary is
    // legitimately null much of the time. Writing that verbatim erased the last
    // known quota window and left the guard with no fallback at all — carry the
    // previous window forward instead. A carried-over window that has since
    // expired is harmless: the guard's own resets_at check drops it.
    if (!snapshot.primary) {
      const prev = readJson(LIMITS_FILE);
      if (prev && prev.primary) {
        snapshot = Object.assign({}, snapshot, {
          primary: prev.primary,
          secondary: snapshot.secondary || prev.secondary || null,
          carried_from_ts: prev.ts || null
        });
      }
    }
    fs.writeFileSync(LIMITS_FILE, JSON.stringify(snapshot));
    const w = snapshot.primary;
    // Only real, freshly-observed windows belong in the history series — appending a
    // carried-over one would restate an old reading as a new sample.
    if (!w || snapshot.carried_from_ts) return;
    let stale = true;
    try { stale = Date.now() - fs.statSync(HISTORY_FILE).mtimeMs > 120000; } catch {}
    if (stale) fs.appendFileSync(HISTORY_FILE, JSON.stringify({ ts: Date.now(), pct: w.used_percentage, resets_at: w.resets_at }) + '\n');
  } catch {}
}

module.exports = { DIR, LIMITS_FILE, HISTORY_FILE, readJson, latestTokenEvent, snapshotFromTranscript, persist };
