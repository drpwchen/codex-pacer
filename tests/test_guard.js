// Isolated tests for budget-guard. Runs the real hook as a child process with
// CODEX_PACER_DIR pointed at a throwaway dir, so the live limits.json /
// guard-state.json are never touched. Run: node tests/test_guard.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const GUARD = path.join(__dirname, '..', 'scripts', 'budget-guard.cjs');
let pass = 0, fail = 0;

function tmpdir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pacer-test-'));
  return d;
}

// A token_count event. rate_limits omitted entirely when `limits` is null.
function transcript(dir, limits) {
  const payload = { type: 'token_count', info: { model_context_window: 400000, total_token_usage: { input_tokens: 1000 } } };
  if (limits) payload.rate_limits = limits;
  const line = JSON.stringify({ type: 'event_msg', timestamp: new Date().toISOString(), payload });
  const f = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(f, line + '\n');
  return f;
}

function run(dir, input) {
  const out = execFileSync('node', [GUARD], {
    input: JSON.stringify(input),
    env: Object.assign({}, process.env, { CODEX_PACER_DIR: dir }),
    encoding: 'utf8'
  });
  return out.trim();
}

function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`); }
}

const future = Math.floor(Date.now() / 1000) + 3600; // resets in 60 min
// Raw shape, as it appears inside a token_count event's rate_limits.
const hotWindow = { used_percent: 96, resets_at: future, window_minutes: 300 };
// Normalized shape, as persist() writes it into limits.json — the two differ
// (`used_percent` vs `used_percentage`), which is exactly what a cache fixture must honour.
const hotCached = { label: '5h', used_percentage: 96, resets_at: future, window_minutes: 300 };

console.log('\n1. partial event must not suppress a warning from cache (the real bug)');
{
  const d = tmpdir();
  fs.writeFileSync(path.join(d, 'limits.json'), JSON.stringify({ ts: Date.now(), primary: hotCached }));
  const t = transcript(d, null); // newest event has NO rate_limits
  const out = run(d, { session_id: 's1', transcript_path: t, hook_event_name: 'UserPromptSubmit' });
  check('warns from cached window', out.includes('96%'), `output=${out || '(empty)'}`);
  const after = JSON.parse(fs.readFileSync(path.join(d, 'limits.json'), 'utf8'));
  check('cached primary survives persist', !!(after.primary && after.primary.used_percentage === 96),
        `primary=${JSON.stringify(after.primary)}`);
}

console.log('\n2. non-numeric resets_at must be rejected, not turned into NaN text');
{
  const d = tmpdir();
  const t = transcript(d, { primary: { used_percent: 96, resets_at: 'not-a-number', window_minutes: 300 } });
  const out = run(d, { session_id: 's2', transcript_path: t, hook_event_name: 'UserPromptSubmit' });
  check('stays silent', out === '', `output=${out}`);
  check('no NaN / Invalid Date leaked', !/NaN|Invalid Date/.test(out), `output=${out}`);
}

console.log('\n3. malformed guard-state.json must not swallow the warning');
{
  const d = tmpdir();
  fs.writeFileSync(path.join(d, 'guard-state.json'), JSON.stringify('bad-shape'));
  const t = transcript(d, { primary: hotWindow });
  const out = run(d, { session_id: 's3', transcript_path: t, hook_event_name: 'UserPromptSubmit' });
  check('still warns', out.includes('96%'), `output=${out || '(empty)'}`);
}

console.log('\n4. non-numeric rearm_min must fall back to the default, not spam');
{
  const d = tmpdir();
  fs.writeFileSync(path.join(d, 'config.json'), JSON.stringify({ guard: { rearm_min: 'bad' } }));
  const t = transcript(d, { primary: hotWindow });
  const first = run(d, { session_id: 's4', transcript_path: t, hook_event_name: 'UserPromptSubmit' });
  const second = run(d, { session_id: 's4', transcript_path: t, hook_event_name: 'UserPromptSubmit' });
  check('first call warns', first.includes('96%'), `output=${first || '(empty)'}`);
  check('immediate second call is re-armed away', second === '', `output=${second}`);
}

console.log('\n5. stale session entries get pruned');
{
  const d = tmpdir();
  const old = Date.now() - 3 * 86400000;
  fs.writeFileSync(path.join(d, 'guard-state.json'),
    JSON.stringify({ sessions: { ancient: { hard: old }, alsoAncient: { soft: old } } }));
  const t = transcript(d, { primary: hotWindow });
  run(d, { session_id: 'fresh', transcript_path: t, hook_event_name: 'UserPromptSubmit' });
  const st = JSON.parse(fs.readFileSync(path.join(d, 'guard-state.json'), 'utf8'));
  check('old sessions removed', !st.sessions.ancient && !st.sessions.alsoAncient,
        `sessions=${Object.keys(st.sessions)}`);
  check('current session kept', !!st.sessions.fresh, `sessions=${Object.keys(st.sessions)}`);
}

console.log('\n6. regression: normal fresh window still warns, and below threshold stays quiet');
{
  const d = tmpdir();
  const t = transcript(d, { primary: hotWindow });
  const out = run(d, { session_id: 's6', transcript_path: t, hook_event_name: 'UserPromptSubmit' });
  check('hard warning emitted', out.includes('96%') && out.includes('hookSpecificOutput'), `output=${out || '(empty)'}`);

  const d2 = tmpdir();
  const t2 = transcript(d2, { primary: { used_percent: 40, resets_at: future, window_minutes: 300 } });
  const quiet = run(d2, { session_id: 's6b', transcript_path: t2, hook_event_name: 'UserPromptSubmit' });
  check('40% stays quiet', quiet === '', `output=${quiet}`);
}

console.log('\n7. regression: history gets a real sample but never a carried-over one');
{
  const d = tmpdir();
  const t = transcript(d, { primary: hotWindow });
  run(d, { session_id: 's7', transcript_path: t, hook_event_name: 'UserPromptSubmit' });
  const h1 = fs.existsSync(path.join(d, 'limits-history.jsonl'))
    ? fs.readFileSync(path.join(d, 'limits-history.jsonl'), 'utf8').trim().split('\n').length : 0;
  check('real window appended to history', h1 === 1, `lines=${h1}`);

  // Now a partial event: primary is carried forward, but must NOT add a history sample.
  fs.writeFileSync(path.join(d, 'limits-history.jsonl'), '');           // reset marker
  const oldMtime = new Date(Date.now() - 600000);
  fs.utimesSync(path.join(d, 'limits-history.jsonl'), oldMtime, oldMtime); // make it "stale" so append would fire
  const t2 = transcript(d, null);
  run(d, { session_id: 's7', transcript_path: t2, hook_event_name: 'UserPromptSubmit' });
  const h2 = fs.readFileSync(path.join(d, 'limits-history.jsonl'), 'utf8').trim();
  check('carried-over window not appended', h2 === '', `history=${h2}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
