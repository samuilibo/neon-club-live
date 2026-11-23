// Types shared by the server, the live view and the admin panel.

export type Source = 'youtube' | 'twitch' | 'kick' | 'tiktok' | 'demo';
export const PLATFORMS = ['twitch', 'kick', 'tiktok'] as const;
export type Platform = (typeof PLATFORMS)[number];
export const SOURCE_LABEL: Record<Source, string> = { youtube: 'YouTube', twitch: 'Twitch', kick: 'Kick', tiktok: 'TikTok', demo: 'Demo' };
export type Zone = 'floor' | 'vip' | 'stage' | 'lounge';
export type Quality = 'low' | 'medium' | 'high' | 'ultra';

export const COMMANDS = [
  'join', 'dance', 'shuffle', 'breakdance', 'robot', 'jump', 'wave', 'sit', 'outfit', 'color',
  'vip', 'stage', 'camera', 'song', 'duo', 'accept', 'leave', 'help', 'event', 'clap', 'floor', 'queue',
] as const;
export type CommandName = (typeof COMMANDS)[number];

export const GENRES = ['edm', 'techno', 'deephouse', 'progressive', 'trance', 'hiphop', 'disco', 'synthwave', 'turkish'] as const;
export type Genre = (typeof GENRES)[number];
export const GENRE_LABEL: Record<Genre, string> = {
  edm: 'EDM', techno: 'Techno', deephouse: 'Deep House', progressive: 'Progressive House', trance: 'Trance',
  hiphop: 'Hip-Hop', disco: 'Disco', synthwave: 'Synthwave', turkish: 'Türkçe Elektronik',
};

export interface Member {
  id: string;            // YouTube channel id (or demo:xxx) — never the display name
  name: string;          // sanitised display name
  avatar?: string;       // proxied profile image url
  source: Source;
  seed: number;          // drives the generated look
  outfit: number;        // incremented by !outfit
  color: number;         // incremented by !color
  zone: Zone;
  vip: boolean;          // allowed into the VIP area
  sitting: boolean;
  joinedAt: number;
}

export type ActionKind =
  | 'dance' | 'shuffle' | 'breakdance' | 'robot' | 'jump' | 'wave' | 'clap' | 'sit' | 'stand'
  | 'special';

export interface ClubEvent {
  id: string;
  name: { tr: string; en: string };
  genre: Genre;
  palette: [string, string, string];
  dances: string[];       // preferred dance clip names
  light: 'neon' | 'disco' | 'techno' | 'laser' | 'warm' | 'color' | 'show';
  decor: 'default' | 'retro' | 'rooftop' | 'battle';
  special?: 'battle' | 'choreo' | 'djshow' | 'lasershow';
}

export const SC_EFFECTS = ['spotlight', 'gold', 'djMessage', 'confetti', 'fireworks', 'camera', 'stage', 'lightshow', 'dance'] as const;
export type ScEffect = (typeof SC_EFFECTS)[number];

export interface SupportEffect {
  uid: string;                       // unique id of this effect run
  kind: 'superchat' | 'sticker' | 'member' | 'gift' | 'combo';
  others?: string[];                 // combo: further supporters merged into this banner
  source: Source;
  memberId: string;                  // channel id of the supporter
  name: string;
  amountText: string;                // original amount + currency as sent by YouTube ("" for memberships)
  comment: string;
  tier: number;                      // YouTube tier 1..11 (memberships use 3)
  effects: ScEffect[];
  durationMs: number;
}

export interface VoteState {
  kind: 'song' | 'event';
  options: { key: string; label: string; count: number }[];
  endsAt: number;
}

export interface MusicInfo {
  title: string;
  genre: string;
  bpm: number;           // BPM the dance clock runs on
  bpmDetected: number;   // analyser estimate (0 = unknown)
  playing: boolean;
  builtin: boolean;
  position: number;
  duration: number;
}

export interface LightSettings { intensity: number; lasers: boolean; fog: number; strobe: boolean; mode: 'auto' | ClubEvent['light'] }
export interface MusicSettings { volume: number; shuffle: boolean; repeat: 'off' | 'all' | 'one'; crossfade: number; bpmOverride: number; source: 'auto' | 'files' | 'builtin' | 'youtube'; lock: boolean; youtube: string[] }   // lock: events / chat votes never change the track
export interface ScSettings { showComments: boolean; enabled: boolean; effects: Record<ScEffect, { on: boolean; minTier: number }>; baseDurationMs: number }

export interface Settings {
  maxCharacters: number;
  commands: Record<CommandName, { on: boolean; cooldown: number }>;
  superchat: ScSettings;
  music: MusicSettings;
  lights: LightSettings;
  quality: Quality;
  dynamicResolution: boolean;
  layout: 'landscape' | 'portrait';
  overlayLang: 'tr' | 'en';
  showNames: boolean;
  showAvatars: boolean;
  vipOpen: boolean;              // everyone may enter VIP
  eventMinutes: number;
  eventVoting: boolean;
  cameraAuto: boolean;
  minPollMs: number;
  welcomeCamera: boolean;
  supporterVipMinutes: number;   // one-off supporters get TEMPORARY VIP access for this long (0 = off)
  supporterAutoJoin: boolean;
  queuePaidPriority: boolean;    // when the club is full, supporters are admitted before free viewers (ordered by amount)
  queueFreeEvery: number;        // optional fairness: after this many priority admissions one free viewer gets in (0 = off)    // a supporter who is not in the club yet walks in (only if there is room)
  platforms: { twitch: { channel: string }; kick: { channel: string }; tiktok: { username: string; acceptUnofficial: boolean } };
}

export interface PlatformStatus {
  state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'waiting' | 'ended' | 'error';
  channel: string; detail: string; messages: number; retryInMs: number;
  configured: boolean;            // credentials present in .env
  auth?: { userCode: string; verificationUri: string; expiresAt: number } | null;   // Twitch device login in progress
  account?: string;               // logged-in account (Twitch)
  webhookPort?: number;           // Kick webhook listener port
}

export interface PublicState {
  mode: 'idle' | 'live' | 'demo';
  members: Member[];
  settings: Settings;
  event: ClubEvent;
  nextEvent: ClubEvent | null;
  eventEndsAt: number;
  vote: VoteState | null;
  emergency: boolean;
  queue: QueueInfo;
  now: number;
}

/** Door queue shown on stream when the club is full. Amounts are shown in the platform's own units. */
export interface QueueInfo {
  size: number; priority: number; members: number; capacity: number;
  top: { name: string; source: Source; priority: boolean; amountText: string }[];
}

// ---- server -> live / admin
export type ServerMsg =
  | { t: 'snapshot'; state: PublicState }
  | { t: 'join'; member: Member }
  | { t: 'leave'; id: string }
  | { t: 'update'; member: Member }
  | { t: 'action'; id: string; action: ActionKind; arg?: string }
  | { t: 'duo'; a: string; b: string }
  | { t: 'effect'; effect: SupportEffect }
  | { t: 'event'; event: ClubEvent; next: ClubEvent | null; endsAt: number }
  | { t: 'vote'; vote: VoteState | null; winner?: string }
  | { t: 'settings'; settings: Settings }
  | { t: 'mode'; mode: PublicState['mode'] }
  | { t: 'notice'; kind: 'help' | 'info'; text: { tr: string; en: string } }
  | { t: 'music'; cmd: 'next' | 'prev' | 'toggle' | 'genre' | 'play' | 'rescan'; arg?: string }
  | { t: 'camera'; shot: string; target?: string; hold?: number }
  | { t: 'test'; what: string; arg?: string }
  | { t: 'emergency'; on: boolean }
  | { t: 'effectStop' }
  | { t: 'queue'; queue: QueueInfo }
  | { t: 'queueNotice'; kind: 'joined' | 'priority' | 'position'; name: string; position: number; size: number; amountText?: string }
  // admin only
  | { t: 'chat'; item: ChatLogItem }
  | { t: 'log'; item: LogItem }
  | { t: 'status'; status: AdminStatus };

export interface ChatLogItem {
  ts: number; source: Source; authorId: string; author: string; text: string;
  kind: 'text' | 'superchat' | 'sticker' | 'member' | 'gift' | 'system';
  result?: string;        // what the router did with it
  amountText?: string;
}
export interface LogItem { ts: number; level: 'info' | 'warn' | 'error'; scope: string; msg: string }

export interface LiveStats {
  fps: number; frameMs: number; drawCalls: number; triangles: number; characters: number; visible: number;
  heapMB: number; renderScale: number; gpu: string; textures: number; geometries: number; width: number; height: number;
}

export interface AdminStatus {
  youtube: {
    state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'chat_disabled' | 'quota' | 'error';
    transport: 'none' | 'grpc' | 'polling';
    videoId: string; title: string; detail: string; hasKey: boolean; hasOAuth: boolean;
    quotaUsed: number; messages: number; viewers: number | null; retryInMs: number;
  };
  mode: PublicState['mode'];
  liveClients: number;
  stats: LiveStats | null;
  music: MusicInfo | null;
  playlist: { title: string; genre: string; builtin: boolean }[];
  queueLength: number;
  blocked: { id: string; name: string }[];
  uptime: number;
  platforms: Record<Platform, PlatformStatus>;
}

// ---- live -> server
export type LiveMsg =
  | { t: 'stats'; stats: LiveStats }
  | { t: 'musicInfo'; info: MusicInfo; playlist?: AdminStatus['playlist'] }
  | { t: 'clientError'; msg: string }
  | { t: 'bench'; result: unknown };

// ---- admin -> server
export type AdminMsg =
  | { t: 'connect'; url: string }
  | { t: 'disconnect' }
  | { t: 'settings'; patch: Partial<Settings> }
  | { t: 'kick'; id: string }
  | { t: 'block'; id: string }
  | { t: 'unblock'; id: string }
  | { t: 'demo'; cmd: 'start' | 'stop' | 'add' | 'chat' | 'superchat' | 'disconnectTest' | 'load'; count?: number; text?: string; tier?: number; autoSupport?: boolean }
  | { t: 'music'; cmd: 'next' | 'prev' | 'toggle' | 'genre' | 'play' | 'rescan'; arg?: string }
  | { t: 'camera'; shot: string; target?: string }
  | { t: 'event'; id: string }
  | { t: 'eventVote' }
  | { t: 'test'; what: string; arg?: string }
  | { t: 'emergency'; on: boolean }
  | { t: 'grantVip'; id: string; on: boolean }
  | { t: 'clearLogs' }
  | { t: 'effects'; cmd: 'skip' | 'clear' }
  | { t: 'platform'; platform: Platform; cmd: 'connect' | 'disconnect' | 'login' | 'logout'; channel?: string };

export const DEFAULT_COOLDOWNS: Record<CommandName, number> = {
  join: 3, dance: 4, shuffle: 4, breakdance: 6, robot: 4, jump: 3, wave: 3, sit: 5, outfit: 8, color: 5,
  vip: 10, stage: 30, camera: 60, song: 20, duo: 15, accept: 3, leave: 5, help: 20, event: 5, clap: 3, floor: 5, queue: 10,
};

export function defaultSettings(): Settings {
  const commands = {} as Settings['commands'];
  for (const c of COMMANDS) commands[c] = { on: true, cooldown: DEFAULT_COOLDOWNS[c] };
  // Effect ladder (YouTube tiers: 1 ≈ $1, 2 ≈ $2, 3 ≈ $5, 4 ≈ $10, 5 ≈ $20, 6 ≈ $50+). Every step adds to the previous one.
  const tiers: Record<ScEffect, number> = { spotlight: 1, djMessage: 2, gold: 3, confetti: 3, camera: 4, dance: 4, lightshow: 5, fireworks: 6, stage: 6 };
  const effects = {} as ScSettings['effects'];
  for (const e of SC_EFFECTS) effects[e] = { on: true, minTier: tiers[e] };
  return {
    maxCharacters: 100,
    commands,
    superchat: { enabled: true, showComments: true, effects, baseDurationMs: 6000 },
    music: { volume: 0.8, shuffle: true, repeat: 'all', crossfade: 4, bpmOverride: 0, source: 'auto', lock: false, youtube: [] },
    lights: { intensity: 1, lasers: true, fog: 0.6, strobe: false, mode: 'auto' },
    quality: 'high',
    dynamicResolution: true,
    layout: 'landscape',
    overlayLang: 'tr',
    showNames: true,
    showAvatars: true,
    vipOpen: false,
    eventMinutes: 8,
    eventVoting: true,
    cameraAuto: true,
    minPollMs: 3000,
    welcomeCamera: true,
    supporterVipMinutes: 60,
    supporterAutoJoin: true,
    queuePaidPriority: true,
    queueFreeEvery: 0,
    platforms: { twitch: { channel: '' }, kick: { channel: '' }, tiktok: { username: '', acceptUnofficial: false } },
  };
}
