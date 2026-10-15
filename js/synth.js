// Four-page virtual analog voice after Kreisel's VA engine: two detuned
// oscillators with a crossfade and a sub octave, a state-variable style filter
// (LP/BP/HP) with an envelope amount, ADSR, a shared tremolo LFO and one
// switchable effect. All parameters are 0..127 or an enum index.
export const WAVES = ['SAW', 'SQR', 'TRI', 'SIN'];
export const FILTERS = ['LP', 'BP', 'HP'];
export const LFO_SHAPES = ['SIN', 'TRI', 'SQR', 'SAW'];
export const FX_TYPES = ['OFF', 'DRV', 'DLY', 'CHO'];
export const FX_NAMES = ['BYPASS', 'DRIVE', 'DELAY', 'CHORUS'];
const OSC_TYPE = ['sawtooth', 'square', 'triangle', 'sine'];
const FILTER_TYPE = ['lowpass', 'bandpass', 'highpass'];

// [label, param, enum names]
export const PAGES = [
  { id: 'HOME', color: 'teal', knobs: [['CUTOFF', 'cutoff'], ['RESO', 'reso'], ['ATTACK', 'attack'], ['RELEASE', 'release']] },
  { id: 'OSC', color: 'orange', knobs: [['WAVE', 'wave', WAVES], ['DETUNE', 'detune'], ['MIX', 'mix'], ['SUB', 'sub']] },
  { id: 'FILTER', color: 'lime', knobs: [['CUTOFF', 'cutoff'], ['RESO', 'reso'], ['TYPE', 'ftype', FILTERS], ['ENV AMT', 'envamt']] },
  { id: 'ENV', color: 'mint', knobs: [['ATTACK', 'attack'], ['DECAY', 'decay'], ['SUSTAIN', 'sustain'], ['RELEASE', 'release']] },
  { id: 'LFO', color: 'violet', knobs: [['RATE', 'lrate'], ['DEPTH', 'ldepth'], ['FADE', 'lfade'], ['SHAPE', 'lshape', LFO_SHAPES]] },
  { id: 'FX', color: 'blue', knobs: [['TYPE', 'fx', FX_TYPES], ['TIME', 'ftime'], ['FEEDBK', 'ffb'], ['MIX', 'fmix']] },
];
export const paramMax = k => ({ wave: 3, ftype: 2, lshape: 3, fx: 3 }[k] ?? 127);

const BASE = {
  wave: 0, detune: 20, mix: 64, sub: 20, cutoff: 80, reso: 25, ftype: 0, envamt: 40,
  attack: 4, decay: 50, sustain: 90, release: 30, lrate: 40, ldepth: 0, lfade: 0, lshape: 0,
  fx: 0, ftime: 50, ffb: 40, fmix: 30,
};
export const PRESETS = [
  ['Soft Pad', { detune: 40, sub: 0, cutoff: 62, reso: 15, envamt: 20, attack: 70, decay: 80, sustain: 100, release: 80, lrate: 30, ldepth: 25, lfade: 50, fx: 3, ftime: 40, ffb: 50, fmix: 55 }],
  ['Sub Bass', { wave: 1, detune: 5, mix: 30, sub: 90, cutoff: 45, reso: 30, envamt: 50, attack: 0, decay: 40, sustain: 80, release: 15, fx: 1, ffb: 30, fmix: 40 }],
  ['Glass Keys', { wave: 2, detune: 25, sub: 0, cutoff: 95, reso: 10, envamt: 30, attack: 0, decay: 60, sustain: 40, release: 50, fx: 2, ftime: 60, ffb: 45, fmix: 35 }],
  ['Warm Brass', { detune: 30, sub: 20, cutoff: 50, reso: 20, envamt: 70, attack: 20, decay: 55, sustain: 85, release: 30, lrate: 50, ldepth: 10 }],
  ['Plucky', { wave: 1, detune: 12, mix: 50, sub: 10, cutoff: 40, reso: 45, envamt: 90, attack: 0, decay: 30, sustain: 10, release: 25, fx: 2, ftime: 35, ffb: 30, fmix: 25 }],
  ['Acid Line', { detune: 0, mix: 0, sub: 0, cutoff: 30, reso: 105, envamt: 100, attack: 0, decay: 35, sustain: 20, release: 15, fx: 1, ffb: 50, fmix: 50 }],
].map(([name, p]) => ({ name, params: { ...BASE, ...p } }));

const hz = n => 440 * 2 ** ((n - 69) / 12);
const sq = v => (v / 127) ** 2;
export const T = {
  attack: v => 0.002 + sq(v) * 2.5,
  decay: v => 0.01 + sq(v) * 3,
  release: v => 0.01 + sq(v) * 4,
  cutoff: v => Math.min(18000, 40 * 2 ** (v / 127 * 9)),
  q: (v, type) => (type === 1 ? 1 + v / 127 * 12 : 0.7 + sq(v) * 18),
  envOct: v => v / 127 * 6,
  lfoHz: v => 0.1 * 2 ** (v / 127 * 6.5),
  detuneCents: v => v / 127 * 30,
};

export class Synth {
  constructor(p, level) { this.p = { ...BASE, ...p }; this.level = level; this.voices = new Map(); this.ctx = null; this.on = true; this.clock = 0; }
  ensure() {
    if (this.ctx) return;
    const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    const G = v => { const g = c.createGain(); g.gain.value = v; return g; };
    this.master = G(0);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.005; comp.release.value = 0.2;
    this.an = c.createAnalyser(); this.an.fftSize = 1024;
    this.buf = new Uint8Array(this.an.fftSize);
    this.master.connect(comp); comp.connect(this.an); this.an.connect(c.destination);
    this.drumBus = G(1); this.drumBus.connect(this.master);

    // voices -> tremolo -> dry + one effect -> master
    this.voiceBus = G(1);
    this.trem = G(1);
    this.lfo = c.createOscillator(); this.lfoAmt = G(0);
    this.lfo.connect(this.lfoAmt); this.lfoAmt.connect(this.trem.gain); this.lfo.start();
    this.voiceBus.connect(this.trem);
    this.dry = G(1); this.trem.connect(this.dry); this.dry.connect(this.master);
    // drive
    this.shaper = c.createWaveShaper(); this.shaper.oversample = '2x';
    this.driveTone = c.createBiquadFilter(); this.driveTone.type = 'lowpass';
    this.driveOut = G(0);
    this.trem.connect(this.shaper); this.shaper.connect(this.driveTone); this.driveTone.connect(this.driveOut); this.driveOut.connect(this.master);
    // delay
    this.delay = c.createDelay(1.5); this.delayFb = G(0); this.delayOut = G(0);
    this.trem.connect(this.delay); this.delay.connect(this.delayFb); this.delayFb.connect(this.delay); this.delay.connect(this.delayOut); this.delayOut.connect(this.master);
    // chorus
    this.chorus = c.createDelay(0.05); this.chorusLfo = c.createOscillator(); this.chorusAmt = G(0); this.chorusOut = G(0);
    this.chorusLfo.connect(this.chorusAmt); this.chorusAmt.connect(this.chorus.delayTime); this.chorusLfo.start();
    this.trem.connect(this.chorus); this.chorus.connect(this.chorusOut); this.chorusOut.connect(this.master);
    this.applyAll(true);
  }
  resume() { this.ensure(); if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }
  applyMaster(now) {
    if (!this.ctx) return;
    const g = this.on ? sq(this.level) * 0.8 : 0;
    if (now) this.master.gain.value = g; else this.master.gain.setTargetAtTime(g, this.ctx.currentTime, 0.02);
  }
  setLevel(v) { this.level = v; this.applyMaster(false); }
  setPower(on) { this.on = on; if (!on) this.allOff(); this.applyMaster(false); }
  applyLfo() {
    const p = this.p, t = this.ctx.currentTime, d = p.ldepth / 127;
    this.lfo.type = OSC_TYPE[[3, 2, 1, 0][p.lshape]];
    this.lfo.frequency.setTargetAtTime(T.lfoHz(p.lrate), t, 0.02);
    this.trem.gain.setTargetAtTime(1 - d / 2, t, 0.02);
    this.lfoAmt.gain.setTargetAtTime(d / 2, t, 0.02);
  }
  applyFx() {
    const p = this.p, t = this.ctx.currentTime, mix = p.fmix / 127, s = (g, v) => g.gain.setTargetAtTime(v, t, 0.03);
    s(this.dry, p.fx === 1 ? 1 - mix : 1);
    s(this.driveOut, p.fx === 1 ? mix : 0);
    s(this.delayOut, p.fx === 2 ? mix : 0);
    s(this.chorusOut, p.fx === 3 ? mix : 0);
    if (p.fx === 1) {
      const k = 1 + sq(p.ffb) * 60, n = 1024, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
      this.shaper.curve = curve;
      this.driveTone.frequency.setTargetAtTime(500 * 2 ** (p.ftime / 127 * 5), t, 0.03);
    }
    this.delay.delayTime.setTargetAtTime(0.04 + sq(p.ftime) * 0.96, t, 0.05);
    this.delayFb.gain.setTargetAtTime(p.fx === 2 ? p.ffb / 127 * 0.88 : 0, t, 0.03);
    this.chorus.delayTime.setTargetAtTime(0.014, t, 0.05);
    this.chorusLfo.frequency.setTargetAtTime(0.1 * 2 ** (p.ftime / 127 * 5.5), t, 0.05);
    this.chorusAmt.gain.setTargetAtTime(0.0005 + p.ffb / 127 * 0.007, t, 0.05);
  }
  applyAll(now) { this.applyMaster(now); this.applyLfo(); this.applyFx(); }
  setParams(p) { this.p = { ...this.p, ...p }; if (this.ctx) { this.applyAll(false); for (const v of this.voices.values()) this.retune(v); } }
  setParam(k, v) {
    this.p[k] = v;
    if (!this.ctx) return;
    if (/^l/.test(k)) this.applyLfo();
    else if (/^f(x|time|fb|mix)$/.test(k)) this.applyFx();
    else for (const vo of this.voices.values()) this.retune(vo, k);
  }
  // Live edits on sounding voices. Envelope times apply from the next note.
  retune(v, k) {
    const p = this.p, t = this.ctx.currentTime;
    if (!k || k === 'wave') v.main.forEach(o => { o.type = OSC_TYPE[p.wave]; });
    if (!k || k === 'detune') v.o2.detune.setTargetAtTime(T.detuneCents(p.detune), t, 0.02);
    if (!k || k === 'mix') { v.g1.gain.setTargetAtTime((1 - p.mix / 127) * 0.4, t, 0.02); v.g2.gain.setTargetAtTime(p.mix / 127 * 0.4, t, 0.02); }
    if (!k || k === 'sub') v.g3.gain.setTargetAtTime(p.sub / 127 * 0.3, t, 0.02);
    if (!k || k === 'ftype') v.fl.type = FILTER_TYPE[p.ftype];
    if (!k || k === 'reso' || k === 'ftype') v.fl.Q.setTargetAtTime(T.q(p.reso, p.ftype), t, 0.02);
    if (!k || k === 'cutoff' || k === 'envamt' || k === 'sustain') {
      const base = T.cutoff(p.cutoff), held = base * 2 ** (T.envOct(p.envamt) * p.sustain / 127);
      v.fl.frequency.cancelScheduledValues(t);
      v.fl.frequency.setTargetAtTime(Math.min(held, 18000), t, 0.03);
    }
  }
  noteOn(id, note, vel) {
    if (!this.on) return;
    this.resume();
    if (this.voices.has(id)) this.noteOff(id, true);
    if (this.voices.size >= 8) {
      let old = null; for (const [k, v] of this.voices) if (!old || v.age < old[1].age) old = [k, v];
      this.noteOff(old[0], true);
    }
    const c = this.ctx, p = this.p, t = c.currentTime, f = hz(note);
    if (!this.voices.size && p.lfade) {
      const d = p.ldepth / 127;
      this.lfoAmt.gain.cancelScheduledValues(t); this.lfoAmt.gain.setValueAtTime(0, t);
      this.lfoAmt.gain.linearRampToValueAtTime(d / 2, t + sq(p.lfade) * 4);
    }
    const osc = (type, fr) => { const o = c.createOscillator(); o.type = type; o.frequency.value = fr; const g = c.createGain(); o.connect(g); return [o, g]; };
    const [o1, g1] = osc(OSC_TYPE[p.wave], f), [o2, g2] = osc(OSC_TYPE[p.wave], f), [o3, g3] = osc('square', f / 2);
    const fl = c.createBiquadFilter();
    const a = c.createGain();
    const v = { o1, o2, main: [o1, o2], oscs: [o1, o2, o3], g1, g2, g3, fl, a, age: ++this.clock };
    this.retune(v);
    // filter envelope: base -> peak over the attack, then toward the sustain point
    const base = T.cutoff(p.cutoff), oct = T.envOct(p.envamt), atk = T.attack(p.attack), dec = T.decay(p.decay);
    const peak = Math.min(base * 2 ** oct, 18000), held = Math.min(base * 2 ** (oct * p.sustain / 127), 18000);
    fl.frequency.cancelScheduledValues(t);
    fl.frequency.setValueAtTime(base, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(peak, 20), t + atk);
    fl.frequency.setTargetAtTime(held, t + atk, dec / 3);
    const amp = vel / 127 * 0.5;
    a.gain.setValueAtTime(0, t);
    a.gain.linearRampToValueAtTime(amp, t + atk);
    a.gain.setTargetAtTime(amp * p.sustain / 127, t + atk, dec / 3);
    [g1, g2, g3].forEach(g => g.connect(fl));
    fl.connect(a); a.connect(this.voiceBus);
    v.oscs.forEach(o => o.start(t));
    this.voices.set(id, v);
  }
  noteOff(id, fast) {
    const v = this.voices.get(id);
    if (!v) return;
    this.voices.delete(id);
    const t = this.ctx.currentTime, r = fast ? 0.015 : T.release(this.p.release);
    for (const prm of [v.a.gain, v.fl.frequency]) {
      if (prm.cancelAndHoldAtTime) prm.cancelAndHoldAtTime(t); else { prm.cancelScheduledValues(t); prm.setValueAtTime(prm.value, t); }
    }
    v.a.gain.setTargetAtTime(0, t, r / 4);
    v.fl.frequency.setTargetAtTime(T.cutoff(this.p.cutoff), t, r / 4);
    v.oscs.forEach(o => o.stop(t + r * 1.6 + 0.05));
    v.o1.onended = () => { v.a.disconnect(); v.fl.disconnect(); };
  }
  allOff() { for (const id of [...this.voices.keys()]) this.noteOff(id); }
  scope() { if (!this.ctx) return null; this.an.getByteTimeDomainData(this.buf); return this.buf; }
}
