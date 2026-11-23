import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { LiveStats, Quality } from '../../shared/protocol.ts';

export interface QualityProfile {
  maxScale: number;        // upper bound for render scale (× CSS pixels)
  bloom: boolean;
  shadows: 0 | 1024 | 2048;
  msaa: number;
  realSpots: number;       // real-time coloured spot lights
  beams: number;           // volumetric beam meshes
  lasers: number;
  fogSprites: number;
  lod: [number, number];   // distances for LOD1 / LOD2
  animFar: number;         // animation rate (Hz) for far characters
  nameTags: number;        // max visible name tags
  heroes: number;          // detailed skinned characters; everyone else is drawn by the GPU crowd
  envRefresh: boolean;
}

export const PROFILES: Record<Quality, QualityProfile> = {
  low: { maxScale: 0.75, bloom: true, shadows: 0, msaa: 0, realSpots: 2, beams: 4, lasers: 8, fogSprites: 0, lod: [5, 11], animFar: 10, nameTags: 40, heroes: 50, envRefresh: false },
  medium: { maxScale: 1, bloom: true, shadows: 0, msaa: 0, realSpots: 3, beams: 6, lasers: 12, fogSprites: 24, lod: [8, 16], animFar: 15, nameTags: 80, heroes: 90, envRefresh: false },
  high: { maxScale: 1, bloom: true, shadows: 1024, msaa: 4, realSpots: 4, beams: 8, lasers: 16, fogSprites: 40, lod: [11, 22], animFar: 20, nameTags: 150, heroes: 140, envRefresh: true },
  ultra: { maxScale: 1.5, bloom: true, shadows: 2048, msaa: 4, realSpots: 6, beams: 10, lasers: 24, fogSprites: 64, lod: [16, 30], animFar: 30, nameTags: 300, heroes: 220, envRefresh: true },
};

/** Replaces NaN/Inf and clamps extreme HDR values so one bad pixel can never black out the bloom chain. */
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); bvec3 bad = bvec3(c.r != c.r || c.r > 6e4, c.g != c.g || c.g > 6e4, c.b != c.b || c.b > 6e4);
      if (any(bad)) c.rgb = vec3(0.0); gl_FragColor = vec4(min(c.rgb, vec3(48.0)), 1.0); }`,
};

const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.9 }, flash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; uniform float flash; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.25, length(d) * amount);
      gl_FragColor = vec4(c.rgb * mix(0.55, 1.0, v) + flash, c.a); }`,
};

export class Engine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer!: EffectComposer;
  bloom!: UnrealBloomPass;
  vignette!: ShaderPass;
  profile: QualityProfile = PROFILES.high;
  quality: Quality = 'high';
  dynamicRes = true;
  manualScale = 0;         // panel: render scale (1 = 100 %), 0 = automatic
  manualSize: { w: number; h: number } | null = null;   // panel: exact render size in px
  forcedScale = 0;          // ?scale=2 renders at 2× (e.g. 3840×2160 screenshots from a 1920×1080 page)
  scale = 1;
  stats: LiveStats;
  gpu = 'unknown';
  private frames = 0;
  private lastT = performance.now();
  private acc = 0;
  private worst = 0;
  private width = 1;
  private height = 1;
  private onQuality: ((p: QualityProfile) => void)[] = [];

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    host.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 220);
    const gl = this.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) this.gpu = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
    this.stats = { fps: 0, frameMs: 0, drawCalls: 0, triangles: 0, characters: 0, visible: 0, heapMB: 0, renderScale: 1, gpu: this.gpu, textures: 0, geometries: 0, width: 0, height: 0 };
    this.buildComposer();
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  onQualityChange(fn: (p: QualityProfile) => void) { this.onQuality.push(fn); }

  private buildComposer() {
    const p = this.profile;
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: p.msaa });
    this.composer?.dispose();
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new ShaderPass(SanitizeShader));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.6, 0.5, 0.92);
    this.bloom.enabled = p.bloom;
    this.composer.addPass(this.bloom);
    this.vignette = new ShaderPass(VignetteShader);
    this.composer.addPass(this.vignette);
    this.composer.addPass(new OutputPass());
  }

  setQuality(q: Quality, dynamicRes: boolean) {
    this.dynamicRes = dynamicRes;
    if (q === this.quality && this.composer) { if (!dynamicRes) { this.scale = this.forcedScale || this.manualScale || this.profile.maxScale; this.resize(); } return; }
    this.quality = q;
    this.profile = PROFILES[q];
    this.renderer.shadowMap.enabled = this.profile.shadows > 0;
    this.scale = Math.min(this.scale, this.profile.maxScale);
    if (!dynamicRes) this.scale = this.forcedScale || this.manualScale || this.profile.maxScale;
    this.buildComposer();
    this.resize();
    for (const fn of this.onQuality) fn(this.profile);
  }

  resize() {
    const m = this.manualSize;
    this.width = m ? m.w : this.host.clientWidth || innerWidth;
    this.height = m ? m.h : this.host.clientHeight || innerHeight;
    if (m) this.scale = 1;                                   // exact pixel size: the canvas is stretched to the page by CSS
    this.camera.aspect = this.width / this.height;
    // portrait output keeps a comparable horizontal view of the club
    this.camera.fov = this.camera.aspect < 1 ? 78 : 50;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.scale);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setPixelRatio(this.scale);
    this.composer.setSize(this.width, this.height);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
  }

  render(dt: number) {
    this.renderer.info.reset();
    this.composer.render(dt);
    const nowT = performance.now(), real = (nowT - this.lastT) / 1000;   // unclamped wall-clock time
    this.lastT = nowT;
    this.frames++;
    this.acc += real;
    this.worst = Math.max(this.worst, real);
    if (this.acc >= 1) {
      const fps = this.frames / this.acc;
      const info = this.renderer.info;
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      this.stats = {
        ...this.stats, fps: Math.round(fps * 10) / 10, frameMs: Math.round((1000 / fps) * 10) / 10, drawCalls: info.render.calls,
        triangles: info.render.triangles, heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : 0, renderScale: Math.round(this.scale * 100) / 100,
        textures: info.memory.textures, geometries: info.memory.geometries,
        width: Math.round(this.width * this.scale), height: Math.round(this.height * this.scale),
      };
      if (this.dynamicRes) this.adapt(fps);
      this.frames = 0; this.acc = 0; this.worst = 0;
    }
  }

  /** Dynamic resolution: trade pixels for frame rate, slowly and with hysteresis. */
  private adapt(fps: number) {
    const max = this.profile.maxScale;
    let s = this.scale;
    if (fps < 52) s = Math.max(0.5, s - (fps < 40 ? 0.1 : 0.05));
    else if (fps > 58.5 && s < max) s = Math.min(max, s + 0.04);
    if (Math.abs(s - this.scale) > 0.001) { this.scale = s; this.resize(); }
  }
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AudioFrame {
  bass: number; mid: number; treble: number; level: number;
  beat: boolean;            // true on the frame a beat lands
  beatPhase: number;        // 0..1 inside the current beat
  beatCount: number;        // integer beat index
  beats: number;            // continuous beat time (beatCount + beatPhase)
  bpm: number;
  kick: number;             // decaying 1 -> 0 envelope after each beat
  spectrum: Float32Array;   // 64 log-spaced bands 0..1
}
