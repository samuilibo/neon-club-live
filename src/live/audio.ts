// Music player + analysis (Web Audio API).
//  - plays the user's own licensed MP3 / WAV / OGG files from the local music/ folder
//  - ships an original generative synth ("built-in" tracks) so the club never falls silent
//  - analyses bass / mid / treble, spectrum, level, beats and BPM for lights and dances
import { GENRES, GENRE_LABEL, type Genre, type MusicInfo, type MusicSettings } from '../../shared/protocol.ts';
import { rng, type AudioFrame } from './engine.ts';
import { parseYouTube, YouTubeDeck } from './youtube.ts';

export interface Track { title: string; genre: string; url?: string; builtin: boolean; yt?: string; bpm?: number }

interface Preset {
  bpm: number; root: number; scale: number[]; kick: string; snare: string; hat: string; perc?: string;
  bass: (number | null)[]; chords: number[][]; arp: (number | null)[]; swing?: number; wave: OscillatorType; cutoff: number; name: string[];
}
const MIN = [0, 2, 3, 5, 7, 8, 10], MAJ = [0, 2, 4, 5, 7, 9, 11], DOR = [0, 2, 3, 5, 7, 9, 10], HICAZ = [0, 1, 4, 5, 7, 8, 10], PHR = [0, 1, 3, 5, 7, 8, 10];
const _ = null;
// x = hit, - = rest (16th notes). All patterns and progressions below are original.
const PRESETS: Record<Genre, Preset> = {
  edm: { bpm: 128, root: 41, scale: MIN, kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x---x---x---x-', bass: [0, _, 0, _, _, 0, _, 0, 0, _, 0, _, _, 0, 3, _], chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], arp: [0, 2, 4, 7, 4, 2, 0, 4, 2, 4, 7, 9, 7, 4, 2, 4], wave: 'sawtooth', cutoff: 2600, name: ['Neon Pulse', 'Skyline Drop', 'Voltage'] },
  techno: { bpm: 134, root: 38, scale: PHR, kick: 'x---x---x---x---', snare: '----x-------x--x', hat: 'x-xxx-xxx-xxx-xx', bass: [0, 0, _, 0, 0, _, 0, _, 0, 0, _, 0, 1, _, 0, _], chords: [[0, 4], [0, 4], [1, 5], [0, 4]], arp: [0, _, _, 0, _, _, 1, _, 0, _, _, 0, _, 3, _, _], wave: 'square', cutoff: 1400, name: ['Steel Corridor', 'Warehouse 9', 'Kinetic'] },
  deephouse: { bpm: 122, root: 45, scale: DOR, kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x---x---x--xx-', bass: [0, _, _, 0, _, _, 4, _, _, 0, _, _, 3, _, 4, _], chords: [[0, 2, 4, 6], [3, 5, 0, 2], [5, 0, 2, 4], [4, 6, 1, 3]], arp: [_, _, 4, _, _, 6, _, _, 4, _, _, 2, _, _, 4, _], swing: 0.12, wave: 'triangle', cutoff: 1500, name: ['Velvet Hours', 'Low Tide', 'After Midnight'] },
  progressive: { bpm: 126, root: 43, scale: MIN, kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x---x---x---x-', bass: [0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 3, 3, 4, 4], chords: [[0, 2, 4], [5, 0, 2], [2, 4, 6], [4, 6, 1]], arp: [0, 4, 7, 4, 2, 4, 7, 4, 0, 4, 9, 4, 2, 4, 7, 4], wave: 'sawtooth', cutoff: 2000, name: ['Horizon Line', 'Long Way Up', 'Aurora Drive'] },
  trance: { bpm: 138, root: 45, scale: MIN, kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x---x---x---x-', bass: [_, 0, 0, _, 0, 0, _, 0, 0, _, 0, 0, _, 0, 0, _], chords: [[0, 2, 4], [5, 0, 2], [3, 5, 0], [4, 6, 1]], arp: [0, 4, 7, 9, 7, 4, 0, 4, 7, 9, 11, 9, 7, 4, 7, 4], wave: 'sawtooth', cutoff: 3200, name: ['Starlit Gate', 'Elevation', 'Northern Arc'] },
  hiphop: { bpm: 92, root: 36, scale: MIN, kick: 'x-----x---x--x--', snare: '----x-------x---', hat: 'x-x-x-xxx-x-x-x-', bass: [0, _, _, _, _, _, 0, _, _, _, 3, _, _, 4, _, _], chords: [[0, 2, 4, 6], [5, 0, 2], [3, 5, 0], [4, 6, 1]], arp: [_, _, 4, _, _, _, 2, _, _, _, 4, _, 6, _, _, _], swing: 0.18, wave: 'triangle', cutoff: 1100, name: ['Block Party', 'Gold Chains', 'Corner Flow'] },
  disco: { bpm: 118, root: 43, scale: MAJ, kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x-x-x---x-x-x-', bass: [0, _, 7, 0, _, 7, 0, _, 3, _, 7, 3, 4, _, 7, 4], chords: [[0, 2, 4, 6], [3, 5, 0], [1, 3, 5, 0], [4, 6, 1]], arp: [4, _, 4, 7, _, 4, _, 2, 4, _, 4, 7, _, 9, 7, _], wave: 'sawtooth', cutoff: 2400, name: ['Mirror Ball', 'Saturday Lights', 'Glitter Line'] },
  synthwave: { bpm: 104, root: 40, scale: MIN, kick: 'x-------x-------', snare: '----x-------x---', hat: 'x-x-x-x-x-x-x-x-', bass: [0, 0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 6, 6, 6, 6], chords: [[0, 2, 4], [5, 0, 2], [6, 1, 3], [4, 6, 1]], arp: [0, 2, 4, 2, 7, 4, 2, 4, 0, 2, 4, 2, 9, 7, 4, 2], wave: 'sawtooth', cutoff: 1800, name: ['Chrome Sunset', 'Night Drive 88', 'Laser Coast'] },
  turkish: { bpm: 112, root: 38, scale: HICAZ, kick: 'x-----x-x-------', snare: '----x-------x---', hat: '--x---x---x---x-', perc: 'D--T--T-D-T-T---', bass: [0, _, _, 0, _, _, 1, _, 0, _, _, 4, _, 3, 1, _], chords: [[0, 2, 4], [1, 3, 5], [3, 5, 0], [0, 2, 4]], arp: [4, 3, 2, 1, 0, _, 1, 2, 4, _, 5, 4, 3, 2, 1, _], wave: 'sawtooth', cutoff: 2100, name: ['Boğaz Işıkları', 'Gece Yarısı İstanbul', 'Hicaz Neon'] },
};
const SECTIONS = ['kh-p-', 'khbp-', 'khbpa', 'khbpa', '-h-pa', 'khbpa', 'khbpa', 'khb--', 'khbpa', 'khbpa', '-h-p-', 'khbpa'];
const BARS_PER_SECTION = 8;

/** Original generative dance-music engine. Deterministic per (genre, seed). */
class Synth {
  bpm: number;
  startTime: number;
  ended = false;
  out: GainNode;
  private timer = 0;
  private step = 0;
  private noise: AudioBuffer;
  private pad: GainNode;
  private delay: DelayNode;
  private r: () => number;
  private melody: (number | null)[];
  private total = SECTIONS.length * BARS_PER_SECTION * 16;

  constructor(private ctx: AudioContext, dest: AudioNode, private p: Preset, seed: number) {
    this.bpm = p.bpm;
    this.r = rng(seed);
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(dest);
    this.pad = ctx.createGain();
    this.pad.gain.value = 0.5;
    this.pad.connect(this.out);
    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = (60 / p.bpm) * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.out);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = this.r() * 2 - 1;
    // per-track melodic variation of the arp
    this.melody = p.arp.map((n) => (n === null ? (this.r() < 0.15 ? Math.floor(this.r() * 7) : null) : this.r() < 0.25 ? n + (this.r() < 0.5 ? 2 : -1) : n));
    this.startTime = ctx.currentTime + 0.12;
    this.out.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.timer = window.setInterval(() => this.schedule(), 40);
    this.schedule();
  }

  get stepDur() { return 60 / this.bpm / 4; }
  beatsAt(time: number) { return Math.max(0, (time - this.startTime) / (60 / this.bpm)); }
  get duration() { return this.total * this.stepDur; }
  get position() { return Math.max(0, this.ctx.currentTime - this.startTime); }

  fade(to: number, seconds: number) {
    const g = this.out.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    g.exponentialRampToValueAtTime(Math.max(0.0001, to), now + Math.max(0.05, seconds));
  }

  stop(fadeSeconds: number) {
    this.fade(0.0001, fadeSeconds);
    clearInterval(this.timer);
    this.ended = true;
    setTimeout(() => { try { this.out.disconnect(); this.pad.disconnect(); this.delay.disconnect(); } catch { /* already gone */ } }, fadeSeconds * 1000 + 400);
  }

  private freq(degree: number, octave = 0) {
    const s = this.p.scale, n = s.length;
    const o = Math.floor(degree / n), d = ((degree % n) + n) % n;
    return 440 * 2 ** ((this.p.root + s[d] + 12 * (o + octave) - 69) / 12);
  }

  private schedule() {
    if (this.ended) return;
    const ahead = this.ctx.currentTime + 0.22;
    for (;;) {
      const t = this.startTime + this.step * this.stepDur;
      if (t > ahead) break;
      if (this.step >= this.total) { this.ended = true; clearInterval(this.timer); return; }
      this.playStep(this.step, t);
      this.step++;
    }
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private noiseHit(t: number, type: BiquadFilterType, f: number, peak: number, decay: number, q = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const fl = this.ctx.createBiquadFilter();
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, peak, 0.002, decay);
    src.connect(fl); fl.connect(g); g.connect(this.out);
    src.start(t, this.r() * 0.5); src.stop(t + decay + 0.05);
  }

  private tone(t: number, f: number, type: OscillatorType, peak: number, attack: number, decay: number, cutoff: number, dest: AudioNode, sweep = 0) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * sweep), t + decay * 0.6);
    const fl = this.ctx.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(cutoff, t); fl.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.35), t + attack + decay);
    const g = this.ctx.createGain();
    this.env(g, t, peak, attack, decay);
    o.connect(fl); fl.connect(g); g.connect(dest);
    o.start(t); o.stop(t + attack + decay + 0.05);
  }

  private playStep(step: number, t0: number) {
    const p = this.p, s = step % 16, bar = Math.floor(step / 16);
    const section = SECTIONS[Math.floor(bar / BARS_PER_SECTION) % SECTIONS.length];
    const t = t0 + (s % 2 ? (p.swing ?? 0) * this.stepDur : 0);
    const lastBarOfSection = bar % BARS_PER_SECTION === BARS_PER_SECTION - 1;
    if (section[0] === 'k' && p.kick[s] === 'x' && !(lastBarOfSection && s >= 12)) {
      this.tone(t, 150, 'sine', 0.95, 0.002, 0.3, 4000, this.out, 0.28);
      // side-chain style ducking of the pad
      this.pad.gain.cancelScheduledValues(t);
      this.pad.gain.setValueAtTime(0.18, t);
      this.pad.gain.linearRampToValueAtTime(0.5, t + 60 / this.bpm * 0.8);
    }
    if (section[0] === 'k' && p.snare[s] === 'x') { this.noiseHit(t, 'bandpass', 1900, 0.5, 0.16, 0.8); this.tone(t, 190, 'triangle', 0.25, 0.002, 0.1, 2000, this.out, 0.6); }
    if (lastBarOfSection && s >= 8 && s % 2 === 0) this.noiseHit(t, 'bandpass', 1900, 0.12 + 0.05 * (s - 8), 0.1, 0.8);     // fill into the next section
    if (section[1] === 'h' && p.hat[s] === 'x') this.noiseHit(t, 'highpass', 7500, s % 4 === 2 ? 0.2 : 0.11, s % 4 === 2 ? 0.09 : 0.035);
    if (p.perc && section[1] === 'h') {
      if (p.perc[s] === 'D') this.tone(t, 110, 'sine', 0.5, 0.002, 0.16, 900, this.out, 0.6);
      if (p.perc[s] === 'T') this.noiseHit(t, 'bandpass', 2600, 0.3, 0.05, 3);
    }
    const chord = p.chords[Math.floor(bar / 2) % p.chords.length];
    if (section[2] === 'b' && p.bass[s] !== null) this.tone(t, this.freq(chord[0] + (p.bass[s] as number), 0), p.wave === 'triangle' ? 'triangle' : 'sawtooth', 0.42, 0.005, this.stepDur * 1.6, p.cutoff * 0.5, this.out);
    if (section[3] === 'p' && s === 0 && bar % 2 === 0) {
      const len = this.stepDur * 32;
      for (const deg of chord) for (const det of [-6, 6]) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = this.freq(deg, 2); o.detune.value = det;
        const fl = this.ctx.createBiquadFilter();
        fl.type = 'lowpass'; fl.frequency.setValueAtTime(p.cutoff * 0.4, t); fl.frequency.linearRampToValueAtTime(p.cutoff, t + len * 0.6);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.055, t + 0.25); g.gain.setValueAtTime(0.055, t + len - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + len);
        o.connect(fl); fl.connect(g); g.connect(this.pad);
        o.start(t); o.stop(t + len + 0.05);
      }
    }
    const n = this.melody[s];
    if (section[4] === 'a' && n !== null) {
      const g = this.ctx.createGain();
      g.gain.value = 1;
      g.connect(this.out); g.connect(this.delay);
      this.tone(t, this.freq(chord[0] + n, 3), p.wave === 'square' ? 'square' : 'triangle', 0.13, 0.004, this.stepDur * 1.3, p.cutoff * 1.4, g);
      setTimeout(() => { try { g.disconnect(); } catch { /* */ } }, (t - this.ctx.currentTime + 1.5) * 1000);
    }
  }
}

interface Deck { el?: HTMLAudioElement; gain?: GainNode; synth?: Synth; yt?: YouTubeDeck; track: Track; startedAt: number }

export class AudioSystem {
  ctx: AudioContext;
  frame: AudioFrame = { bass: 0, mid: 0, treble: 0, level: 0, beat: false, beatPhase: 0, beatCount: 0, beats: 0, bpm: 120, kick: 0, spectrum: new Float32Array(64) };
  playlist: Track[] = [];
  index = -1;
  playing = false;
  bpmDetected = 0;
  onTrack: ((t: Track) => void) | null = null;
  /** fired when a track learns its real title later (YouTube) */
  onTitle: ((t: Track) => void) | null = null;
  /** element that holds the visible YouTube player card */
  ytHost: HTMLElement | null = null;
  private master: GainNode;
  private analyser: AnalyserNode;
  private freq: Uint8Array<ArrayBuffer>;
  private deck: Deck | null = null;
  private settings: MusicSettings = { volume: 0.8, shuffle: true, repeat: 'all', crossfade: 4, bpmOverride: 0, source: 'auto', lock: false, youtube: [], yt: { width: 356, pos: 'auto', x: 5, y: 55 } };
  private flux: number[] = [];
  private prevLow = 0;
  private onsets: number[] = [];
  private lastOnset = 0;
  private peak = { bass: 0.3, mid: 0.2, treble: 0.1, level: 0.2 };
  private beatBase = 0;
  private seedCounter = 1;
  private history: number[] = [];
  private switching = false;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'playback' });
    this.master = this.ctx.createGain();
    this.master.gain.value = this.settings.volume;
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -9; limiter.ratio.value = 8; limiter.attack.value = 0.004; limiter.release.value = 0.2;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.55;
    this.master.connect(limiter); limiter.connect(this.analyser); this.analyser.connect(this.ctx.destination);
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
  }

  get suspended() { return this.ctx.state !== 'running'; }
  async resume() {
    if (this.playing && this.deck?.el?.paused) void this.deck.el.play().catch(() => { /* still blocked */ });
    if (this.playing) this.deck?.yt?.play();
    try { await this.ctx.resume(); } catch { /* needs a user gesture outside OBS */ }
  }

  async loadPlaylist() {
    let files: { file: string; title: string; genre: string }[] = [];
    try { files = await (await fetch('/api/music')).json(); } catch { /* server offline: built-in only */ }
    const builtin: Track[] = GENRES.flatMap((g) => PRESETS[g].name.map((n) => ({ title: `${n} — ${GENRE_LABEL[g]}`, genre: g, builtin: true })));
    const local: Track[] = files.map((f) => ({ title: f.title, genre: f.genre || 'local', url: `/music/${f.file.split('/').map(encodeURIComponent).join('/')}`, builtin: false }));
    const yt: Track[] = (this.settings.youtube ?? []).map(parseYouTube).filter((v) => !!v)
      .map((v) => ({ title: `YouTube · ${v.id}`, genre: 'youtube', yt: v.id, bpm: v.bpm || undefined, builtin: false }));
    const own = [...local, ...yt];
    const src = this.settings.source;
    this.playlist = src === 'builtin' ? builtin : src === 'files' ? (own.length ? own : builtin) : src === 'youtube' ? (yt.length ? yt : builtin) : own.length ? own : builtin;
    if (src === 'auto' && own.length) this.playlist = [...own, ...builtin.filter((b) => !own.some((l) => l.genre === b.genre))];
    this.index = Math.min(this.index, this.playlist.length - 1);
  }

  setSettings(s: MusicSettings) {
    const reload = s.source !== this.settings.source || JSON.stringify(s.youtube ?? []) !== JSON.stringify(this.settings.youtube ?? []);
    this.settings = { ...s };
    this.master.gain.setTargetAtTime(s.volume, this.ctx.currentTime, 0.05);
    this.deck?.yt?.setVolume(s.volume);
    if (reload) void this.loadPlaylist();
  }

  // ------------------------------------------------------------------ transport
  start() { if (!this.deck && this.playlist.length) this.next(); }

  toggle() {
    if (!this.deck) { this.start(); return; }
    this.playing = !this.playing;
    if (this.deck.yt) { if (this.playing) this.deck.yt.play(); else this.deck.yt.pause(); }
    if (this.deck.el) { if (this.playing) void this.deck.el.play(); else this.deck.el.pause(); }
    else if (this.playing) void this.ctx.resume(); else void this.ctx.suspend();
  }

  next(dir = 1) {
    const n = this.playlist.length;
    if (!n) return;
    let i: number;
    if ((this.settings.repeat === 'one' || this.settings.lock) && this.index >= 0 && dir === 1 && this.autoAdvance) i = this.index;
    else if (dir < 0 && this.history.length > 1) { this.history.pop(); i = this.history.pop()!; }
    else if (this.settings.shuffle && n > 2) { do { i = Math.floor(Math.random() * n); } while (i === this.index); }
    else i = (this.index + dir + n) % n;
    this.play(i);
  }
  private autoAdvance = false;
  private ytFails = 0;

  playGenre(genre: string) {
    const c = this.playlist.map((t, i) => ({ t, i })).filter((e) => e.t.genre === genre && e.i !== this.index);
    if (c.length) { this.play(c[Math.floor(Math.random() * c.length)].i); return; }
    // "files only": never switch to the built-in synth, keep the current track
    if (this.settings.source === 'files' || this.settings.source === 'youtube') return;
    // genre not on disk: fall back to the built-in generator for that genre
    if ((GENRES as readonly string[]).includes(genre)) {
      const p = PRESETS[genre as Genre];
      this.playTrack({ title: `${p.name[Math.floor(Math.random() * p.name.length)]} — ${GENRE_LABEL[genre as Genre]}`, genre, builtin: true });
    }
  }

  play(i: number) {
    if (i < 0 || i >= this.playlist.length) return;
    this.index = i;
    this.history.push(i);
    if (this.history.length > 50) this.history.shift();
    this.playTrack(this.playlist[i]);
  }

  private playTrack(track: Track) {
    const xf = Math.max(0.05, this.settings.crossfade);
    const old = this.deck;
    if (this.ctx.state === 'suspended' && this.playing) void this.ctx.resume();
    if (old?.synth) old.synth.stop(xf);
    if (old?.yt) old.yt.stop(xf);
    if (old?.el && old.gain) {
      const g = old.gain, el = old.el;
      g.gain.cancelScheduledValues(this.ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + xf);
      setTimeout(() => { el.pause(); el.removeAttribute('src'); el.load(); g.disconnect(); }, xf * 1000 + 200);   // release the decoder
    }
    const deck: Deck = { track, startedAt: this.ctx.currentTime };
    this.beatBase = Math.ceil(this.frame.beats);         // keep the global beat clock monotonic across tracks
    if (track.yt) {
      if (!this.ytHost) this.ytHost = document.getElementById('overlay') ?? document.body;
      deck.yt = new YouTubeDeck(this.ytHost, track.yt, this.settings.volume, old ? xf : 0.4,
        (title) => { this.ytFails = 0; track.title = title; if (this.deck === deck) this.onTitle?.(track); },
        () => {
          if (this.deck !== deck) return;
          // every link failed in a row (offline, embedding blocked): don't spin, fall back to the built-in music
          if (++this.ytFails >= Math.max(1, this.playlist.filter((t) => t.yt).length)) {
            this.ytFails = 0;
            console.warn('No YouTube link could be played - switching to built-in music');
            const g = GENRES[Math.floor(Math.random() * GENRES.length)], p = PRESETS[g];
            this.playTrack({ title: `${p.name[0]} — ${GENRE_LABEL[g]}`, genre: g, builtin: true });
          } else if (!this.settings.lock) setTimeout(() => { if (this.deck === deck) this.advance(); }, 800);
        });
    } else if (track.builtin) {
      deck.synth = new Synth(this.ctx, this.master, PRESETS[track.genre as Genre] ?? PRESETS.edm, (this.seedCounter++ * 7919) ^ hash(track.title));
      deck.synth.fade(0.9, old ? xf : 0.4);
    } else {
      const el = new Audio(track.url);
      el.preload = 'auto';
      const srcNode = this.ctx.createMediaElementSource(el);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(old ? 0 : 1, this.ctx.currentTime);
      if (old) g.gain.linearRampToValueAtTime(1, this.ctx.currentTime + xf);
      srcNode.connect(g); g.connect(this.master);
      deck.el = el; deck.gain = g;
      el.onerror = () => { if (this.deck === deck) { console.warn('cannot play', track.title); if (!this.settings.lock) setTimeout(() => this.advance(), 500); } };
      void el.play().catch(() => { /* autoplay blocked until resume() */ });
      this.onsets = []; this.bpmDetected = 0;
    }
    this.deck = deck;
    this.playing = true;
    this.onTrack?.(track);
  }

  private advance() { this.autoAdvance = true; this.next(1); this.autoAdvance = false; }

  info(): MusicInfo {
    const d = this.deck;
    const dur = d?.synth ? d.synth.duration : d?.yt ? d.yt.duration : d?.el && Number.isFinite(d.el.duration) ? d.el.duration : 0;
    const pos = d?.synth ? d.synth.position : d?.yt ? d.yt.position : d?.el ? d.el.currentTime : 0;
    return {
      title: d?.track.title ?? '', genre: d?.track.genre ?? '', bpm: Math.round(this.frame.bpm * 10) / 10, bpmDetected: Math.round(this.bpmDetected),
      playing: this.playing && !this.suspended, builtin: !!d?.track.builtin, position: pos, duration: dur,
    };
  }

  // ------------------------------------------------------------------ analysis (call once per frame)
  update(dt: number): AudioFrame {
    const f = this.frame, d = this.deck;
    // end of track -> crossfade into the next one
    if (d && this.playing && !this.switching) {
      const xf = this.settings.crossfade;
      const ytDur = d.yt?.duration ?? 0;
      const remaining = d.synth ? d.synth.duration - d.synth.position : d.yt ? (ytDur > 0 ? ytDur - d.yt.position : 1e9) : d.el && Number.isFinite(d.el.duration) && d.el.duration > 0 ? d.el.duration - d.el.currentTime : 1e9;
      if (remaining < Math.max(0.3, xf) || d.el?.ended || d.yt?.ended) { this.switching = true; this.advance(); this.switching = false; }
    }
    this.analyser.getByteFrequencyData(this.freq);
    const binHz = this.ctx.sampleRate / this.analyser.fftSize;
    const band = (lo: number, hi: number) => {
      let s = 0;
      const a = Math.max(1, Math.floor(lo / binHz)), b = Math.min(this.freq.length - 1, Math.ceil(hi / binHz));
      for (let i = a; i <= b; i++) s += this.freq[i];
      return s / ((b - a + 1) * 255);
    };
    const norm = (k: 'bass' | 'mid' | 'treble' | 'level', v: number) => {
      this.peak[k] = Math.max(v, this.peak[k] * (1 - dt * 0.08), 0.08);
      return Math.min(1, v / this.peak[k]);
    };
    const rawBass = band(30, 150);
    f.bass = norm('bass', rawBass); f.mid = norm('mid', band(150, 2000)); f.treble = norm('treble', band(2000, 10000));
    f.level = norm('level', band(30, 8000));
    for (let i = 0; i < 64; i++) {
      const lo = 40 * (350 ** (i / 64)), hi = 40 * (350 ** ((i + 1) / 64));
      f.spectrum[i] += (Math.min(1, band(lo, Math.max(hi, lo + binHz)) * 1.6) - f.spectrum[i]) * Math.min(1, dt * 18);
    }
    // onset detection: positive flux of the low band against an adaptive threshold
    const now = this.ctx.currentTime;
    const low = band(30, 180), fl = Math.max(0, low - this.prevLow);
    this.prevLow = low;
    this.flux.push(fl);
    if (this.flux.length > 48) this.flux.shift();
    let mean = 0;
    for (const v of this.flux) mean += v;
    mean /= this.flux.length;
    let onset = false;
    if (fl > mean * 1.7 + 0.012 && now - this.lastOnset > 0.27 && low > 0.12) {
      onset = true; this.lastOnset = now;
      this.onsets.push(now);
      while (this.onsets.length && now - this.onsets[0] > 12) this.onsets.shift();
      this.estimateBpm();
    }
    // beat clock
    const override = this.settings.bpmOverride;
    const prevCount = f.beatCount;
    if (d?.synth && !override && this.playing && !this.suspended) {
      f.bpm = d.synth.bpm;
      f.beats = this.beatBase + d.synth.beatsAt(now);        // sample-accurate: we know where every beat is
    } else {
      f.bpm = override || (d?.yt ? d.track.bpm || 124 : (d && !d.track.builtin && this.bpmDetected) || f.bpm || 120);
      f.beats += (dt * f.bpm) / 60;
      if (onset && !override) {                              // phase-lock to detected kicks
        let err = f.beats - Math.round(f.beats);
        if (Math.abs(err) < 0.35) f.beats -= err * 0.25;
      }
    }
    f.beatCount = Math.floor(f.beats);
    f.beatPhase = f.beats - f.beatCount;
    f.beat = f.beatCount !== prevCount;
    if (d?.yt && this.playing) {                              // no samples to analyse: pulse with the beat clock
      const ph = f.beatPhase, t = f.beats;
      f.bass = 0.25 + 0.75 * Math.exp(-ph * 5); f.mid = 0.45 + 0.25 * Math.sin(t * Math.PI); f.treble = 0.35 + 0.3 * Math.exp(-((ph * 2) % 1) * 6);
      f.level = 0.75;
      for (let i = 0; i < 64; i++) f.spectrum[i] += ((i < 16 ? f.bass : i < 40 ? f.mid : f.treble) * (0.6 + 0.4 * Math.sin(i * 1.7 + t * 3)) - f.spectrum[i]) * Math.min(1, dt * 12);
    }
    f.kick = Math.exp(-f.beatPhase * 4.5) * (0.35 + 0.65 * Math.min(1, f.level * 1.4));
    return f;
  }

  /** Tempo from the histogram of inter-onset intervals, folded into 75-170 BPM. */
  private estimateBpm() {
    const o = this.onsets;
    if (o.length < 6) return;
    const hist = new Float32Array(200);
    for (let i = 0; i < o.length; i++) for (let j = i + 1; j < Math.min(o.length, i + 9); j++) {
      const iv = (o[j] - o[i]);
      for (const div of [1, 2, 3, 4, 6, 8]) {
        let bpm = (60 / iv) * div;
        while (bpm < 75) bpm *= 2;
        while (bpm >= 170) bpm /= 2;
        const b = Math.round(bpm);
        if (b >= 75 && b < 170 && div <= j - i + 0.5) hist[b] += 1 / div;
      }
    }
    let best = 0, bv = 0;
    for (let b = 76; b < 169; b++) { const v = hist[b - 1] * 0.6 + hist[b] + hist[b + 1] * 0.6; if (v > bv) { bv = v; best = b; } }
    if (best) this.bpmDetected = this.bpmDetected ? this.bpmDetected * 0.8 + best * 0.2 : best;
  }
}

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h >>> 0; }
