import { WAVES } from './synth.js';

const C = { bg: '#0a1014', fg: '#e2efe8', dim: '#46585a', accent: '#ff7a1a', grid: '#16242a' };
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = n => NOTE[n % 12] + (Math.floor(n / 12) - 1);
const clean = (s, n) => (s || '-').toUpperCase().replace(/[^ -Z]/g, '?').slice(0, n);

export function drawScreen(lcd, s, now) {
  lcd.clear(C.bg);
  if (!s.power) return;
  if (s.screen === 0) main(lcd, s, now);
  else if (s.screen === 1) scope(lcd, s);
  else midi(lcd, s);
  lcd.rect(0, 0, lcd.w, 1, C.grid);
}

function main(l, s, now) {
  l.text(WAVES[s.params.wave].toUpperCase(), 8, 5, 2, C.accent);
  const oct = 'OCT ' + (s.octave >= 0 ? '+' : '-') + Math.abs(s.octave);
  l.text(oct, 112, 5, 2, C.dim);
  const nn = s.lastNote == null ? '--' : noteName(s.lastNote);
  l.text(nn, l.w - 8 - l.textWidth(nn, 2), 5, 2, C.fg);
  l.rect(6, 24, l.w - 12, 1, C.grid);
  const cells = [['CUT', 'cutoff'], ['RES', 'reso'], ['ATK', 'attack'], ['REL', 'release']];
  cells.forEach(([lab, key], i) => {
    const x = 8 + (i % 2) * 158, y = 32 + Math.floor(i / 2) * 24;
    const hot = now - (s.touched[key] || 0) < 1200;
    l.text(lab, x, y, 2, hot ? C.fg : C.dim);
    l.rect(x + 44, y + 1, 102, 12, C.grid);
    l.rect(x + 45, y + 2, Math.round(100 * s.params[key] / 127), 10, hot ? C.accent : '#b8581a');
  });
}

function scope(l, s) {
  for (let x = 0; x < l.w; x += 32) l.rect(x, 0, 1, l.h, C.grid);
  l.rect(0, l.h / 2, l.w, 1, C.grid);
  const d = s.scope;
  if (d) {
    let prev = null;
    for (let x = 0; x < l.w; x++) {
      const v = d[Math.floor(x * d.length / l.w / 2)] / 255;
      const y = Math.round(4 + (1 - v) * (l.h - 8));
      const y0 = prev == null ? y : prev;
      l.rect(x, Math.min(y, y0), 1, Math.abs(y - y0) + 1, C.accent);
      prev = y;
    }
  }
  l.text('SCOPE', 6, 5, 1, C.dim);
}

function midi(l, s) {
  const rows = [['IN', s.midiIn], ['OUT', s.midiOut], ['CH', s.channel ? String(s.channel) : 'OMNI']];
  rows.forEach(([k, v], i) => {
    const y = 8 + i * 24;
    l.text(k, 8, y, 2, C.dim);
    l.text(clean(v, 21), 56, y, 2, C.fg);
  });
}
