import { EVENTS } from '../../shared/events.ts';
import {
  COMMANDS, GENRES, GENRE_LABEL, SC_EFFECTS,
  type AdminMsg, type AdminStatus, type ChatLogItem, type LogItem, type Member, type PublicState, type ServerMsg, type Settings,
} from '../../shared/protocol.ts';

type Lang = 'tr' | 'en';
const I18N: Record<string, [string, string]> = {
  youtube: ['YouTube bağlantısı', 'YouTube connection'], url: ['Yayın URL’si', 'Stream URL'], connect: ['Bağlan', 'Connect'], disconnect: ['Bağlantıyı kes', 'Disconnect'],
  platforms: ['Diğer platformlar', 'Other platforms'], channel: ['Kanal', 'Channel'], login: ['Twitch ile giriş', 'Log in with Twitch'], logout: ['Çıkış', 'Log out'],
  account: ['Hesap', 'Account'], notConfigured: ['.env içinde tanımlı değil', 'not configured in .env'], enterCode: ['Bu kodu girin:', 'Enter this code:'],
  twHelp: ['Resmi EventSub WebSocket. dev.twitch.tv → uygulama (Public istemci) → TWITCH_CLIENT_ID .env içine. Sonra “Twitch ile giriş”. Kanal boşsa kendi kanalınız okunur.', 'Official EventSub WebSocket. dev.twitch.tv → app (Public client) → TWITCH_CLIENT_ID in .env, then “Log in with Twitch”. Empty channel = your own channel.'],
  kickHelp: ['Resmi Kick API webhook ile çalışır: bilgisayardaki webhook portunu bir tünelle (ör. Cloudflare Tunnel) internete açın ve Kick geliştirici ayarlarında Webhook URL olarak girin. Yalnızca bu port açılır, panel açılmaz.', 'Official Kick API via webhooks: expose the webhook port with a tunnel (e.g. Cloudflare Tunnel) and set it as the Webhook URL in Kick developer settings. Only that port is exposed, not the panel.'],
  ttHelp: ['TikTok’un resmi canlı sohbet API’si yok. Bu bağlantı gayri resmi bir topluluk kütüphanesi ve üçüncü taraf imza servisi (Euler Stream) kullanır; her an bozulabilir ve TikTok kurallarıyla çelişebilir. Sorumluluk sizdedir. Kütüphane AGPL-3.0 lisanslıdır ve projeye dahil değildir: bir kez “npm run enable-tiktok” çalıştırın.', 'TikTok has no official LIVE chat API. This uses an unofficial community library and a third-party signing service (Euler Stream); it can break at any time and may conflict with TikTok’s terms. Use at your own risk. The library is AGPL-3.0 and not bundled: run “npm run enable-tiktok” once.'],
  accept: ['Riskleri anladım, gayri resmi bağlantıya izin ver', 'I understand the risks, allow the unofficial connector'], webhookPort: ['Webhook portu', 'Webhook port'],
  supporterVip: ['Destekçiye geçici VIP (dk, 0 = kapalı)', 'Temporary VIP for supporters (min, 0 = off)'],
  autoJoin: ['Destekçi kulüpte değilse otomatik katılsın', 'Supporters not in the club join automatically'],
  queueTitle: ['Kapı sırası', 'Door queue'], queuePrio: ['Kulüp doluyken destekçiler öne geçsin (miktara göre)', 'Supporters skip the queue when full (by amount)'],
  queueFree: ['Her N öncelikli girişte 1 ücretsiz (0 = kapalı)', 'Every N priority entries let 1 free viewer in (0 = off)'], inQueue: ['Sırada', 'In queue'], showComments: ['Destek mesajlarını göster', 'Show supporter messages'],
  skip: ['Efekti atla', 'Skip effect'], clearQueue: ['Kuyruğu temizle', 'Clear queue'],
  creds: ['Kimlik bilgileri', 'Credentials'], minPoll: ['Min. sorgu aralığı (ms)', 'Min poll interval (ms)'], apiKey: ['API anahtarı', 'API key'], oauth: ['OAuth', 'OAuth'], set: ['tanımlı', 'set'], notSet: ['tanımlı değil', 'not set'],
  credHelp: ['Anahtarlar yalnızca sunucudaki .env dosyasında tutulur ve tarayıcıya hiç gönderilmez. Değiştirmek için .env dosyasını düzenleyip sunucuyu yeniden başlatın.', 'Keys live only in the server-side .env file and are never sent to the browser. Edit .env and restart the server to change them.'],
  state: ['Durum', 'State'], transport: ['Aktarım', 'Transport'], video: ['Video', 'Video'], quota: ['Kullanılan kota (birim)', 'Quota used (units)'], msgs: ['İşlenen mesaj', 'Messages'],
  ytViewers: ['YouTube izleyici (API)', 'YouTube viewers (API)'], inClub: ['Kulüpteki karakter', 'Avatars in club'],
  chat: ['Canlı sohbet', 'Live chat'], members: ['Aktif karakterler', 'Active characters'], kick: ['Kaldır', 'Remove'], block: ['Engelle', 'Block'], unblock: ['Engeli kaldır', 'Unblock'],
  blocked: ['Engellenenler', 'Blocked users'], vip: ['VIP', 'VIP'], maxChars: ['Maks. karakter', 'Max characters'],
  commands: ['Komut ayarları', 'Command settings'], cmd: ['Komut', 'Command'], on: ['Açık', 'On'], cooldown: ['Bekleme (sn)', 'Cooldown (s)'],
  superchat: ['Super Chat efektleri', 'Super Chat effects'], effectsOn: ['Efektler açık', 'Effects enabled'], minTier: ['Min. seviye', 'Min tier'], baseDur: ['Temel süre (ms)', 'Base duration (ms)'], queue: ['Kuyruk', 'Queue'],
  scNote: ['Efektler yalnızca kozmetiktir. Ücretsiz izleyiciler tüm oyun özelliklerine erişir.', 'Effects are cosmetic only. Free viewers get every gameplay feature.'],
  music: ['Müzik', 'Music'], volume: ['Ses', 'Volume'], shuffle: ['Karıştır', 'Shuffle'], repeat: ['Tekrar', 'Repeat'], crossfade: ['Crossfade (sn)', 'Crossfade (s)'],
  bpm: ['BPM (0 = otomatik)', 'BPM (0 = auto)'], source: ['Kaynak', 'Source'], prev: ['Önceki', 'Prev'], next: ['Sonraki', 'Next'], toggle: ['Oynat/Durdur', 'Play/Pause'], rescan: ['Klasörü tara', 'Rescan folder'],
  genre: ['Tür çal', 'Play genre'], nowPlaying: ['Çalıyor', 'Now playing'], detected: ['algılanan', 'detected'],
  musicLock: ['Müziği sabitle (etkinlik ve sohbet oylaması parçayı değiştirmesin)', 'Lock music (events and chat votes do not change the track)'],
  multiLive: ['{n} adet /live sayfası açık. Her biri kendi müziğini ayrı çalar ve bu yüzden müzik değişiyormuş gibi duyulur. Yalnızca OBS içindeki sayfayı açık bırak veya diğerlerine ?mute ekle.', '{n} /live pages are open. Each plays its own music, so it sounds like the track keeps changing. Keep only the OBS one open or add ?mute to the others.'],
  noFiles: ['music/ klasöründe desteklenen dosya bulunamadı (mp3, wav, ogg, m4a, aac, flac, opus, webm). Yerleşik müzik çalıyor.', 'No supported files in music/ (mp3, wav, ogg, m4a, aac, flac, opus, webm). Playing built-in music.'],
  ytLinks: ['YouTube bağlantıları (her satıra bir link, isteğe bağlı BPM: link | 128)', 'YouTube links (one per line, optional BPM: link | 128)'],
  ytSave: ['Bağlantıları kaydet', 'Save links'],
  ytNote: ['Resmi YouTube oynatıcısıyla çalar, yayında küçük bir video kartı olarak görünür (YouTube kuralı). Sadece kullanım izni olan şarkıları ekle. Kaynağı "youtube" seçersen yalnızca bu linkler çalar. Yerleştirmeye kapalı videolar atlanır, bazı videolarda reklam çıkabilir.', 'Plays through the official YouTube player and shows as a small video card on stream (YouTube rule). Only add songs you may use. Choose source "youtube" to play only these links. Videos that block embedding are skipped; some videos may show ads.'],
  lights: ['Işıklar', 'Lights'], intensity: ['Yoğunluk', 'Intensity'], lasers: ['Lazerler', 'Lasers'], fog: ['Sis', 'Fog'], strobe: ['Flaş (yumuşak)', 'Strobe (soft)'], mode: ['Mod', 'Mode'],
  camera: ['Kamera', 'Camera'], auto: ['Otomatik', 'Auto'], welcome: ['Yeni gelen için giriş çekimi', 'Welcome shot for new arrivals'],
  events: ['Etkinlikler', 'Events'], current: ['Şu an', 'Current'], startEvent: ['Başlat', 'Start'], vote: ['Oylama başlat', 'Start vote'], eventMinutes: ['Etkinlik süresi (dk)', 'Event length (min)'], autoVote: ['Otomatik oylama', 'Automatic vote'],
  graphics: ['Grafik ve yayın', 'Graphics & output'], quality: ['Kalite', 'Quality'], dynres: ['Dinamik çözünürlük', 'Dynamic resolution'], layout: ['Yerleşim', 'Layout'], overlayLang: ['Yayın dili', 'Overlay language'],
  names: ['İsimler', 'Names'], avatars: ['Profil fotoğrafları', 'Profile pictures'], vipOpen: ['VIP herkese açık', 'VIP open to all'],
  perf: ['Performans', 'Performance'], bench: ['Benchmark çalıştır', 'Run benchmark'], noLive: ['Yayın ekranı (/live) açık değil', 'Live view (/live) is not open'],
  demo: ['Demo ve testler', 'Demo & tests'], demoStart: ['Demo başlat', 'Start demo'], demoStop: ['Demo durdur', 'Stop demo'], add: ['ekle', 'add'], send: ['Gönder', 'Send'],
  simSc: ['Simüle Super Chat', 'Simulated Super Chat'], tier: ['Seviye', 'Tier'], discTest: ['Bağlantı kopma testi', 'Disconnect test'], loadTest: ['Yük testi (300)', 'Load test (300)'],
  demoNote: ['Demo olayları SİMÜLASYON olarak işaretlenir ve gerçek yayın bağlıyken çalışmaz.', 'Demo events are marked SIMULATION and are refused while a real stream is connected.'],
  tests: ['Testler', 'Tests'], obs: ['OBS', 'OBS'], obsHelp: ['OBS → Kaynak ekle → Tarayıcı → URL:', 'OBS → Add source → Browser → URL:'], logs: ['Hata kayıtları', 'Logs'], clear: ['Temizle', 'Clear'],
  stop: ['ACİL DURDUR', 'EMERGENCY STOP'], resume: ['Devam ettir', 'Resume'], live: ['Canlı', 'Live'], idle: ['Boşta', 'Idle'], uptime: ['Çalışma süresi', 'Uptime'],
};

const PCOL: Record<string, string> = { youtube: '#e8002d', twitch: '#9146ff', kick: '#1ec02e', tiktok: '#111' };
const PLBL: Record<string, string> = { youtube: 'YT', twitch: 'TW', kick: 'KICK', tiktok: 'TT' };
let lang: Lang = (localStorage.getItem('nc-lang') as Lang) || 'tr';
const t = (k: string) => (I18N[k] ? I18N[k][lang === 'tr' ? 0 : 1] : k);
let ws: WebSocket;
let state: PublicState | null = null;
let status: AdminStatus | null = null;
const members = new Map<string, Member>();
const chat: ChatLogItem[] = [];
const logs: LogItem[] = [];
const send = (m: AdminMsg) => ws?.readyState === 1 && ws.send(JSON.stringify(m));
const patch = (p: Partial<Settings>) => send({ t: 'settings', patch: p });
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmtT = (ts: number) => new Date(ts).toLocaleTimeString();
const app = $('app');

function render() {
  const s = state?.settings;
  if (!s) { app.innerHTML = '<p style="padding:20px">…</p>'; return; }
  document.documentElement.lang = lang;
  const opt = (v: string, label: string, cur: string) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  const chk = (id: string, on: boolean) => `<input type="checkbox" id="${id}" ${on ? 'checked' : ''}>`;
  const origin = location.origin;
  app.innerHTML = `
<header><h1>NEON <span>CLUB</span> LIVE</h1><span id="hMode" class="pill"></span><span id="hYt" class="pill"></span><span id="hLive" class="pill"></span>
<span class="grow"></span><span class="mut" id="hUp"></span><button id="lang">${lang === 'tr' ? 'English' : 'Türkçe'}</button></header>
<main>
<section><h2>${t('youtube')}</h2>
  <div class="row"><input type="text" id="ytUrl" placeholder="https://www.youtube.com/watch?v=… / youtu.be/…" value="${esc(localStorage.getItem('nc-url') ?? '')}"></div>
  <div class="row"><button class="pri" id="ytConnect">${t('connect')}</button><button id="ytDisconnect">${t('disconnect')}</button></div>
  <div class="row"><label>${t('minPoll')}</label><input type="number" id="minPoll" min="1000" max="60000" step="500" value="${s.minPollMs}"></div>
  <div class="kv" id="ytInfo"></div>
  <h2 style="margin-top:12px">${t('creds')}</h2><div class="kv" id="credInfo"></div><p class="mut">${t('credHelp')}</p>
</section>
<section><h2>${t('platforms')}</h2>
  ${(['twitch', 'kick', 'tiktok'] as const).map((p) => `<div class="plat" id="pl_${p}"><div class="row"><b style="min-width:70px">${p === 'twitch' ? 'Twitch' : p === 'kick' ? 'Kick' : 'TikTok'}</b><span class="pill" id="pls_${p}">—</span><span class="mut" id="pld_${p}"></span></div>
    <div class="row"><input type="text" id="plc_${p}" placeholder="${p === 'tiktok' ? '@username' : t('channel')}" value="${esc(p === 'tiktok' ? s.platforms.tiktok.username : s.platforms[p].channel)}">
    <button class="pri" data-pl="${p}" data-c="connect">${t('connect')}</button><button data-pl="${p}" data-c="disconnect">${t('disconnect')}</button></div>
    ${p === 'twitch' ? `<div class="row"><button data-pl="twitch" data-c="login">${t('login')}</button><button data-pl="twitch" data-c="logout">${t('logout')}</button><span id="plAcc" class="mut"></span></div><div class="row" id="plCode"></div>` : ''}
    ${p === 'kick' ? `<div class="row mut" id="plKick"></div>` : ''}
    ${p === 'tiktok' ? `<div class="row"><label style="min-width:0">${chk('ttAccept', s.platforms.tiktok.acceptUnofficial)} ${t('accept')}</label></div>` : ''}
    <p class="mut">${t(p === 'twitch' ? 'twHelp' : p === 'kick' ? 'kickHelp' : 'ttHelp')}</p></div>`).join('')}
</section>
<section class="wide"><h2>${t('chat')}</h2><div class="list chat" id="chat"></div></section>
<section><h2>${t('members')} <span id="mCount"></span></h2>
  <div class="row"><label>${t('maxChars')}</label><input type="number" id="maxChars" min="1" max="1510" value="${s.maxCharacters}"></div>
  <div class="list" id="members"></div>
  <h2 style="margin-top:12px">${t('blocked')}</h2><div class="list" id="blocked"></div>
</section>
<section><h2>${t('commands')}</h2><table><tr><td><b>${t('cmd')}</b></td><td><b>${t('on')}</b></td><td><b>${t('cooldown')}</b></td></tr>
  ${COMMANDS.map((c) => `<tr><td>!${c}</td><td>${chk(`cmd_on_${c}`, s.commands[c].on)}</td><td><input type="number" min="0" max="600" id="cmd_cd_${c}" value="${s.commands[c].cooldown}"></td></tr>`).join('')}</table></section>
<section><h2>${t('superchat')}</h2><div class="row"><label>${t('effectsOn')}</label>${chk('scOn', s.superchat.enabled)}<span class="mut">${t('queue')}: <b id="scQueue">0</b></span></div>
  <div class="row"><label>${t('baseDur')}</label><input type="number" id="scDur" min="2000" max="20000" step="500" value="${s.superchat.baseDurationMs}"></div>
  <table>${SC_EFFECTS.map((e) => `<tr><td>${e}</td><td>${chk(`sc_on_${e}`, s.superchat.effects[e].on)}</td><td>${t('minTier')} <input type="number" min="1" max="11" id="sc_t_${e}" value="${s.superchat.effects[e].minTier}"></td></tr>`).join('')}</table>
  <div class="row"><label>${t('supporterVip')}</label><input type="number" id="supVip" min="0" max="600" value="${s.supporterVipMinutes}"></div>
  <div class="row"><label>${t('autoJoin')}</label>${chk('autoJoin', s.supporterAutoJoin)}<label style="min-width:0">${t('showComments')}</label>${chk('scCom', s.superchat.showComments)}</div>
  <h2 style="margin-top:12px">${t('queueTitle')} <span class="mut" id="qInfo"></span></h2>
  <div class="row"><label style="min-width:0">${chk('qPrio', s.queuePaidPriority)} ${t('queuePrio')}</label></div>
  <div class="row"><label>${t('queueFree')}</label><input type="number" id="qFree" min="0" max="50" value="${s.queueFreeEvery}"></div>
  <div class="list" id="qList" style="max-height:140px"></div>
  <div class="row"><button id="fxSkip">⏭ ${t('skip')}</button><button id="fxClear">${t('clearQueue')}</button></div>
  <p class="mut">${t('scNote')}</p></section>
<section><h2>${t('music')}</h2><div class="kv" id="musicInfo"></div>
  <div class="row"><button id="mPrev">⏮ ${t('prev')}</button><button id="mToggle">⏯ ${t('toggle')}</button><button id="mNext">${t('next')} ⏭</button><button id="mRescan">${t('rescan')}</button></div>
  <div class="row"><label>${t('volume')}</label><input type="range" id="vol" min="0" max="1" step="0.01" value="${s.music.volume}"></div>
  <div class="row"><label>${t('crossfade')}</label><input type="range" id="xf" min="0" max="12" step="0.5" value="${s.music.crossfade}"><span id="xfV">${s.music.crossfade}</span></div>
  <div class="row"><label>${t('bpm')}</label><input type="number" id="bpmO" min="0" max="200" step="0.5" value="${s.music.bpmOverride}"></div>
  <div class="row"><label>${t('shuffle')}</label>${chk('shuf', s.music.shuffle)}<label style="min-width:0">${t('repeat')}</label><select id="rep">${['off', 'all', 'one'].map((v) => opt(v, v, s.music.repeat)).join('')}</select>
    <label style="min-width:0">${t('source')}</label><select id="msrc">${['auto', 'files', 'builtin', 'youtube'].map((v) => opt(v, v, s.music.source)).join('')}</select></div>
  <div class="row" style="flex-direction:column;align-items:stretch"><label>${t('ytLinks')}</label>
    <textarea id="ytl" rows="4" spellcheck="false" placeholder="https://www.youtube.com/watch?v=...&#10;https://youtu.be/... | 128" style="width:100%;font:inherit;font-size:.85em;background:#0d0d16;color:#fff;border:1px solid #333;border-radius:6px;padding:6px">${esc((s.music.youtube ?? []).join('\n'))}</textarea>
    <button id="ytSave" style="margin-top:6px">${t('ytSave')}</button><p class="mut" style="margin:4px 0 0">${t('ytNote')}</p></div>
  <div class="row"><label style="min-width:0">${chk('mlock', s.music.lock)} ${t('musicLock')}</label></div>
  <div class="row"><label>${t('genre')}</label><select id="genre">${GENRES.map((g) => opt(g, GENRE_LABEL[g], '')).join('')}</select><button id="genreGo">▶</button></div>
  <div id="musicWarn"></div>
  <div class="list" id="playlist" style="max-height:180px"></div></section>
<section><h2>${t('lights')}</h2>
  <div class="row"><label>${t('intensity')}</label><input type="range" id="li" min="0.2" max="1.6" step="0.05" value="${s.lights.intensity}"></div>
  <div class="row"><label>${t('fog')}</label><input type="range" id="lf" min="0" max="1" step="0.05" value="${s.lights.fog}"></div>
  <div class="row"><label>${t('lasers')}</label>${chk('ll', s.lights.lasers)}<label style="min-width:0">${t('strobe')}</label>${chk('ls', s.lights.strobe)}</div>
  <div class="row"><label>${t('mode')}</label><select id="lm">${['auto', 'neon', 'disco', 'techno', 'laser', 'warm', 'color', 'show'].map((v) => opt(v, v, s.lights.mode)).join('')}</select></div></section>
<section><h2>${t('camera')}</h2><div class="row"><label>${t('auto')}</label>${chk('camAuto', s.cameraAuto)}<label style="min-width:0">${t('welcome')}</label>${chk('camWel', s.welcomeCamera)}</div>
  <div class="grid2">${['auto', 'wide', 'dj', 'djback', 'crowd', 'top', 'vip', 'door', 'balcony', 'upper', 'orbit', 'stage', 'lounge', 'user'].map((c) => `<button data-cam="${c}">${c}</button>`).join('')}</div></section>
<section><h2>${t('events')}</h2><div class="kv" id="evInfo"></div>
  <div class="row"><select id="evSel">${EVENTS.map((e) => opt(e.id, e.name[lang], state!.event.id)).join('')}</select><button class="pri" id="evGo">${t('startEvent')}</button><button id="evVote">${t('vote')}</button></div>
  <div class="row"><label>${t('eventMinutes')}</label><input type="number" id="evMin" min="1" max="120" value="${s.eventMinutes}"><label style="min-width:0">${t('autoVote')}</label>${chk('evAuto', s.eventVoting)}</div></section>
<section><h2>${t('graphics')}</h2>
  <div class="row"><label>${t('quality')}</label><select id="q">${['low', 'medium', 'high', 'ultra'].map((v) => opt(v, v, s.quality)).join('')}</select><label style="min-width:0">${t('dynres')}</label>${chk('dyn', s.dynamicResolution)}</div>
  <div class="row"><label>${t('layout')}</label><select id="lay">${opt('landscape', '1920×1080', s.layout)}${opt('portrait', '1080×1920', s.layout)}</select><label style="min-width:0">${t('overlayLang')}</label><select id="olang">${opt('tr', 'Türkçe', s.overlayLang)}${opt('en', 'English', s.overlayLang)}</select></div>
  <div class="row"><label>${t('names')}</label>${chk('names', s.showNames)}<label style="min-width:0">${t('avatars')}</label>${chk('avs', s.showAvatars)}<label style="min-width:0">${t('vipOpen')}</label>${chk('vipOpen', s.vipOpen)}</div>
  <h2 style="margin-top:12px">${t('perf')}</h2><div class="kv" id="perf"></div><div class="row"><button id="bench">${t('bench')}</button></div></section>
<section><h2>${t('demo')}</h2>
  <div class="row">${[10, 50, 100, 300, 1500].map((n) => `<button class="pri" data-demo="${n}">${t('demoStart')} ${n}</button>`).join('')}</div>
  <div class="row">${[10, 50].map((n) => `<button data-add="${n}">+${n} ${t('add')}</button>`).join('')}<button id="demoStop">${t('demoStop')}</button><button id="loadTest">${t('loadTest')}</button><button id="loadTest1500">${t('loadTest')} 1500</button></div>
  <div class="row"><input type="text" id="demoText" value="!dance"><button id="demoSend">${t('send')}</button></div>
  <div class="row"><label>${t('simSc')}</label>${t('tier')} <input type="number" id="scTier" min="1" max="11" value="3"><button id="demoSc">${t('send')}</button></div>
  <div class="row"><button id="discTest">${t('discTest')}</button></div>
  <h2 style="margin-top:12px">${t('tests')}</h2><div class="grid2">${['lights', 'lightshow', 'confetti', 'fireworks', 'djmessage', 'sync'].map((x) => `<button data-test="${x}">${x}</button>`).join('')}
  <select id="animSel">${['hiphop_bounce', 'hiphop_groove', 'shuffle_run', 'shuffle_t', 'break_toprock', 'break_floor', 'robot_a', 'robot_b', 'freestyle_a', 'freestyle_b', 'house_jack', 'house_step', 'disco_point', 'disco_roll', 'twist', 'step_touch', 'slow_sway', 'edm_pump', 'hands_up', 'techno_stomp', 'trance_wave', 'arms_90s', 'choreo_a', 'choreo_b', 'special'].map((v) => opt(v, v, '')).join('')}</select><button id="animGo">anim ▶</button></div>
  <p class="mut">${t('demoNote')}</p></section>
<section><h2>${t('obs')}</h2><p>${t('obsHelp')}</p><p><code>${origin}/live</code> (1920×1080)</p><p><code>${origin}/live?layout=portrait</code> (1080×1920)</p>
  <p class="mut">README → “OBS”</p></section>
<section class="wide"><h2>${t('logs')} <button id="clearLogs" style="float:right">${t('clear')}</button></h2><div class="list log" id="logs"></div></section>
</main>
<button class="stop ${state!.emergency ? '' : 'danger'}" id="stop">${state!.emergency ? t('resume') : '⛔ ' + t('stop')}</button>`;
  bind();
  renderMembers(); renderChat(); renderLogs(); renderStatus(); renderQueue();
}

function bind() {
  const on = (id: string, ev: string, fn: (e: Event) => void) => $(id)?.addEventListener(ev, fn);
  const val = (id: string) => ($(id) as HTMLInputElement).value;
  const checked = (id: string) => ($(id) as HTMLInputElement).checked;
  const num = (id: string) => Number(val(id));
  const s = state!.settings;
  on('lang', 'click', () => { lang = lang === 'tr' ? 'en' : 'tr'; localStorage.setItem('nc-lang', lang); render(); });
  on('ytConnect', 'click', () => { localStorage.setItem('nc-url', val('ytUrl')); send({ t: 'connect', url: val('ytUrl') }); });
  on('ytDisconnect', 'click', () => send({ t: 'disconnect' }));
  on('maxChars', 'change', () => patch({ maxCharacters: num('maxChars') }));
  on('supVip', 'change', () => patch({ supporterVipMinutes: Math.max(0, num('supVip')) }));
  on('autoJoin', 'change', () => patch({ supporterAutoJoin: checked('autoJoin') }));
  on('qPrio', 'change', () => patch({ queuePaidPriority: checked('qPrio') }));
  on('qFree', 'change', () => patch({ queueFreeEvery: Math.max(0, num('qFree')) }));
  on('fxSkip', 'click', () => send({ t: 'effects', cmd: 'skip' }));
  on('fxClear', 'click', () => send({ t: 'effects', cmd: 'clear' }));
  on('ttAccept', 'change', () => patch({ platforms: { ...state!.settings.platforms, tiktok: { ...state!.settings.platforms.tiktok, acceptUnofficial: checked('ttAccept') } } }));
  document.querySelectorAll<HTMLElement>('[data-pl]').forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.pl as 'twitch' | 'kick' | 'tiktok', c = b.dataset.c as 'connect' | 'disconnect' | 'login' | 'logout';
    send({ t: 'platform', platform: p, cmd: c, channel: val(`plc_${p}`) });
  }));
  on('minPoll', 'change', () => patch({ minPollMs: Math.max(1000, num('minPoll')) }));
  for (const c of COMMANDS) {
    const upd = () => patch({ commands: { ...state!.settings.commands, [c]: { on: checked(`cmd_on_${c}`), cooldown: num(`cmd_cd_${c}`) } } });
    on(`cmd_on_${c}`, 'change', upd); on(`cmd_cd_${c}`, 'change', upd);
  }
  const scUpd = () => {
    const effects = { ...s.superchat.effects };
    for (const e of SC_EFFECTS) effects[e] = { on: checked(`sc_on_${e}`), minTier: num(`sc_t_${e}`) };
    patch({ superchat: { enabled: checked('scOn'), showComments: checked('scCom'), baseDurationMs: num('scDur'), effects } });
  };
  on('scOn', 'change', scUpd); on('scDur', 'change', scUpd); on('scCom', 'change', scUpd);
  for (const e of SC_EFFECTS) { on(`sc_on_${e}`, 'change', scUpd); on(`sc_t_${e}`, 'change', scUpd); }
  const mUpd = () => { $('xfV').textContent = val('xf'); patch({ music: { volume: num('vol'), crossfade: num('xf'), bpmOverride: num('bpmO'), shuffle: checked('shuf'), repeat: val('rep') as Settings['music']['repeat'], source: val('msrc') as Settings['music']['source'], lock: checked('mlock'), youtube: state!.settings.music.youtube ?? [] } }); };
  for (const id of ['vol', 'xf']) on(id, 'input', mUpd);
  for (const id of ['bpmO', 'shuf', 'rep', 'msrc', 'mlock']) on(id, 'change', mUpd);
  on('ytSave', 'click', () => {
    const lines = ($('ytl') as HTMLTextAreaElement).value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 200);
    patch({ music: { ...state!.settings.music, youtube: lines } });
  });
  on('mPrev', 'click', () => send({ t: 'music', cmd: 'prev' })); on('mNext', 'click', () => send({ t: 'music', cmd: 'next' }));
  on('mToggle', 'click', () => send({ t: 'music', cmd: 'toggle' })); on('mRescan', 'click', () => send({ t: 'music', cmd: 'rescan' }));
  on('genreGo', 'click', () => send({ t: 'music', cmd: 'genre', arg: val('genre') }));
  const lUpd = () => patch({ lights: { intensity: num('li'), fog: num('lf'), lasers: checked('ll'), strobe: checked('ls'), mode: val('lm') as Settings['lights']['mode'] } });
  for (const id of ['li', 'lf']) on(id, 'input', lUpd);
  for (const id of ['ll', 'ls', 'lm']) on(id, 'change', lUpd);
  on('camAuto', 'change', () => patch({ cameraAuto: checked('camAuto') })); on('camWel', 'change', () => patch({ welcomeCamera: checked('camWel') }));
  document.querySelectorAll<HTMLElement>('[data-cam]').forEach((b) => b.addEventListener('click', () => send({ t: 'camera', shot: b.dataset.cam! })));
  on('evGo', 'click', () => send({ t: 'event', id: val('evSel') })); on('evVote', 'click', () => send({ t: 'eventVote' }));
  on('evMin', 'change', () => patch({ eventMinutes: num('evMin') })); on('evAuto', 'change', () => patch({ eventVoting: checked('evAuto') }));
  on('q', 'change', () => patch({ quality: val('q') as Settings['quality'] })); on('dyn', 'change', () => patch({ dynamicResolution: checked('dyn') }));
  on('lay', 'change', () => patch({ layout: val('lay') as Settings['layout'] })); on('olang', 'change', () => patch({ overlayLang: val('olang') as Lang }));
  on('names', 'change', () => patch({ showNames: checked('names') })); on('avs', 'change', () => patch({ showAvatars: checked('avs') })); on('vipOpen', 'change', () => patch({ vipOpen: checked('vipOpen') }));
  on('bench', 'click', () => send({ t: 'test', what: 'bench' }));
  document.querySelectorAll<HTMLElement>('[data-demo]').forEach((b) => b.addEventListener('click', () => { send({ t: 'demo', cmd: 'stop' }); if (Number(b.dataset.demo) > s.maxCharacters) patch({ maxCharacters: Number(b.dataset.demo) }); send({ t: 'demo', cmd: 'start', count: Number(b.dataset.demo) }); }));
  document.querySelectorAll<HTMLElement>('[data-add]').forEach((b) => b.addEventListener('click', () => send({ t: 'demo', cmd: 'add', count: Number(b.dataset.add) })));
  on('demoStop', 'click', () => send({ t: 'demo', cmd: 'stop' })); on('loadTest', 'click', () => send({ t: 'demo', cmd: 'load', count: 300 }));
  on('loadTest1500', 'click', () => send({ t: 'demo', cmd: 'load', count: 1500 }));
  on('demoSend', 'click', () => send({ t: 'demo', cmd: 'chat', text: val('demoText') }));
  on('demoSc', 'click', () => send({ t: 'demo', cmd: 'superchat', tier: num('scTier') }));
  on('discTest', 'click', () => send({ t: 'demo', cmd: 'disconnectTest' }));
  document.querySelectorAll<HTMLElement>('[data-test]').forEach((b) => b.addEventListener('click', () => send({ t: 'test', what: b.dataset.test! })));
  on('animGo', 'click', () => send({ t: 'test', what: 'anim', arg: val('animSel') }));
  on('clearLogs', 'click', () => { send({ t: 'clearLogs' }); logs.length = 0; renderLogs(); });
  on('stop', 'click', () => { if (state!.emergency || confirm(t('stop') + '?')) send({ t: 'emergency', on: !state!.emergency }); });
  $('members').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    const id = b.dataset.id!;
    if (b.dataset.a === 'kick') send({ t: 'kick', id });
    else if (b.dataset.a === 'block' && confirm(`${t('block')}: ${members.get(id)?.name}?`)) send({ t: 'block', id });
    else if (b.dataset.a === 'vip') send({ t: 'grantVip', id, on: !members.get(id)?.vip });
    else if (b.dataset.a === 'cam') send({ t: 'camera', shot: 'user', target: id });
  });
  $('blocked').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (b) send({ t: 'unblock', id: b.dataset.id! }); });
  $('playlist').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (b) send({ t: 'music', cmd: 'play', arg: b.dataset.i! }); });
}

let membersDirty = false;
function renderMembers() {
  membersDirty = false;
  const box = $('members');
  if (!box) return;
  $('mCount').textContent = `(${members.size})`;
  const list = [...members.values()].sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 300);
  box.innerHTML = list.map((m) => `<div class="it"><span class="n">${esc(m.name)}${m.source === 'demo' ? '<span class="tag">DEMO</span>' : `<span class="tag yt" style="background:${PCOL[m.source]}">${PLBL[m.source]}</span>`}${m.vip ? '<span class="tag vip">VIP</span>' : ''} <span class="mut">${m.zone}${m.sitting ? ' · sit' : ''}</span></span>
    <button data-a="cam" data-id="${esc(m.id)}">🎥</button><button data-a="vip" data-id="${esc(m.id)}">VIP</button><button data-a="kick" data-id="${esc(m.id)}">${t('kick')}</button><button data-a="block" data-id="${esc(m.id)}">${t('block')}</button></div>`).join('');
}

function renderQueue() {
  const q = state?.queue, box = $('qList');
  if (!q || !box) return;
  $('qInfo').textContent = `${t('inQueue')}: ${q.size} (${q.priority} ★) · ${q.members}/${q.capacity}`;
  box.innerHTML = q.top.map((e, i) => `<div class="it"><span class="n">${i + 1}. ${e.priority ? '★ ' : ''}${esc(e.name)} <span class="mut">${esc(e.amountText)}</span></span></div>`).join('') || '<div class="it mut">—</div>';
}

function renderChat() {
  const box = $('chat');
  if (!box) return;
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 30;
  box.innerHTML = chat.slice(-200).map((c) => `<div class="it"><span class="r">${esc(c.result ?? '')} · ${fmtT(c.ts)}</span>${c.source === 'demo' ? '<span class="tag">SIM</span> ' : `<span class="tag yt" style="background:${PCOL[c.source]}">${PLBL[c.source]}</span> `}<span class="a">${esc(c.author)}</span>
    ${c.amountText ? `<span class="sc">${esc(c.amountText)}</span>` : ''} ${c.kind !== 'text' ? `<span class="tag vip">${c.kind}</span>` : ''} ${esc(c.text)}</div>`).join('');
  if (atBottom) box.scrollTop = box.scrollHeight;
}

function renderLogs() {
  const box = $('logs');
  if (!box) return;
  box.innerHTML = logs.slice(-300).map((l) => `<div class="it ${l.level}">${fmtT(l.ts)} [${l.level}] ${esc(l.scope)}: ${esc(l.msg)}</div>`).join('');
  box.scrollTop = box.scrollHeight;
}

function renderStatus() {
  if (!status || !$('ytInfo')) return;
  const y = status.youtube;
  const cls = y.state === 'connected' ? 'ok' : ['error', 'quota', 'chat_disabled'].includes(y.state) ? 'err' : y.state === 'disconnected' ? '' : 'warn';
  $('hYt').className = `pill ${cls}`; $('hYt').textContent = `YouTube: ${y.state}${y.detail === 'SIMULATION' ? ' (SIM)' : ''}`;
  $('hMode').className = `pill ${status.mode === 'demo' ? 'demo' : status.mode === 'live' ? 'ok' : ''}`; $('hMode').textContent = status.mode.toUpperCase();
  $('hLive').className = `pill ${status.liveClients ? 'ok' : 'err'}`; $('hLive').textContent = `/live × ${status.liveClients}`;
  $('hUp').textContent = `${t('uptime')}: ${Math.floor(status.uptime / 3600000)}h ${Math.floor(status.uptime / 60000) % 60}m`;
  $('ytInfo').innerHTML = `<span>${t('state')}</span><b>${esc(y.state)} ${esc(y.detail)}${y.retryInMs ? ` (${Math.round(y.retryInMs / 1000)}s)` : ''}</b><span>${t('transport')}</span><b>${y.transport}</b>
    <span>${t('video')}</span><b>${esc(y.videoId)} ${esc(y.title)}</b><span>${t('msgs')}</span><b>${y.messages}</b><span>${t('quota')}</span><b>~${y.quotaUsed}</b>
    <span>${t('ytViewers')}</span><b>${y.viewers ?? '—'}</b><span>${t('inClub')}</span><b>${members.size}</b>`;
  $('credInfo').innerHTML = `<span>${t('apiKey')}</span><b>${y.hasKey ? '✅ ' + t('set') : '— ' + t('notSet')}</b><span>${t('oauth')}</span><b>${y.hasOAuth ? '✅ ' + t('set') : '— ' + t('notSet')}</b>`;
  $('scQueue').textContent = String(status.queueLength);
  for (const p of ['twitch', 'kick', 'tiktok'] as const) {
    const ps = status.platforms[p];
    const c = ps.state === 'connected' ? 'ok' : ps.state === 'error' ? 'err' : ps.state === 'disconnected' ? '' : 'warn';
    $(`pls_${p}`).className = `pill ${c}`;
    $(`pls_${p}`).textContent = ps.configured ? ps.state : t('notConfigured');
    $(`pld_${p}`).textContent = `${ps.channel ? '#' + ps.channel + ' · ' : ''}${ps.detail}${ps.retryInMs ? ` (${Math.round(ps.retryInMs / 1000)}s)` : ''} · ${ps.messages}`;
  }
  const tw = status.platforms.twitch;
  $('plAcc').textContent = tw.account ? `${t('account')}: ${tw.account}` : '';
  $('plCode').innerHTML = tw.auth ? `${t('enterCode')} <b style="font-size:20px;letter-spacing:.15em">${esc(tw.auth.userCode)}</b> → <a href="${esc(tw.auth.verificationUri)}" target="_blank" rel="noopener" style="color:var(--acc2)">${esc(tw.auth.verificationUri)}</a>` : '';
  $('plKick').textContent = `${t('webhookPort')}: ${status.platforms.kick.webhookPort ?? 3001} → Webhook URL: https://<tunnel>/webhooks/kick`;
  const st = status.stats;
  $('perf').innerHTML = st ? `<span>FPS</span><b>${st.fps} (${st.frameMs} ms)</b><span>Draw calls</span><b>${st.drawCalls}</b><span>Triangles</span><b>${st.triangles.toLocaleString()}</b>
    <span>${t('inClub')}</span><b>${st.characters} (${st.visible} visible)</b><span>Render</span><b>${st.width}×${st.height} (×${st.renderScale})</b><span>JS heap</span><b>${st.heapMB ? st.heapMB + ' MB' : 'n/a'}</b>
    <span>GPU</span><b>${esc(st.gpu)}</b><span>GPU res.</span><b>${st.geometries} geo / ${st.textures} tex</b>` : `<span></span><b>${t('noLive')}</b>`;
  const m = status.music;
  $('musicInfo').innerHTML = m ? `<span>${t('nowPlaying')}</span><b>${esc(m.title)}</b><span>BPM</span><b>${m.bpm}${m.bpmDetected ? ` (${t('detected')} ${m.bpmDetected})` : ''}</b>
    <span></span><b>${Math.floor(m.position / 60)}:${String(Math.floor(m.position % 60)).padStart(2, '0')} / ${Math.floor(m.duration / 60)}:${String(Math.floor(m.duration % 60)).padStart(2, '0')} ${m.playing ? '▶' : '⏸'}</b>` : `<span></span><b>${t('noLive')}</b>`;
  const warn: string[] = [];
  if (status.liveClients > 1) warn.push(t('multiLive').replace('{n}', String(status.liveClients)));
  if (state?.settings.music.source !== 'builtin' && status.playlist.length && status.playlist.every((p) => p.builtin)) warn.push(t('noFiles'));
  $('musicWarn').innerHTML = warn.map((w) => `<div class="it" style="color:#ffb347">⚠ ${esc(w)}</div>`).join('');
  const pl = $('playlist');
  const sig = status.playlist.map((p) => p.title).join('|');
  if (pl.dataset.sig !== sig) {
    pl.dataset.sig = sig;
    pl.innerHTML = status.playlist.map((p, i) => `<div class="it"><span class="n">${esc(p.title)} <span class="mut">${esc(p.genre)}${p.builtin ? ' · built-in' : ''}</span></span><button data-i="${i}">▶</button></div>`).join('');
  }
  $('blocked').innerHTML = status.blocked.map((b) => `<div class="it"><span class="n">${esc(b.name)} <span class="mut">${esc(b.id)}</span></span><button data-id="${esc(b.id)}">${t('unblock')}</button></div>`).join('') || '<div class="it mut">—</div>';
  if (state) {
    const left = Math.max(0, state.eventEndsAt - Date.now());
    $('evInfo').innerHTML = `<span>${t('current')}</span><b>${esc(state.event.name[lang])} (${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')})</b><span>→</span><b>${esc(state.nextEvent?.name[lang] ?? '—')}</b>
      ${state.vote ? `<span>${t('vote')}</span><b>${state.vote.options.slice(0, 4).map((o) => `${esc(o.label)}: ${o.count}`).join(' · ')}</b>` : ''}`;
  }
}

function onMsg(m: ServerMsg) {
  switch (m.t) {
    case 'snapshot': state = m.state; members.clear(); for (const x of m.state.members) members.set(x.id, x); render(); break;
    case 'join': case 'update': members.set(m.member.id, m.member); membersDirty = true; break;
    case 'leave': members.delete(m.id); membersDirty = true; break;
    case 'settings': if (state) { state.settings = m.settings; } break;
    case 'event': if (state) { state.event = m.event; state.nextEvent = m.next; state.eventEndsAt = m.endsAt; ($('evSel') as HTMLSelectElement).value = m.event.id; } break;
    case 'vote': if (state) state.vote = m.vote; break;
    case 'mode': if (state) state.mode = m.mode; break;
    case 'emergency': if (state) { state.emergency = m.on; const b = $('stop'); b.className = `stop ${m.on ? '' : 'danger'}`; b.textContent = m.on ? t('resume') : '⛔ ' + t('stop'); } break;
    case 'chat': chat.push(m.item); if (chat.length > 500) chat.splice(0, 100); chatDirty = true; break;
    case 'log': logs.push(m.item); if (logs.length > 600) logs.splice(0, 100); logDirty = true; break;
    case 'status': status = m.status; renderStatus(); break;
    case 'queue': if (state) { state.queue = m.queue; renderQueue(); } break;
  }
}
let chatDirty = false, logDirty = false;
setInterval(() => { if (chatDirty) { chatDirty = false; renderChat(); } if (logDirty) { logDirty = false; renderLogs(); } if (membersDirty) renderMembers(); }, 400);

function connect() {
  const token = new URLSearchParams(location.search).get('token') ?? localStorage.getItem('nc-token') ?? '';
  if (token) localStorage.setItem('nc-token', token);
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=admin&token=${encodeURIComponent(token)}`);
  ws.onmessage = (e) => onMsg(JSON.parse(e.data));
  ws.onclose = () => { $('hYt') && ($('hYt').textContent = 'server offline'); setTimeout(connect, 2000); };
}
connect();
