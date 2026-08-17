#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { DIR, LIMITS_FILE, readJson, snapshotFromTranscript, persist } = require('./pacer-lib.cjs');

const argv = process.argv.slice(2);
const value = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const RESET='\x1b[0m', DIM='\x1b[2m', BOLD='\x1b[1m', GREEN='\x1b[32m', YELLOW='\x1b[33m', RED='\x1b[31;1m';
const color = p => p >= 90 ? RED : p >= 70 ? YELLOW : GREEN;
const duration = ms => { const m=Math.max(0,Math.floor(ms/60000)),d=Math.floor(m/1440),h=Math.floor(m%1440/60); return d?`${d}d${h}h`:h?`${h}h${String(m%60).padStart(2,'0')}m`:`${m}m`; };
const bar = (p,w=6) => { const n=Math.max(0,Math.min(w,Math.round(p*w/100))); return color(p)+'▓'.repeat(n)+RESET+DIM+'░'.repeat(w-n)+RESET; };

function findLatestTranscript() {
  const root = path.join(process.env.CODEX_HOME || path.join(process.env.HOME || process.env.USERPROFILE, '.codex'), 'sessions');
  const found=[];
  function walk(dir) { let entries=[]; try { entries=fs.readdirSync(dir,{withFileTypes:true}); } catch { return; } for(const e of entries){const p=path.join(dir,e.name); if(e.isDirectory()) walk(p); else if(e.name.endsWith('.jsonl')) found.push({p,t:fs.statSync(p).mtimeMs});} }
  walk(root); found.sort((a,b)=>b.t-a.t); return found[0] && found[0].p;
}

function part(w) { if(!w) return `${DIM}limit –${RESET}`; const p=Math.round(w.used_percentage); return `${BOLD}${w.label}${RESET} ${bar(p)} ${color(p)}${p}%${RESET}${DIM}·${duration(w.resets_at*1000-Date.now())}${RESET}`; }
function render(s) { const parts=[part(s.primary)]; if(s.secondary) parts.push(part(s.secondary)); if(s.context) { const p=Math.round(s.context.used_percentage); parts.push(`${BOLD}Ctx${RESET} ${color(p)}${p}%${RESET}`); } if(s.model) parts.push(`${DIM}${s.model}${RESET}`); return parts.join(` ${DIM}│${RESET} `); }
function demo(){ const now=Date.now()/1000; console.log(render({primary:{label:'5h',used_percentage:42,resets_at:now+7200},secondary:{label:'7d',used_percentage:71,resets_at:now+259200},context:{used_percentage:34},model:'gpt-5.6-sol'})); }
function main(){ if(argv.includes('--demo')) return demo(); const transcript=value('--transcript') || findLatestTranscript(); let s=snapshotFromTranscript(transcript,value('--model')); if(s) persist(s); else s=readJson(LIMITS_FILE); if(!s){console.error('NO-DATA: no Codex token_count event found.'); process.exitCode=3; return;} console.log(argv.includes('--json')?JSON.stringify(s):render(s)); }
try { main(); } catch {}
