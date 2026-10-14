export const WAVES = ['saw', 'square', 'triangle', 'sine'];
const TYPE = ['sawtooth', 'square', 'triangle', 'sine'];
const hz = n => 440 * 2 ** ((n - 69) / 12);

export class Synth {
  constructor(p) { this.p = { ...p }; this.voices = new Map(); this.ctx = null; this.on = true; }
  ensure() {
    if (this.ctx) return;
    const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.005; comp.release.value = 0.2;
    this.an = c.createAnalyser(); this.an.fftSize = 1024;
    this.buf = new Uint8Array(this.an.fftSize);
    this.master.connect(comp); comp.connect(this.an); this.an.connect(c.destination);
    this.applyMaster(true);
  }
  resume() { this.ensure(); if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }
  cut() { return 30 * 2 ** (this.p.cutoff / 127 * 9); }
  q() { return 0.5 + (this.p.reso / 127) ** 2 * 18; }
  atk() { return 0.003 + (this.p.attack / 127) ** 2 * 1.5; }
  rel() { return 0.03 + (this.p.release / 127) ** 2 * 3; }
  applyMaster(now) {
    if (!this.ctx) return;
    const g = this.on ? (this.p.level / 127) ** 2 * 0.8 : 0;
    if (now) this.master.gain.value = g; else this.master.gain.setTargetAtTime(g, this.ctx.currentTime, 0.02);
  }
  setPower(on) { this.on = on; if (!on) this.allOff(); this.applyMaster(false); }
  setParam(k, v) {
    this.p[k] = v;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (k === 'level') this.applyMaster(false);
    for (const vo of this.voices.values()) {
      if (k === 'cutoff') { vo.fl.frequency.cancelScheduledValues(t); vo.fl.frequency.setTargetAtTime(this.cut(), t, 0.02); }
      if (k === 'reso') vo.fl.Q.setTargetAtTime(this.q(), t, 0.02);
      if (k === 'wave') vo.main.forEach(o => { o.type = TYPE[v]; });
    }
  }
  noteOn(id, note, vel) {
    if (!this.on) return;
    this.resume();
    if (this.voices.has(id)) this.noteOff(id);
    if (this.voices.size >= 16) this.noteOff(this.voices.keys().next().value, true);
    const c = this.ctx, t = c.currentTime, f = hz(note);
    const osc = (type, fr, det, g) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = fr; o.detune.value = det;
      const gn = c.createGain(); gn.gain.value = g; o.connect(gn); return [o, gn];
    };
    const w = TYPE[this.p.wave];
    const [o1, g1] = osc(w, f, -6, 0.35), [o2, g2] = osc(w, f, 6, 0.35), [o3, g3] = osc('square', f / 2, 0, 0.16);
    const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = this.q();
    const cut = this.cut();
    fl.frequency.setValueAtTime(Math.min(cut * 3.5, 18000), t);
    fl.frequency.setTargetAtTime(cut, t, 0.18);
    const a = c.createGain();
    a.gain.setValueAtTime(0, t);
    a.gain.linearRampToValueAtTime(vel / 127, t + this.atk());
    [g1, g2, g3].forEach(g => g.connect(fl));
    fl.connect(a); a.connect(this.master);
    [o1, o2, o3].forEach(o => o.start(t));
    this.voices.set(id, { oscs: [o1, o2, o3], main: [o1, o2], fl, a });
  }
  noteOff(id, fast) {
    const v = this.voices.get(id);
    if (!v) return;
    this.voices.delete(id);
    const t = this.ctx.currentTime, r = fast ? 0.02 : this.rel();
    const g = v.a.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
    g.setTargetAtTime(0, t, r / 4);
    v.oscs.forEach(o => o.stop(t + r * 1.5 + 0.05));
    v.oscs[0].onended = () => { v.a.disconnect(); v.fl.disconnect(); };
  }
  allOff() { for (const id of [...this.voices.keys()]) this.noteOff(id); }
  scope() { if (!this.ctx) return null; this.an.getByteTimeDomainData(this.buf); return this.buf; }
}
