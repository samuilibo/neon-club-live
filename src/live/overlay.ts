import { SOURCE_LABEL, type ClubEvent, type PublicState, type QueueInfo, type SupportEffect, type VoteState } from '../../shared/protocol.ts';

type Lang = 'tr' | 'en';
const T = {
  tr: { inClub: 'KULÜPTE', now: 'ŞİMDİ ÇALIYOR', event: 'ETKİNLİK', next: 'SIRADAKİ', joined: 'kulübe katıldı', thanks: 'Teşekkürler', member: 'Yeni üye!', gift: 'Üyelik hediye etti!', combo: 'Destekleriniz için teşekkürler!',
    hint: '!katıl yazarak kulübe gir  ·  !dans  ·  !shuffle  ·  !robot  ·  !zıpla  ·  !selam  ·  !kıyafet  ·  !renk  ·  !müzik <tür>  ·  !help', vote: 'OYLAMA', voteSong: 'Müzik türü — !müzik <tür>', voteEvent: 'Sıradaki etkinlik — !etkinlik <no>',
    demo: 'DEMO MODU · simüle edilmiş izleyiciler',
    qTitle: 'KAPI SIRASI', qFull: 'Kulüp dolu', qIn: 'Kulüpte', qWait: 'sırada', qPrio: 'öncelikli', qHint: '!katıl → sıraya gir · destek → öne geç · !sıra',
    qJoined: 'sıraya girdi', qPriority: 'öne geçti', qPos: 'sıran', audio: 'Sesi başlatmak için tıklayın', stopped: 'YAYIN DURAKLATILDI', sim: 'SİMÜLASYON', won: 'Kazanan' },
  en: { inClub: 'IN THE CLUB', now: 'NOW PLAYING', event: 'EVENT', next: 'UP NEXT', joined: 'joined the club', thanks: 'Thank you', member: 'New member!', gift: 'Gifted memberships!', combo: 'Thank you for the support!',
    hint: 'Type !join to enter the club  ·  !dance  ·  !shuffle  ·  !robot  ·  !jump  ·  !wave  ·  !outfit  ·  !color  ·  !song <genre>  ·  !help', vote: 'VOTE', voteSong: 'Music genre — !song <genre>', voteEvent: 'Next event — !event <no>',
    demo: 'DEMO MODE · simulated viewers',
    qTitle: 'DOOR QUEUE', qFull: 'Club is full', qIn: 'In the club', qWait: 'waiting', qPrio: 'priority', qHint: '!join → get in line · support → skip ahead · !queue',
    qJoined: 'joined the queue', qPriority: 'skipped ahead', qPos: 'your place', audio: 'Click to start audio', stopped: 'STREAM PAUSED', sim: 'SIMULATION', won: 'Winner' },
};

const el = (tag: string, cls = '', parent?: HTMLElement, text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  parent?.appendChild(e);
  return e;
};

/** Minimal broadcast HUD. Everything is plain DOM over the canvas; nothing here is clickable. */
export class Overlay {
  lang: Lang = 'tr';
  private root: HTMLElement;
  private count!: HTMLElement; private countLabel!: HTMLElement; private song!: HTMLElement; private songLabel!: HTMLElement; private bpm!: HTMLElement;
  private ev!: HTMLElement; private evLabel!: HTMLElement; private next!: HTMLElement; private nextLabel!: HTMLElement; private timer!: HTMLElement;
  ytHost!: HTMLElement;
  private toasts!: HTMLElement; private banner!: HTMLElement; private voteBox!: HTMLElement; private hint!: HTMLElement; private notice!: HTMLElement;
  private demo!: HTMLElement; private audioHint!: HTMLElement; private curtain!: HTMLElement; private fadeEl!: HTMLElement;
  private queueBox!: HTMLElement;
  private eventEndsAt = 0;
  private noticeTimer = 0;
  private bannerTimer = 0;
  private lastCount = -1;
  private clockSkew = 0;

  constructor(root: HTMLElement) {
    this.root = root;
    this.fadeEl = el('div', 'fade', root);
    const tl = el('div', 'hud tl', root);
    const logo = el('div', 'logo', tl);
    el('span', 'l1', logo, 'NEON CLUB'); el('span', 'l2', logo, 'LIVE');
    const cnt = el('div', 'chip', tl);
    this.count = el('b', '', cnt, '0'); this.countLabel = el('span', '', cnt);
    this.demo = el('div', 'demo', tl);
    const tr = el('div', 'hud tr', root);
    const e1 = el('div', 'card', tr);
    this.evLabel = el('small', '', e1); this.ev = el('div', 'big', e1); this.timer = el('div', 'bar', e1);
    el('i', '', this.timer);
    const e2 = el('div', 'card dim', tr);
    this.nextLabel = el('small', '', e2); this.next = el('div', 'mid', e2);
    this.voteBox = el('div', 'card vote', tr);
    this.queueBox = el('div', 'card queue', tr);
    const bl = el('div', 'hud bl', root);
    this.ytHost = el('div', 'ytcard', bl);
    const np = el('div', 'card np', bl);
    el('div', 'eq', np).innerHTML = '<i></i><i></i><i></i><i></i>';
    const npT = el('div', '', np);
    this.songLabel = el('small', '', npT); this.song = el('div', 'mid', npT); this.bpm = el('small', 'bpm', npT);
    this.toasts = el('div', 'toasts', root);
    this.banner = el('div', 'banner', root);
    this.notice = el('div', 'notice', root);
    this.hint = el('div', 'hint', root);
    if (new URLSearchParams(location.search).get('hint') === '0') this.hint.style.display = 'none';   // ?hint=0 hides the bottom line
    this.startTicker(root);
    this.audioHint = el('div', 'audiohint', root);
    this.curtain = el('div', 'curtain', root);
    this.setLang('tr');
  }

  setLang(l: Lang) {
    this.lang = l;
    const t = T[l];
    this.countLabel.textContent = t.inClub; this.songLabel.textContent = t.now; this.evLabel.textContent = t.event; this.nextLabel.textContent = t.next;
    this.hint.textContent = t.hint; this.demo.textContent = t.demo; this.audioHint.textContent = t.audio; this.curtain.textContent = t.stopped;
  }

  // Scrolling copy of the command hint that crosses the middle of the screen now and then.
  // ?ticker=<seconds between runs> (default 90), ?ticker=0 turns it off.
  private startTicker(root: HTMLElement) {
    const p = new URLSearchParams(location.search).get('ticker');
    const every = p === null ? 90 : Number(p);
    if (!(every > 0)) return;
    const band = el('div', 'mticker', root);
    const run = () => {
      band.innerHTML = '';
      const span = el('span', '', band, this.hint.textContent ?? '');
      const secs = Math.max(12, Math.min(40, span.textContent!.length * 0.16));
      span.style.animationDuration = `${secs}s`;
      band.classList.add('on');
      span.addEventListener('animationend', () => band.classList.remove('on'), { once: true });
    };
    setTimeout(run, 8000);
    setInterval(run, Math.max(20, every) * 1000);
  }

  setLayout(layout: 'landscape' | 'portrait') { document.body.classList.toggle('portrait', layout === 'portrait' || innerHeight > innerWidth); }
  fade(o: number) { this.fadeEl.style.opacity = String(o); }
  setMode(mode: PublicState['mode']) { this.demo.style.display = mode === 'demo' ? '' : 'none'; }
  setEmergency(on: boolean) { this.curtain.classList.toggle('on', on); }
  setAudioHint(on: boolean) { this.audioHint.classList.toggle('on', on); }
  setServerTime(now: number) { this.clockSkew = now - Date.now(); }

  /** Avatars in the club — deliberately labelled as such; this is not the YouTube viewer count. */
  setCount(n: number) { if (n !== this.lastCount) { this.lastCount = n; this.count.textContent = String(n); } }
  setSong(title: string, bpm: number) { this.song.textContent = title || '—'; this.bpm.textContent = bpm ? `${Math.round(bpm)} BPM` : ''; }

  setEvent(ev: ClubEvent, next: ClubEvent | null, endsAt: number) {
    this.ev.textContent = ev.name[this.lang];
    this.next.textContent = next ? next.name[this.lang] : '—';
    this.eventEndsAt = endsAt;
    this.root.style.setProperty('--c1', ev.palette[0]); this.root.style.setProperty('--c2', ev.palette[1]); this.root.style.setProperty('--c3', ev.palette[2]);
  }

  tick(eventMinutes: number) {
    const left = Math.max(0, this.eventEndsAt - (Date.now() + this.clockSkew));
    (this.timer.firstChild as HTMLElement).style.width = `${Math.min(100, 100 - (left / (eventMinutes * 60000)) * 100)}%`;
  }

  /** Door queue card: only shown while somebody waits or the club is full. Amounts in the platform's own units. */
  setQueue(q: QueueInfo | null | undefined) {
    const t = T[this.lang];
    if (!q || (q.size === 0 && q.members < q.capacity)) { this.queueBox.classList.remove('on'); return; }
    this.queueBox.classList.add('on');
    this.queueBox.replaceChildren();
    el('small', '', this.queueBox, t.qTitle);
    el('div', 'qhead', this.queueBox, `${q.members >= q.capacity ? t.qFull : t.qIn} · ${q.members}/${q.capacity}`);
    if (q.size) el('div', 'qsub', this.queueBox, `${q.size} ${t.qWait}${q.priority ? ` · ${q.priority} ${t.qPrio}` : ''}`);
    q.top.slice(0, 5).forEach((e, i) => {
      const row = el('div', `qrow${e.priority ? ' prio' : ''}`, this.queueBox);
      el('span', '', row, `${i + 1}. ${e.priority ? '★ ' : ''}${e.name}`);
      if (e.amountText) el('b', '', row, e.amountText);
    });
    el('div', 'qhint', this.queueBox, t.qHint);
  }

  queueNotice(kind: 'joined' | 'priority' | 'position', name: string, position: number, size: number, amountText?: string) {
    const t = T[this.lang];
    if (kind === 'position') { this.showNotice(`${name}: ${t.qPos} #${position} / ${size}`, 6000); return; }
    if (this.toasts.childElementCount >= 4) this.toasts.firstElementChild?.remove();
    const el2 = el('div', `toast${kind === 'priority' ? ' prio' : ''}`, this.toasts);
    el('b', '', el2, `${kind === 'priority' ? '★ ' : ''}${name}`);
    el('span', '', el2, ` ${kind === 'priority' ? t.qPriority : t.qJoined} → #${position}${amountText ? ` (${amountText})` : ''}`);
    setTimeout(() => el2.classList.add('out'), 3600);
    setTimeout(() => el2.remove(), 4200);
  }

  toastJoin(name: string, demo: boolean) {
    if (this.toasts.childElementCount >= 4) this.toasts.firstElementChild?.remove();
    const t = el('div', 'toast', this.toasts);
    el('b', '', t, name);
    el('span', '', t, ` ${T[this.lang].joined}`);
    if (demo) el('em', '', t, 'DEMO');
    setTimeout(() => t.classList.add('out'), 3600);
    setTimeout(() => t.remove(), 4200);
  }

  /** Temporary thank-you banner. The amount is shown exactly as YouTube reported it. */
  support(e: SupportEffect) {
    const t = T[this.lang];
    this.banner.replaceChildren();
    this.banner.className = `banner on tier${Math.min(7, e.tier)}`;
    const head = el('div', 'bh', this.banner);
    el('span', '', head, e.kind === 'combo' ? t.combo : e.kind === 'member' ? t.member : e.kind === 'gift' ? t.gift : `${t.thanks}!`);
    if (e.source === 'demo') el('em', '', head, t.sim);
    else if (e.source !== 'youtube') el('em', `pl ${e.source}`, head, SOURCE_LABEL[e.source]);
    const others = e.others ?? [];
    el('div', 'bn', this.banner, others.length ? `${[e.name, ...others.slice(0, 2)].join(', ')}${others.length > 2 ? ` +${others.length - 2}` : ''}` : e.name);
    if (e.amountText) el('div', 'ba', this.banner, e.amountText);
    if (e.comment) el('div', 'bc', this.banner, e.comment);
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('on'), e.durationMs);
  }
  clearSupport() { this.banner.classList.remove('on'); }

  setVote(v: VoteState | null, winner?: string) {
    if (!v) {
      if (winner && this.voteBox.classList.contains('on')) { const w = this.voteBox.querySelector(`[data-k="${CSS.escape(winner)}"]`); w?.classList.add('win'); setTimeout(() => this.voteBox.classList.remove('on'), 3500); }
      else this.voteBox.classList.remove('on');
      return;
    }
    const t = T[this.lang];
    this.voteBox.classList.add('on');
    this.voteBox.replaceChildren();
    el('small', '', this.voteBox, `${t.vote} · ${v.kind === 'song' ? t.voteSong : t.voteEvent}`);
    const total = Math.max(1, v.options.reduce((s, o) => s + o.count, 0));
    const list = v.kind === 'song' ? [...v.options].sort((a, b) => b.count - a.count).slice(0, 4) : v.options;
    list.forEach((o) => {
      const row = el('div', 'vrow', this.voteBox);
      row.dataset.k = o.key;
      el('span', '', row, `${v.kind === 'event' ? `${v.options.indexOf(o) + 1}. ` : ''}${o.label}`);
      el('b', '', row, String(o.count));
      el('i', '', row).style.width = `${(o.count / total) * 100}%`;
    });
  }

  showNotice(text: string, ms = 7000) {
    this.notice.textContent = text;
    this.notice.classList.add('on');
    clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => this.notice.classList.remove('on'), ms);
  }
}
