#!/usr/bin/env python3
import argparse, datetime, json, os, sys, time

p=argparse.ArgumentParser(); p.add_argument('--json',action='store_true'); p.add_argument('--dir'); a=p.parse_args()
home=os.path.expanduser('~'); state=a.dir or os.getenv('CODEX_PACER_DIR') or os.getenv('PLUGIN_DATA') or os.path.join(home,'.codex','codex-pacer')
try:
    d=json.load(open(os.path.join(state,'limits.json'),encoding='utf-8'))
except Exception:
    print('NO-DATA: run `node statusline.cjs` after a Codex turn.'); sys.exit(3)
w=d.get('primary') or {}; pct=w.get('used_percentage'); reset=w.get('resets_at'); label=w.get('label','limit')
if pct is None or not reset: print('NO-DATA: the latest Codex event has no active rate-limit window.'); sys.exit(3)
now=time.time(); left=max(0,int((reset-now)/60)); clock=datetime.datetime.fromtimestamp(reset).strftime('%H:%M')
cfg={'soft_pct':85,'hard_pct':93,'near_reset_min':20}
try: cfg.update(json.load(open(os.path.join(state,'config.json'),encoding='utf-8')).get('guard',{}))
except Exception: pass
if now>=reset: verdict,code,why='GO',0,'the saved window has reset; the old percentage is stale'
elif pct>=cfg['hard_pct'] and left>cfg['near_reset_min']: verdict,code,why='STOP',2,'hard threshold reached; save state and resume after reset'
elif pct>=cfg['soft_pct'] and left>cfg['near_reset_min']: verdict,code,why='PACE',1,'finish in-flight work and avoid another large dispatch'
else: verdict,code,why='GO',0,'headroom available' if pct<cfg['soft_pct'] else 'reset is near; a brief pause is the main risk'
out={'verdict':verdict,'window':label,'used_percent':pct,'reset_at':clock,'minutes_left':left,'reason':why}
print(json.dumps(out) if a.json else f'{verdict} — {label} at {pct:.0f}%, {left} min left (reset {clock}); {why}.')
sys.exit(code)
