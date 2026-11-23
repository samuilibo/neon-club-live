import * as THREE from 'three';
import { EVENTS } from '../../shared/events.ts';
import type { LiveMsg, PublicState, Quality, ServerMsg, Settings, SupportEffect } from '../../shared/protocol.ts';
import { AudioSystem } from './audio.ts';
import { CameraDirector } from './camera.ts';
import { loadArchetypes } from './chars/assets.ts';
import { Character } from './chars/character.ts';
import { Crowd } from './chars/crowd.ts';
import { makeLook } from './chars/look.ts';
import { charGlobals, loadCharTextures } from './chars/material.ts';
import { Club } from './club.ts';
import { Effects } from './effects.ts';
import { Engine } from './engine.ts';
import { DJ, STAGE } from './layout.ts';
import { Overlay } from './overlay.ts';

const q = new URLSearchParams(location.search);
const overlay = new Overlay(document.getElementById('overlay')!);
const engine = new Engine(document.getElementById('stage')!);
const forcedQuality = q.get('quality') as Quality | null;
engine.forcedScale = Math.min(3, Number(q.get('scale')) || 0);
let fpsCap = 0, lastFrameT = 0;   // panel frame limit
engine.setQuality(forcedQuality ?? 'high', !q.has('fixedres') && !engine.forcedScale);
const club = new Club(engine);
const effects = new Effects(engine);
const audio = new AudioSystem();
loadCharTextures();

let settings: Settings | null = null;
let state: PublicState | null = null;
let event = EVENTS[0];
let ws: WebSocket | null = null;
let emergency = false;
const send = (m: LiveMsg) => { if (ws?.readyState === 1) ws.send(JSON.stringify(m)); };
addEventListener('error', (e) => send({ t: 'clientError', msg: `${e.message} @ ${e.filename}:${e.lineno}` }));
addEventListener('unhandledrejection', (e) => send({ t: 'clientError', msg: `unhandled: ${String(e.reason?.message ?? e.reason)}` }));

const arch = await loadArchetypes();
const crowd = new Crowd(engine, arch);
const director = new CameraDirector(engine.camera, crowd, (o) => overlay.fade(o));

// ---- the DJ (staff character, not a viewer)
const djLook = makeLook(20260417, 3, 2, arch);
djLook.parts = djLook.parts.filter((p) => !p.startsWith('hat_') && !p.startsWith('acc_')).map((p) => (p.endsWith('_low') ? p.replace('_low', '') : p));
if (!djLook.parts.includes('acc_headphones')) djLook.parts.push('acc_headphones');
djLook.key = `${djLook.arch}:${djLook.parts.join(',')}`;
const dj = new Character(arch[djLook.arch], djLook);
dj.group.position.set(DJ.x, STAGE.y, DJ.z + 0.14);
dj.group.userData.noEnv = true;
engine.scene.add(dj.group);
dj.play('dj_mix', 0);
let djHypeUntil = 0;

audio.ytHost = overlay.ytHost;
audio.onTitle = (t) => { overlay.setSong(t.title, audio.frame.bpm); sendMusic(true); };
audio.onTrack = (t) => { overlay.setSong(t.title, audio.frame.bpm); dj.playOnce('dj_transition'); sendMusic(true); };
crowd.onArrive = () => { if (!dj.busy && Math.random() < 0.15) dj.playOnce('wave'); };

function applySettings(s: Settings) {
  const first = !settings;
  settings = s;
  const o = s.output ?? { width: 0, height: 0, scale: 0, fps: 0 };
  engine.manualSize = o.width >= 160 && o.height >= 160 ? { w: Math.min(7680, Math.round(o.width)), h: Math.min(7680, Math.round(o.height)) } : null;
  engine.manualScale = o.scale > 0 ? Math.max(0.25, Math.min(3, o.scale / 100)) : 0;
  fpsCap = o.fps > 0 ? Math.max(10, o.fps) : 0;
  const manual = !!engine.manualSize || !!engine.manualScale;
  engine.setQuality(forcedQuality ?? s.quality, s.dynamicResolution && !manual && !q.has('fixedres') && !engine.forcedScale);
  engine.resize();
  club.setLights(s.lights);
  audio.setSettings(q.has('mute') ? { ...s.music, volume: 0 } : s.music);
  overlay.setLang(s.overlayLang);
  if (s.music.yt) overlay.setYtCard(s.music.yt);
  overlay.setLayout((q.get('layout') as 'portrait' | null) ?? s.layout);
  crowd.setTagOptions(s.showNames, s.showAvatars);
  director.auto = s.cameraAuto;
  if (state) overlay.setEvent(event, state.nextEvent, state.eventEndsAt);
  if (first) void audio.loadPlaylist().then(() => { audio.start(); sendMusic(true); });
}

function setEvent(ev: typeof event, next: typeof event | null, endsAt: number, announce: boolean) {
  const changed = ev.id !== event.id;
  event = ev;
  club.setEvent(ev);
  crowd.setEvent(ev, audio.frame.beats);
  overlay.setEvent(ev, next, endsAt);
  if (state) { state.event = ev; state.nextEvent = next; state.eventEndsAt = endsAt; }
  if (changed && announce) {
    if (!settings?.music.lock) audio.playGenre(ev.genre);    // "lock music" keeps the streamer's track
    club.djMessage([ev.name[overlay.lang]], 6, now);
    club.lightShow(4, now);
    if (ev.special === 'djshow') director.request('dj', null, 10);
  }
}

function runEffect(e: SupportEffect) {
  const id = e.memberId, sec = e.durationMs / 1000;
  const present = !!crowd.position(id);
  overlay.support(e);
  const pos = crowd.position(id) ?? crowd.center(new THREE.Vector3());
  for (const fx of e.effects) {
    if (fx === 'spotlight' && present) club.spotlight(() => crowd.position(id), sec, now);
    else if (fx === 'gold' && present) crowd.gold(id, sec, now);
    else if (fx === 'djMessage') club.djMessage([overlay.lang === 'tr' ? 'TEŞEKKÜRLER' : 'THANK YOU', e.name + (e.others?.length ? ` +${e.others.length}` : ''), e.amountText || (e.kind === 'combo' ? '♥' : overlay.lang === 'tr' ? 'YENİ ÜYE' : 'NEW MEMBER')], Math.min(sec, 9), now);
    else if (fx === 'confetti') effects.confetti(new THREE.Vector3(pos.x, pos.y + 3.6, pos.z), 160 + e.tier * 40);
    else if (fx === 'fireworks') effects.fireworks(now, sec * 0.8, crowd.center(new THREE.Vector3()));
    else if (fx === 'camera' && present) director.request('user', id, Math.min(sec, 9));
    else if (fx === 'lightshow') club.lightShow(sec, now);
    else if (fx === 'dance' && present) crowd.action(id, 'special', undefined, audio.frame.beats);
  }
  djHypeUntil = audio.frame.beats + 16;
}

function onMessage(m: ServerMsg) {
  switch (m.t) {
    case 'snapshot':
      state = m.state;
      overlay.setServerTime(m.state.now);
      applySettings(m.state.settings);
      setEvent(m.state.event, m.state.nextEvent, m.state.eventEndsAt, false);
      crowd.sync(m.state.members);
      overlay.setMode(m.state.mode); overlay.setVote(m.state.vote); overlay.setQueue(m.state.queue);
      setEmergency(m.state.emergency);
      break;
    case 'join': crowd.join(m.member); overlay.toastJoin(m.member.name, m.member.source === 'demo'); if (settings?.welcomeCamera) director.welcome(m.member.id); break;
    case 'leave': crowd.leave(m.id); break;
    case 'update': crowd.update1(m.member); break;
    case 'action': crowd.action(m.id, m.action, m.arg, audio.frame.beats); break;
    case 'duo': crowd.duo(m.a, m.b, audio.frame.beats); break;
    case 'effect': if (!emergency) runEffect(m.effect); break;
    case 'event': setEvent(m.event, m.next, m.endsAt, true); break;
    case 'vote': overlay.setVote(m.vote, m.winner); break;
    case 'queue': overlay.setQueue(m.queue); if (state) state.queue = m.queue; break;
    case 'queueNotice': overlay.queueNotice(m.kind, m.name, m.position, m.size, m.amountText); break;
    case 'settings': applySettings(m.settings); break;
    case 'mode': overlay.setMode(m.mode); if (state) state.mode = m.mode; break;
    case 'notice': overlay.showNotice(m.text[overlay.lang], m.kind === 'help' ? 12000 : 7000); break;
    case 'music':
      if (m.cmd === 'next') audio.next(1); else if (m.cmd === 'prev') audio.next(-1); else if (m.cmd === 'toggle') audio.toggle();
      else if (m.cmd === 'genre' && m.arg) audio.playGenre(m.arg); else if (m.cmd === 'play' && m.arg) audio.play(Number(m.arg));
      else if (m.cmd === 'rescan') void audio.loadPlaylist().then(() => sendMusic(true));
      break;
    case 'camera': if (m.hold) director.request(m.shot, m.target ?? null, m.hold); else director.setMode(m.shot, m.target); break;
    case 'test': runTest(m.what, m.arg); break;
    case 'emergency': setEmergency(m.on); break;
    case 'effectStop': overlay.clearSupport(); effects.clear(); club.stopEffects(); crowd.clearGold(); director.release(); djHypeUntil = 0; break;
  }
}

function setEmergency(on: boolean) {
  if (on === emergency) return;
  emergency = on;
  overlay.setEmergency(on);
  if (on) { effects.clear(); overlay.clearSupport(); if (audio.playing) audio.toggle(); } else if (!audio.playing) audio.toggle();
}

function runTest(what: string, arg?: string) {
  const c = crowd.center(new THREE.Vector3());
  if (what === 'bench') { void benchmark(); return; }
  if (what === 'lights') club.lightTest(now);
  else if (what === 'lightshow') club.lightShow(8, now);
  else if (what === 'confetti') effects.confetti(new THREE.Vector3(c.x, 4, c.z), 400);
  else if (what === 'fireworks') effects.fireworks(now, 6, c);
  else if (what === 'djmessage') club.djMessage(['NEON CLUB LIVE', arg ?? 'TEST'], 6, now);
  else if (what === 'anim' && arg) for (const d of crowd.dancers.values()) crowd.action(d.m.id, 'dance', arg, audio.frame.beats);
  else if (what === 'sync') {
    // metronome on the detected grid: clicks must land on the kick, dancers clap on the beat
    const a = audio.ctx, f = audio.frame, spb = 60 / f.bpm, t0 = a.currentTime + (1 - f.beatPhase) * spb;
    for (let i = 0; i < 16; i++) {
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = i % 4 === 0 ? 1760 : 1320;
      g.gain.setValueAtTime(0.0001, t0 + i * spb); g.gain.exponentialRampToValueAtTime(0.25, t0 + i * spb + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * spb + 0.05);
      o.connect(g); g.connect(a.destination); o.start(t0 + i * spb); o.stop(t0 + i * spb + 0.08);
    }
    for (const d of crowd.dancers.values()) crowd.action(d.m.id, 'dance', 'step_touch', f.beats);
    overlay.showNotice(`SYNC TEST · ${f.bpm.toFixed(1)} BPM (${audio.info().builtin ? 'synth clock' : `detected ${Math.round(audio.bpmDetected)}`})`, 9000);
  }
}

/** Measured benchmark: fixed resolution, five camera shots x 6 s, reports avg FPS and 1% / 5% lows. */
let benchRunning = false;
const frameTimes: number[] = [];
async function benchmark() {
  if (benchRunning) return;
  benchRunning = true;
  const dyn = engine.dynamicRes;
  engine.dynamicRes = false;
  engine.scale = engine.profile.maxScale; engine.resize();
  const shots = ['wide', 'orbit', 'crowd', 'top', 'balcony'];
  const per: Record<string, unknown> = {};
  const all: number[] = [];
  for (const s of shots) {
    director.setMode(s);
    await new Promise((r) => setTimeout(r, 1500));
    frameTimes.length = 0;
    await new Promise((r) => setTimeout(r, 6000));
    const ft = [...frameTimes].sort((x, y) => x - y);
    all.push(...ft);
    const avg = ft.reduce((x, y) => x + y, 0) / Math.max(1, ft.length);
    per[s] = { fps: +(1 / avg).toFixed(1), p95ms: +(ft[Math.floor(ft.length * 0.95)] * 1000).toFixed(1) };
  }
  director.setMode('auto');
  all.sort((x, y) => x - y);
  const avg = all.reduce((x, y) => x + y, 0) / Math.max(1, all.length);
  const result = {
    quality: engine.quality, characters: crowd.count, resolution: `${engine.stats.width}x${engine.stats.height}`, gpu: engine.gpu,
    avgFps: +(1 / avg).toFixed(1), low5Fps: +(1 / all[Math.floor(all.length * 0.95)]).toFixed(1), low1Fps: +(1 / all[Math.floor(all.length * 0.99)]).toFixed(1),
    drawCalls: engine.stats.drawCalls, triangles: engine.stats.triangles, shots: per, at: new Date().toISOString(),
  };
  send({ t: 'bench', result });
  overlay.showNotice(`BENCHMARK: ${result.avgFps} FPS avg · 1% low ${result.low1Fps} · ${result.characters} chars · ${result.resolution}`, 12000);
  engine.dynamicRes = dyn;
  benchRunning = false;
  (window as unknown as Record<string, unknown>).__bench = result;
}

function sendMusic(withList = false) {
  send({ t: 'musicInfo', info: audio.info(), playlist: withList ? audio.playlist.map((t) => ({ title: t.title, genre: t.genre, builtin: t.builtin })) : undefined });
}

// ---- server connection (auto reconnect; the scene keeps running while offline)
function connect() {
  if (q.has('offline')) { applySettings((state?.settings) ?? (awaitDefault())); return; }
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=live`);
  ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch (err) { console.error(err); } };
  ws.onclose = () => setTimeout(connect, 2000);
  ws.onerror = () => ws?.close();
}
function awaitDefault(): Settings { throw new Error('offline mode needs a snapshot'); }
connect();

// audio needs a gesture in a normal browser tab; OBS and the kiosk launcher allow autoplay
// On touch screens only touchend / pointerup / click count as a user gesture (pointerdown does not).
// iOS: 'playback' keeps Web Audio audible even when the ring/silent switch is on.
try { (navigator as unknown as { audioSession?: { type: string } }).audioSession!.type = 'playback'; } catch { /* not supported */ }
const unlock = () => { void audio.resume(); };
for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, unlock);

const clock = new THREE.Timer();
let now = 0, secAcc = 0, frames = 0;
function frame() {
  requestAnimationFrame(frame);
  if (fpsCap) {                                             // panel frame limit (e.g. 30 for TikTok): skip early vsyncs
    const t = performance.now();
    if (t - lastFrameT < 1000 / fpsCap - 2) return;
    lastFrameT = t;
  }
  clock.update();
  const raw = clock.getDelta(), dt = Math.min(0.25, raw);
  now += dt;
  if (benchRunning) frameTimes.push(raw);
  const a = audio.update(dt);
  charGlobals.uTime.value = now;
  charGlobals.uRim.value.copy(club.ambientTint).multiplyScalar(0.55 + 0.35 * a.kick);
  // DJ: mixes, hypes the crowd when the energy is high, celebrates supporters
  if (!dj.busy) dj.play(a.beats < djHypeUntil || (a.level > 0.8 && Math.floor(a.beats / 16) % 4 === 3) ? 'dj_hype' : 'dj_mix', 0.5);
  dj.update(dt, a.beats, a.bpm / 60, 0);
  crowd.update(dt, now, a, engine.camera);
  if (crowd.battleActive && a.beat && a.beatCount % 8 === 0) { const b = crowd.battlers[Math.floor(a.beatCount / 8) % crowd.battlers.length]; club.spotlight(() => b.pos, 4, now); }
  director.update(dt);
  club.update(dt, now, a);
  effects.update(dt, now);
  engine.render(dt);
  secAcc += dt;
  if (++frames === 5) document.title = 'ready';
  if (secAcc >= 1) {
    secAcc = 0;
    overlay.setCount(crowd.count);
    overlay.setSong(audio.info().title, a.bpm);
    overlay.setAudioHint(audio.suspended && !emergency);
    overlay.tick(settings?.eventMinutes ?? 8);
    engine.stats.characters = crowd.count; engine.stats.visible = crowd.visibleCount;
    send({ t: 'stats', stats: engine.stats });
    sendMusic();
  }
}
frame();
(window as unknown as Record<string, unknown>).__club = { engine, crowd, audio, director, club };
