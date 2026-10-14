const CASES = [['#f26b1d', 'Orange'], ['#8d8f94', 'Gray'], ['#1f2023', 'Black'], ['#e8e6df', 'White']];
const $ = id => document.getElementById(id);

export function initUI({ S, midi, persist, resetView, start, setCase, setGrid, setMidi, IDEAS, setView }) {
  const design = $('design'), btn = $('design-btn'), menu = $('design-menu'), current = $('design-current');
  const closeMenu = (focusBtn = false) => {
    if (menu.hidden) return;
    menu.hidden = true; btn.setAttribute('aria-expanded', 'false');
    if (focusBtn) btn.focus();
  };
  const openMenu = () => {
    menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
    (menu.querySelector('[aria-selected="true"]') || menu.querySelector('a'))?.focus();
  };
  IDEAS.forEach(idea => {
    const a = document.createElement('a');
    a.href = '#idea' + idea.id; a.dataset.v = idea.id; a.setAttribute('role', 'option'); a.textContent = idea.label;
    a.addEventListener('click', () => { start(); closeMenu(); });
    menu.append(a);
  });
  const paintIdeas = () => {
    const idea = IDEAS.find(i => i.id === S.variant) || IDEAS[0];
    current.textContent = idea.label;
    btn.setAttribute('aria-label', 'Design, ' + idea.label);
    menu.querySelectorAll('a').forEach(a => a.setAttribute('aria-selected', String(a.dataset.v === S.variant)));
  };
  btn.addEventListener('click', () => { start(); menu.hidden ? openMenu() : closeMenu(); });
  btn.addEventListener('keydown', e => {
    if ((e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') && menu.hidden) { e.preventDefault(); openMenu(); }
  });
  menu.addEventListener('keydown', e => {
    const items = [...menu.querySelectorAll('a')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); items.at(-1)?.focus(); }
  });
  addEventListener('pointerdown', e => { if (!menu.hidden && !design.contains(e.target)) closeMenu(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { e.preventDefault(); closeMenu(true); } });
  addEventListener('hashchange', () => { closeMenu(); paintIdeas(); });
  paintIdeas();

  const viewBtns = [...document.querySelectorAll('#views [data-view]')];
  const paintView = name => viewBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  viewBtns.forEach(b => b.addEventListener('click', () => { start(); setView(b.dataset.view); }));
  paintView('front');
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
  $('reset').addEventListener('click', () => resetView(true));

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
  return { refreshMidi, paintIdeas, paintView };
}
