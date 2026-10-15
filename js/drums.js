// Ten synthesized drum pieces and a 16-step sequencer. The pieces map to the
// ten black keys left to right; the white keys are the sixteen steps.
export const PIECES = [
  { id: 'KICK', name: 'Kick', hue: 0.0 },
  { id: 'SNARE', name: 'Snare', hue: 0.08 },
  { id: 'CLAP', name: 'Clap', hue: 0.15 },
  { id: 'CH', name: 'Closed hat', hue: 0.25 },
  { id: 'OH', name: 'Open hat', hue: 0.33 },
  { id: 'LTOM', name: 'Low tom', hue: 0.45 },
  { id: 'HTOM', name: 'High tom', hue: 0.53 },
  { id: 'RIM', name: 'Rim', hue: 0.62 },
  { id: 'COWB', name: 'Cowbell', hue: 0.72 },
  { id: 'CYM', name: 'Cymbal', hue: 0.83 },
];
export const DRUM_KNOBS = [['TUNE', 'tune'], ['DECAY', 'decay'], ['TONE', 'tone'], ['LEVEL', 'level']];
export const STEPS = 16;
// General MIDI percussion notes for incoming MIDI in drum mode.
export const GM = { 35: 0, 36: 0, 38: 1, 40: 1, 39: 2, 42: 3, 44: 3, 46: 4, 41: 5, 43: 5, 45: 5, 47: 6, 48: 6, 50: 6, 37: 7, 56: 8, 49: 9, 51: 9, 57: 9 };

export function defaultDrums() {
  const pattern = PIECES.map(() => Array(STEPS).fill(false));
  [0, 4, 8, 12].forEach(s => { pattern[0][s] = true; });
  [4, 12].forEach(s => { pattern[1][s] = true; });
  for (let s = 2; s < STEPS; s += 4) pattern[3][s] = true;
  pattern[4][14] = true;
  return { bpm: 120, sel: 0, pattern, params: PIECES.map(() => ({ tune: 64, decay: 64, tone: 64, level: 100 })) };
}

export class Drums {
  constructor(synth, state) {
    this.synth = synth; this.s = state;
    this.playing = false; this.rec = false; this.next = 0; this.nextTime = 0; this.timer = 0;
    this.queue = []; // [step, time] already scheduled, for the playhead
    this.hits = PIECES.map(() => -1); // audio time of each piece's last trigger
    this.skip = new Set();
  }
  get ctx() { return this.synth.ctx; }
  stepDur() { return 60 / this.s.bpm / 4; }
  noise() {
    if (!this._noise) {
      const c = this.ctx, b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this._noise = b;
    }
    const n = this.ctx.createBufferSource(); n.buffer = this._noise; return n;
  }
  trigger(i, t = this.ctx.currentTime, vel = 1) {
    const c = this.ctx, p = this.s.params[i], out = this.synth.drumBus;
    const tune = 2 ** ((p.tune - 64) / 64), dec = 2 ** ((p.decay - 64) / 40), tone = p.tone / 127, lvl = (p.level / 127) ** 2 * vel;
    const G = (v = 0) => { const g = c.createGain(); g.gain.value = v; return g; };
    const env = (g, peak, len, at = t) => { g.gain.setValueAtTime(peak, at); g.gain.exponentialRampToValueAtTime(0.0001, at + len); };
    const osc = (type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; return o; };
    const filt = (type, f, q = 0.7) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const play = (src, len, ...chain) => { let n = src; for (const x of chain) { n.connect(x); n = x; } n.connect(out); src.start(t); src.stop(t + len + 0.05); };
    const id = PIECES[i].id;
    if (id === 'KICK') {
      const o = osc('sine', 150 * tune), g = G(), len = 0.35 * dec;
      o.frequency.setValueAtTime(160 * tune, t); o.frequency.exponentialRampToValueAtTime(42 * tune, t + 0.09);
      env(g, lvl, len); play(o, len, g);
      const n = this.noise(), ng = G(); env(ng, lvl * tone * 0.5, 0.012); play(n, 0.02, filt('highpass', 2500), ng);
    } else if (id === 'SNARE') {
      const o = osc('triangle', 185 * tune), g = G(); env(g, lvl * 0.6, 0.1 * dec); play(o, 0.1 * dec, g);
      const n = this.noise(), ng = G(); env(ng, lvl * 0.8, 0.18 * dec); play(n, 0.18 * dec, filt('bandpass', 1500 + tone * 4000, 0.8), ng);
    } else if (id === 'CLAP') {
      const n = this.noise(), g = G(), f = filt('bandpass', 1000 + tone * 1500, 1.4);
      [0, 0.011, 0.022].forEach(d => { g.gain.setValueAtTime(lvl, t + d); g.gain.exponentialRampToValueAtTime(lvl * 0.15, t + d + 0.009); });
      g.gain.setValueAtTime(lvl * 0.7, t + 0.031); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.031 + 0.2 * dec);
      play(n, 0.25 * dec + 0.03, f, g);
    } else if (id === 'CH' || id === 'OH' || id === 'CYM') {
      const len = { CH: 0.05, OH: 0.4, CYM: 1.3 }[id] * dec, n = this.noise(), g = G();
      env(g, lvl * (id === 'CH' ? 0.6 : 0.45), len);
      play(n, len, filt('highpass', (id === 'CYM' ? 4500 : 6500) * tune), filt('peaking', 9000 + tone * 4000, 1), g);
      if (id === 'CYM') { const o = osc('square', 420 * tune), og = G(); env(og, lvl * 0.04, len * 0.6); play(o, len, filt('highpass', 3000), og); }
    } else if (id === 'LTOM' || id === 'HTOM') {
      const f = (id === 'LTOM' ? 95 : 160) * tune, o = osc('sine', f), g = G(), len = 0.4 * dec;
      o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      env(g, lvl * 0.8, len); play(o, len, g);
      const n = this.noise(), ng = G(); env(ng, lvl * tone * 0.3, 0.03); play(n, 0.04, filt('lowpass', 3000), ng);
    } else if (id === 'RIM') {
      const o = osc('triangle', 1700 * tune), g = G(); env(g, lvl * 0.5, 0.03 * dec); play(o, 0.05 * dec, filt('highpass', 600), g);
      const n = this.noise(), ng = G(); env(ng, lvl * 0.4 * (0.3 + tone), 0.01); play(n, 0.02, filt('bandpass', 2500, 2), ng);
    } else if (id === 'COWB') {
      const g = G(), f = filt('bandpass', 2000 + tone * 1500, 1.2), len = 0.3 * dec;
      env(g, lvl * 0.35, len);
      [540, 800].forEach(fr => { const o = osc('square', fr * tune); o.connect(f); o.start(t); o.stop(t + len + 0.05); });
      f.connect(g); g.connect(out);
    }
    this.hits[i] = t;
  }
  // ---- transport
  start() {
    this.synth.resume();
    if (this.playing) return;
    this.playing = true; this.next = 0; this.nextTime = this.ctx.currentTime + 0.06; this.queue = []; this.skip.clear();
    this.tick(); this.timer = setInterval(() => this.tick(), 25);
  }
  stop() { this.playing = false; clearInterval(this.timer); this.queue = []; }
  toggle() { this.playing ? this.stop() : this.start(); return this.playing; }
  tick() {
    const ahead = this.ctx.currentTime + 0.12;
    while (this.nextTime < ahead) {
      const s = this.next;
      this.s.pattern.forEach((row, i) => {
        if (!row[s]) return;
        if (this.skip.delete(i * STEPS + s)) return;
        this.trigger(i, this.nextTime, s % 4 === 0 ? 1 : 0.85);
      });
      this.queue.push([s, this.nextTime]);
      if (this.queue.length > 32) this.queue.shift();
      this.next = (s + 1) % STEPS; this.nextTime += this.stepDur();
    }
  }
  // Step under the playhead now, or -1 when stopped.
  step(now = this.ctx?.currentTime ?? 0) {
    if (!this.playing) return -1;
    let cur = -1;
    for (const [s, t] of this.queue) if (t <= now) cur = s;
    return cur;
  }
  // Live hit from a black key: plays now and, while recording, lands on the
  // nearest step. A step that is still ahead of the scheduler is not played twice.
  hit(i) {
    this.synth.resume();
    this.trigger(i);
    if (!(this.rec && this.playing)) return;
    const now = this.ctx.currentTime, d = this.stepDur();
    let best = [this.next, this.nextTime], pending = true;
    for (const [s, t] of this.queue) if (Math.abs(t - now) < Math.abs(best[1] - now)) { best = [s, t]; pending = false; }
    const [s, t] = best;
    if (Math.abs(t - now) > d) return;
    this.s.pattern[i][s] = true;
    if (pending) this.skip.add(i * STEPS + s);
  }
}
