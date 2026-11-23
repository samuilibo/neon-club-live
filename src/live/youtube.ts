// YouTube links as music, played through the official YouTube IFrame Player (no downloading, no ripping).
// The player stays visible on the stream as a small card (YouTube requires a visible player of at least
// 200x200 px), and the audio is cross-origin, so the beat clock runs from the track's BPM instead of analysis.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void } }

let apiReady: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (!apiReady) {
    apiReady = new Promise<void>((resolve, reject) => {
      if (window.YT?.Player) { resolve(); return; }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { apiReady = null; reject(new Error('YouTube API could not be loaded')); };
      document.head.appendChild(s);
    });
  }
  return apiReady;
}

/** "https://youtu.be/ID", "...watch?v=ID", "/shorts/ID", "/embed/ID" or a bare 11-char id; optional " | 128" = BPM. */
export function parseYouTube(line: string): { id: string; bpm: number } | null {
  const [u = '', b = ''] = line.split('|').map((s) => s.trim());
  const m = /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/.exec(u) ?? /^([\w-]{11})$/.exec(u);
  const bpm = Number(b);
  return m ? { id: m[1], bpm: bpm >= 60 && bpm <= 200 ? bpm : 0 } : null;
}

export class YouTubeDeck {
  title = '';
  ended = false;
  failed = false;
  private player: any = null;
  private wrap: HTMLElement;
  private fade = 0;
  private fadeTarget = 1;
  private fadeRate = 1;
  private volume = 1;
  private timer: number;

  constructor(host: HTMLElement, readonly id: string, volume: number, fadeIn: number, private onTitle: (t: string) => void, private onError: () => void) {
    host.classList.add('on');
    this.wrap = document.createElement('div');
    this.wrap.className = 'yt';
    const slot = document.createElement('div');
    this.wrap.appendChild(slot);
    host.appendChild(this.wrap);
    this.volume = volume;
    this.fadeRate = 1 / Math.max(0.05, fadeIn);
    loadApi().then(() => {
      if (!this.wrap.isConnected) return;
      this.player = new window.YT.Player(slot, {
        videoId: id, width: '100%', height: '100%',
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0, origin: location.origin },
        events: {
          onReady: (e: any) => { this.apply(); e.target.playVideo(); },
          onStateChange: (e: any) => {
            if (e.data === 0) this.ended = true;
            if (e.data === 1 && !this.title) { this.title = e.target.getVideoData?.()?.title ?? ''; if (this.title) this.onTitle(this.title); }
          },
          onError: () => { this.failed = true; console.warn('YouTube video cannot be played (embedding disabled or removed):', id); this.onError(); },
        },
      });
    }).catch(() => { this.failed = true; this.onError(); });
    // volume fades run on a timer so they keep going while the tab is in the background
    this.timer = window.setInterval(() => this.step(0.05), 50);
  }

  private step(dt: number) {
    const d = this.fadeTarget - this.fade;
    if (Math.abs(d) > 1e-3) { this.fade += Math.sign(d) * Math.min(Math.abs(d), dt * this.fadeRate); this.apply(); }
    else if (this.fadeTarget === 0) this.destroy();
  }
  private apply() { try { this.player?.setVolume?.(Math.round(100 * this.volume * this.fade)); } catch { /* not ready */ } }

  setVolume(v: number) { this.volume = v; this.apply(); }
  play() { try { this.player?.playVideo?.(); } catch { /* not ready */ } }
  pause() { try { this.player?.pauseVideo?.(); } catch { /* not ready */ } }
  get duration(): number { try { return this.player?.getDuration?.() || 0; } catch { return 0; } }
  get position(): number { try { return this.player?.getCurrentTime?.() || 0; } catch { return 0; } }

  stop(fadeOut: number) { this.fadeTarget = 0; this.fadeRate = 1 / Math.max(0.05, fadeOut); }

  destroy() {
    clearInterval(this.timer);
    try { this.player?.destroy?.(); } catch { /* ignore */ }
    const host = this.wrap.parentElement;
    this.wrap.remove();
    if (host && !host.children.length) host.classList.remove('on');
  }
}
