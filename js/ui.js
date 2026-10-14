const CASES = [['#f26b1d', 'Orange'], ['#8d8f94', 'Gray'], ['#1f2023', 'Black'], ['#e8e6df', 'White']];
const $ = id => document.getElementById(id);

export function initUI({ S, midi, persist, resetView, start, setVariant, setCase, setGrid, setMidi }) {
  const tabs = [...document.querySelectorAll('#tabs [role=tab]')];
  const paintTabs = () => tabs.forEach(t => { const on = t.dataset.v === S.variant; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { start(); setVariant(t.dataset.v); paintTabs(); });
    t.addEventListener('keydown', e => {
      const n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!n) return;
      const o = tabs[(i + n + tabs.length) % tabs.length]; o.focus(); o.click();
    });
  });
  paintTabs();
  const modal = $('modal');
  const open = () => { start(); modal.showModal(); refreshMidi(); };
  $('info').addEventListener('click', open);
  $('close').addEventListener('click', () => modal.close());
  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
  modal.addEventListener('close', () => $('info').focus());

  // case swatches
  const sw = $('swatches');
  CASES.forEach(([c, name]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'radio'); b.title = name; b.setAttribute('aria-label', name);
    b.dataset.c = c; b.style.setProperty('--c', c);
    b.addEventListener('click', () => { setCase(c); paint(); });
    sw.append(b);
  });
  const paint = () => sw.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.c === S.caseColor)));
  paint();

  const grid = $('grid'); grid.checked = S.grid;
  grid.addEventListener('change', () => setGrid(grid.checked));
  $('reset').addEventListener('click', resetView);

  // midi
  const sIn = $('midi-in'), sOut = $('midi-out'), sCh = $('midi-ch');
  const opt = (v, t, sel) => { const o = document.createElement('option'); o.value = v; o.textContent = t; o.selected = sel; return o; };
  sCh.replaceChildren(opt('0', 'Omni', S.channel === 0), ...Array.from({ length: 16 }, (_, i) => opt(String(i + 1), String(i + 1), S.channel === i + 1)));
  function refreshMidi() {
    const note = $('midi-note');
    const ok = midi.supported && midi.access;
    sIn.disabled = sOut.disabled = !ok;
    note.hidden = !!ok && !midi.denied;
    note.textContent = !midi.supported ? 'Web MIDI is not supported in this browser.' : midi.denied ? 'MIDI access was blocked.' : 'Waiting for MIDI access.';
    sIn.replaceChildren(opt('all', 'All inputs', S.midiIn === 'all'), ...midi.inputs().map(d => opt(d.id, d.name, S.midiIn === d.id)));
    sOut.replaceChildren(opt('off', 'Off', S.midiOut === 'off'), opt('all', 'All outputs', S.midiOut === 'all'), ...midi.outputs().map(d => opt(d.id, d.name, S.midiOut === d.id)));
    if (!sIn.value) sIn.value = 'all';
  }
  sIn.addEventListener('change', () => { S.midiIn = sIn.value; setMidi(); });
  sOut.addEventListener('change', () => { S.midiOut = sOut.value; setMidi(); });
  sCh.addEventListener('change', () => { S.channel = +sCh.value; setMidi(); });

  // keyboard diagram
  const rows = [
    ['sharps', ['2', '3', null, '5', '6', '7', null]],
    ['n', ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I']],
    ['sharps', [null, 'D', 'F', null, 'H', 'J', 'K']],
    ['n', ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',']],
  ];
  $('kbd').replaceChildren(...rows.map(([kind, keys]) => {
    const r = document.createElement('div'); r.className = 'r' + (kind === 'sharps' ? ' sharps' : '');
    keys.forEach(k => { const i = document.createElement('i'); if (k) { i.textContent = k; i.className = kind === 'n' ? 'n' : 's'; } else i.className = 'gap'; r.append(i); });
    return r;
  }));
  return { refreshMidi, paintTabs };
}
