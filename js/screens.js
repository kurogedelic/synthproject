// LCD pages after Kreisel's UI: black ground, one accent panel per page at
// 85 % over black, black ink on panels, a four-column knob row and one
// functional drawing per page. Sized for 320 x 170; 320 x 80 gets a compact view.
import { PAGES, WAVES, FX_NAMES, T } from './synth.js?v=66';
import { PIECES, DRUM_KNOBS, STEPS } from './drums.js?v=66';

const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = n => NOTE[n % 12] + (Math.floor(n / 12) - 1);
const FONT = '"Inter Tight", system-ui, sans-serif';
const PANEL = { teal: '#00B8D9', orange: '#D94909', lime: '#AAD94D', mint: '#6ED9A1', violet: '#966DD9', blue: '#5274D9', pink: '#D968B8', grey: '#B8B8B8' };
const mix = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = k => Math.round(((pa >> k) & 255) * (1 - t) + ((pb >> k) & 255) * t);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};
const FOCUS_MS = 1200;

let probe = null; // a BiquadFilterNode on a silent context, used only for its frequency response
function filterCurve(type, f, q, n) {
  try {
    probe ??= new OfflineAudioContext(1, 128, 48000).createBiquadFilter();
    probe.type = type; probe.frequency.value = f; probe.Q.value = q;
    const fr = new Float32Array(n), mag = new Float32Array(n), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) fr[i] = 30 * (18000 / 30) ** (i / (n - 1));
    probe.getFrequencyResponse(fr, mag, ph);
    return mag;
  } catch { return null; }
}

export function drawScreen(lcd, s, now) {
  const g = lcd.ctx;
  g.save();
  g.fillStyle = '#000'; g.fillRect(0, 0, lcd.w, lcd.h);
  if (s.power) (lcd.h > 100 ? full : compact)(g, lcd.w, lcd.h, s, now);
  g.restore();
}

// ---- shared pieces
function view(s) {
  if (s.mode === 'drum') {
    const p = s.drum.params[s.drum.sel];
    return { color: 'pink', knobs: DRUM_KNOBS.map(([label, k]) => [label, String(Math.round(p[k] / 127 * 100))]) };
  }
  const page = PAGES[s.page];
  return {
    color: page.color, page,
    knobs: page.knobs.map(([label, k, names]) => [label, names ? names[s.params[k]] : String(Math.round(s.params[k] / 127 * 100))]),
  };
}
function focusOf(s, now) {
  let f = -1, best = 0;
  for (let i = 0; i < 4; i++) { const t = s.touched['k' + i] || 0; if (now - t < FOCUS_MS && t > best) { best = t; f = i; } }
  return f;
}
function text(g, str, x, y, size, color, align = 'left', weight = 500, track = 0) {
  g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = track + 'px';
  g.fillText(str, x, y);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}
function panel(g, x, y, w, h, color, r = 6) { g.fillStyle = color; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }
function stroke(g, pts, color, width) {
  g.strokeStyle = color; g.lineWidth = width; g.lineJoin = g.lineCap = 'round';
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
}
function knobRow(g, x, y, w, h, s, now, v, big) {
  const col = PANEL[v.color], dim = mix(col, '#000000', 0.62), f = focusOf(s, now);
  panel(g, x, y, w, h, col);
  const pad = 6, gap = 6, cw = (w - pad * 2 - gap * 3) / 4;
  v.knobs.forEach(([label, value], i) => {
    const cx = x + pad + i * (cw + gap) + cw / 2, ink = f < 0 || f === i ? '#000' : dim;
    text(g, label, cx, y + (big ? 15 : 12), big ? 11 : 9, ink, 'center', 600, 0.5);
    text(g, value, cx, y + (big ? 36 : 28), big ? 19 : 14, ink, 'center', 500, 1);
  });
}
function status(g, w, s, size, y, now) {
  let left, right;
  if (s.mode === 'drum') {
    left = 'DRUM  ' + PIECES[s.drum.sel].name;
    right = s.drum.bpm + ' BPM';
  } else {
    left = `${s.preset + 1}  ${s.presetName}`;
    // the tempo shows here for a moment while the TEMPO encoder turns
    right = now - (s.touched.tempo || 0) < FOCUS_MS ? s.drum.bpm + ' BPM' : PAGES[s.page].id + '   OCT ' + (s.octave >= 0 ? '+' : '') + s.octave;
  }
  text(g, left, 8, y, size, '#fff');
  const tx = w - 8 - (s.playing || s.rec ? size + 6 : 0);
  text(g, right, tx, y, size, '#8c8c8c', 'right');
  if (s.rec) { g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(w - 8 - size / 2, y, size * 0.32, 0, Math.PI * 2); g.fill(); }
  else if (s.playing) {
    const a = size * 0.36, cx = w - 8 - size / 2;
    g.fillStyle = '#81FFBD'; g.beginPath(); g.moveTo(cx - a * 0.8, y - a); g.lineTo(cx + a, y); g.lineTo(cx - a * 0.8, y + a); g.fill();
  }
}

// ---- 320 x 170
function full(g, w, h, s, now) {
  status(g, w, s, 13, 12, now);
  const x = 8, gw = w - 16, gy = 26, gh = 80, v = view(s);
  if (s.mode === 'drum') drumGrid(g, x, gy, gw, gh, s, now);
  else graphic(g, x, gy, gw, gh, s, v);
  knobRow(g, x, 112, gw, h - 112 - 6, s, now, v, true);
}

function graphic(g, x, y, w, h, s, v) {
  const p = s.params, id = v.page.id, col = PANEL[v.color], ink = '#000', guide = mix(col, '#000000', 0.5);
  if (id === 'HOME') {
    // Preset number and name on top, the output scope below. Silent output
    // leaves a dim baseline rather than an empty screen.
    text(g, 'PRESET ' + (s.preset + 1), x + 2, y + 9, 10, '#8c8c8c', 'left', 600, 1);
    text(g, s.presetName, x + 2, y + 29, 22, '#fff', 'left', 600);
    if (s.lastNote != null) text(g, noteName(s.lastNote), x + w - 2, y + 29, 14, PANEL.teal, 'right', 600);
    const sy = y + 62, amp = 16, d = s.scope;
    let peak = 0;
    if (d) for (let i = 0; i < d.length; i += 8) peak = Math.max(peak, Math.abs(d[i] - 128));
    if (d && peak > 1) {
      const pts = [];
      for (let i = 0; i <= w; i += 2) pts.push([x + i, sy - (d[Math.floor(i / w * d.length / 2)] - 128) / 128 * amp * 2]);
      stroke(g, pts, PANEL.teal, 1.5);
    } else stroke(g, [[x, sy], [x + w, sy]], '#2e2e2e', 1);
    return;
  }
  panel(g, x, y, w, h, col);
  const ix = x + 12, iw = w - 24, iy = y + 10, ih = h - 20;
  if (id === 'OSC') {
    const shape = (ph, wv) => { ph -= Math.floor(ph); return [1 - 2 * ph, ph < 0.5 ? 1 : -1, ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph, Math.sin(ph * 2 * Math.PI)][wv]; };
    const det = 1 + T.detuneCents(p.detune) / 1200 * 4, m = p.mix / 127, sub = p.sub / 127, raw = [];
    for (let i = 0; i <= 160; i++) {
      const ph = i / 160 * 2;
      raw.push((1 - m) * shape(ph, p.wave) + m * shape(ph * det + 0.25, p.wave) + sub * 0.6 * shape(ph / 2, 1));
    }
    const pk = Math.max(...raw.map(Math.abs), 0.01);
    stroke(g, raw.map((r, i) => [ix + i / 160 * iw, iy + ih / 2 - r / pk * ih / 2]), ink, 3);
    text(g, WAVES[p.wave], x + w - 10, y + 12, 11, ink, 'right', 600, 1);
  } else if (id === 'FILTER') {
    const n = 96, mag = filterCurve(['lowpass', 'bandpass', 'highpass'][p.ftype], T.cutoff(p.cutoff), T.q(p.reso, p.ftype), n);
    const fx = Math.log(T.cutoff(p.cutoff) / 30) / Math.log(18000 / 30);
    stroke(g, [[ix + fx * iw, iy], [ix + fx * iw, iy + ih]], guide, 1);
    if (mag) stroke(g, [...mag].map((m, i) => [ix + i / (n - 1) * iw, iy + (24 - Math.max(-30, Math.min(24, 20 * Math.log10(m + 1e-6)))) / 54 * ih]), ink, 3);
  } else if (id === 'ENV') {
    const a = Math.sqrt(T.attack(p.attack)), d = Math.sqrt(T.decay(p.decay)), r = Math.sqrt(T.release(p.release)), hold = (a + d + r) * 0.4;
    const k = iw / (a + d + hold + r), sus = p.sustain / 127, top = iy, base = iy + ih;
    let cx = ix;
    const pts = [[cx, base]];
    pts.push([cx += a * k, top]);
    for (let i = 1; i <= 12; i++) pts.push([cx + d * k * i / 12, base - ih * (sus + (1 - sus) * Math.exp(-4 * i / 12))]);
    cx += d * k; pts.push([cx += hold * k, base - ih * sus]);
    for (let i = 1; i <= 12; i++) pts.push([cx + r * k * i / 12, base - ih * sus * Math.exp(-4 * i / 12)]);
    stroke(g, pts, ink, 3);
  } else if (id === 'LFO') {
    const depth = Math.max(p.ldepth / 127, 0.08), fade = p.lfade / 127, pts = [];
    for (let i = 0; i <= 160; i++) {
      const t = i / 160, ph = t * 3 % 1, amp = depth * Math.min(1, fade ? t / (fade * 0.6 + 0.001) : 1);
      const v = [Math.sin(ph * 2 * Math.PI), ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph, ph < 0.5 ? 1 : -1, 1 - 2 * ph][p.lshape];
      pts.push([ix + t * iw, iy + ih / 2 - v * amp * ih / 2]);
    }
    stroke(g, pts, ink, 3);
  } else if (id === 'FX') {
    text(g, FX_NAMES[p.fx], ix, y + 20, 18, ink, 'left', 600, 1);
    const gx = ix + iw * 0.45, gw = iw * 0.55, cy = iy + ih / 2 + 6, amp = ih / 2 - 8, pts = [];
    if (p.fx === 1) {
      const k = 1 + (p.ffb / 127) ** 2 * 8;
      for (let i = 0; i <= 80; i++) pts.push([gx + i / 80 * gw, cy - Math.tanh(k * Math.sin(i / 80 * 4 * Math.PI)) / Math.tanh(k) * amp]);
      stroke(g, pts, ink, 3);
    } else if (p.fx === 2) {
      const gap = 6 + (p.ftime / 127) * 22, fb = p.ffb / 127;
      for (let i = 0, a = 1; gx + i * gap <= gx + gw && a > 0.04; i++, a *= Math.max(fb, 0.15)) stroke(g, [[gx + i * gap, cy + amp], [gx + i * gap, cy + amp - a * amp * 2]], ink, 4);
    } else if (p.fx === 3) {
      const dep = 0.15 + p.ffb / 127 * 0.5;
      for (const off of [0, dep]) { const q = []; for (let i = 0; i <= 80; i++) q.push([gx + i / 80 * gw, cy - Math.sin(i / 80 * 4 * Math.PI + off * 3) * amp * (1 - off * 0.4)]); stroke(g, q, off ? guide : ink, 3); }
    } else stroke(g, [[gx, cy], [gx + gw, cy]], ink, 3);
  }
}

function drumGrid(g, x, y, w, h, s, now) {
  const d = s.drum, rows = PIECES.length, pitchX = w / STEPS, pitchY = h / rows, cw = pitchX - 3, ch = pitchY - 2;
  for (let r = 0; r < rows; r++) {
    const sel = r === d.sel, hue = PIECES[r].hue * 360, flash = s.hits ? Math.max(0, 1 - (now - s.hits[r]) / 180) : 0;
    for (let c = 0; c < STEPS; c++) {
      const on = d.pattern[r][c], head = c === s.step;
      let fill;
      if (on) fill = sel ? `hsl(${hue} 85% ${head ? 72 : 58}%)` : `hsl(${hue} 35% ${head ? 52 : 34 + flash * 20}%)`;
      else fill = head ? (sel ? '#5a5a5a' : '#2c2c2c') : sel ? (c % 4 ? '#262626' : '#333') : (c % 4 ? '#121212' : '#1a1a1a');
      g.fillStyle = fill;
      g.beginPath(); g.roundRect(x + c * pitchX + 1.5, y + r * pitchY + 1, cw, ch, 2); g.fill();
    }
  }
}

// ---- 320 x 80
function compact(g, w, h, s, now) {
  status(g, w, s, 11, 8, now);
  const v = view(s);
  if (s.mode === 'drum') {
    const d = s.drum, pitch = (w - 16) / STEPS, hue = PIECES[d.sel].hue * 360;
    for (let c = 0; c < STEPS; c++) {
      g.fillStyle = d.pattern[d.sel][c] ? `hsl(${hue} 85% ${c === s.step ? 72 : 55}%)` : c === s.step ? '#555' : c % 4 ? '#222' : '#333';
      g.beginPath(); g.roundRect(8 + c * pitch + 1, 18, pitch - 2, 10, 2); g.fill();
    }
    knobRow(g, 8, 32, w - 16, h - 36, s, now, v, false);
  } else knobRow(g, 8, 18, w - 16, h - 22, s, now, v, false);
}
