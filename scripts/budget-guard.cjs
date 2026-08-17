#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const {DIR,LIMITS_FILE,readJson,snapshotFromTranscript,persist}=require('./pacer-lib.cjs');
const CONFIG=path.join(DIR,'config.json'), STATE=path.join(DIR,'guard-state.json');
const defaults={soft_pct:85,hard_pct:93,rearm_min:10,near_reset_min:20};
const SESSION_TTL=86400000;
function emit(event,msg){process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:event,additionalContext:msg}}));}
// A non-numeric threshold in config.json made every comparison NaN. `NaN < x` is
// false, which reads as "not re-armed yet", so the same warning fired on every prompt.
function readConfig(){const cfg=Object.assign({},defaults,(readJson(CONFIG,{})||{}).guard||{});for(const k of Object.keys(defaults))if(typeof cfg[k]!=='number'||!Number.isFinite(cfg[k]))cfg[k]=defaults[k];return cfg;}
// guard-state.json holding valid JSON that is not an object (e.g. a bare string) used
// to throw on property assignment under strict mode; the outer catch swallowed it, so
// a 96% window produced no warning whatsoever.
function readState(){const s=readJson(STATE,{sessions:{}});if(!s||typeof s!=='object'||Array.isArray(s))return{sessions:{}};if(!s.sessions||typeof s.sessions!=='object'||Array.isArray(s.sessions))s.sessions={};return s;}
// One key per session_id and nothing ever removed it, so the file grew forever.
function prune(sessions,now){for(const [k,v] of Object.entries(sessions)){const stamps=Object.values(v||{}).filter(n=>typeof n==='number'&&Number.isFinite(n));const last=stamps.length?Math.max(...stamps):0;if(!last||now-last>SESSION_TTL)delete sessions[k];}}
function main(){let input;try{input=JSON.parse(fs.readFileSync(0,'utf8'));}catch{return;} const fresh=snapshotFromTranscript(input.transcript_path,input.model); if(fresh)persist(fresh); /* `fresh||cache` looked safe but snapshotFromTranscript returns an object even when the event carried no rate_limits, so a partial event beat a perfectly good cached window and suppressed the warning. Require a usable primary before preferring the fresh one. */ const d=(fresh&&fresh.primary)?fresh:readJson(LIMITS_FILE); const w=d&&d.primary; if(!w||Date.now()>=w.resets_at*1000)return; const cfg=readConfig(); const p=w.used_percentage,remain=Math.max(0,Math.round((w.resets_at*1000-Date.now())/60000)); let level=p>=cfg.hard_pct?'hard':p>=cfg.soft_pct?'soft':null; if(!level)return; if(remain<=cfg.near_reset_min)level=level==='hard'?'near':null; if(!level)return; const now=Date.now(); const state=readState(); const key=input.session_id||'unknown'; const ss=state.sessions[key]||{}; if(ss[level]&&now-ss[level]<cfg.rearm_min*60000)return; ss[level]=now; prune(state.sessions,now); state.sessions[key]=ss; try{fs.mkdirSync(DIR,{recursive:true});fs.writeFileSync(STATE,JSON.stringify(state));}catch{} const reset=new Date(w.resets_at*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); let msg; if(level==='soft') msg=`[codex-pacer] ${w.label} usage is ${Math.round(p)}% and resets in ${remain} min (${reset}). Finish in-flight work and avoid starting another large or multi-agent wave. Run the codex-pacer verdict command before dispatching more work.`; else if(level==='near') msg=`[codex-pacer] ${w.label} usage is ${Math.round(p)}%, but resets in ${remain} min (${reset}). Continue the current step; avoid work that needs more runway than remains.`; else msg=`[codex-pacer] ${w.label} usage is ${Math.round(p)}%. Wrap up now: save a clean checkpoint, start nothing new, tell the user the reset time (${reset}), and end the turn. For unattended work, write handoff.md and schedule 'codex exec resume --last' after the reset.`; emit(input.hook_event_name||'UserPromptSubmit',msg);}
try{main();}catch(err){if(process.env.CODEX_PACER_DEBUG)console.error(err);}
