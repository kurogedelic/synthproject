import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { buildModel, BASE_NOTE, IDEAS } from './model.js?v=77';
import { Synth, PAGES, PRESETS, paramMax } from './synth.js?v=77';
import { Drums, PIECES, DRUM_KNOBS, GM, defaultDrums } from './drums.js?v=77';
import { Midi } from './midi.js?v=77';
import { Lcd } from './lcd.js?v=77';
import { drawScreen, noteName } from './screens.js?v=77';
import { initUI } from './ui.js?v=77';

const KEY = 'synthproject:v3';
const DEFAULTS = {
  caseColor: '#8d8f94', variant: 'A', grid: true, midiIn: 'all', midiOut: 'off', channel: 0, octave: 0,
  mode: 'key', page: 0, preset: 0, level: 100, light: 50, params: { ...PRESETS[0].params },
};
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
const S = { ...DEFAULTS, ...saved, params: { ...DEFAULTS.params, ...(saved.params || {}) } };
S.drum = (() => { const d = defaultDrums(), sd = saved.drum || {}; return { ...d, ...sd, pattern: sd.pattern?.length === PIECES.length ? sd.pattern : d.pattern, params: sd.params?.length === PIECES.length ? sd.params : d.params }; })();
S.variant = DEFAULTS.variant; // always open on Idea A unless the hash names another
const ideaFromHash = hash => IDEAS.find(i => hash === '#idea' + i.id)?.id;
const hv = ideaFromHash(location.hash);
if (hv) S.variant = hv;
S.power = true; S.lastNote = null; S.touched = {}; S.scope = null;
let saveTimer = 0;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const { caseColor, variant, grid, midiIn, midiOut, channel, octave, mode, page, preset, level, light, params, drum } = S;
      localStorage.setItem(KEY, JSON.stringify({ caseColor, variant, grid, midiIn, midiOut, channel, octave, mode, page, preset, level, light, params, drum }));
    } catch {}
  }, 300);
};

// ---- engine
const synth = new Synth(S.params, S.level);
const drums = new Drums(synth, S.drum);
const midi = new Midi({
  onNote: (n, v, on) => {
    if (S.mode === 'drum') { if (on && GM[n] != null) { drums.hit(GM[n]); lcdDirty = true; } return; }
    on ? noteOn('m' + n, n, v) : noteOff('m' + n);
  },
  onCC: (c, v) => { const k = CC_IN[c]; if (k === 'level') setLevel(v, false); else if (k) setParam(k, v, false, true); },
  onDevices: () => ui?.refreshMidi(),
});
midi.inId = S.midiIn; midi.outId = S.midiOut; midi.channel = S.channel;
// Fixed CC map whatever page is showing.
const CC_OUT = { level: 7, cutoff: 74, reso: 71, attack: 73, release: 72 };
const CC_IN = Object.fromEntries(Object.entries(CC_OUT).map(([k, c]) => [c, k]));
const ENC = ['set1', 'set2', 'set3', 'set4'];
const F_PAGE = { f1: 0, f2: 1, f3: 2, f4: 3, f5: 4, f6: 5 }, F_PRESET = { f7: 0, f8: 1, f9: 2, f10: 3, f11: 4, f12: 5 };

// ---- scene
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.8;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
// Room brightness (0..100, 50 = default) scales the exposure of the lit
// scene. The LCD and NeoPixels are not tone mapped, so they keep their glow.
function setLight(v) {
  S.light = Math.max(0, Math.min(100, +v));
  renderer.toneMappingExposure = 0.8 * 2 ** ((S.light - 50) / 36);
  dirty = true;
}
const sun = new THREE.DirectionalLight('#ffffff', 1.5);
sun.position.set(-140, 280, 200); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.radius = 5;
Object.assign(sun.shadow.camera, { left: -220, right: 220, top: 160, bottom: -160, near: 50, far: 700 });
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.38 }));
ground.receiveShadow = true; scene.add(ground);
const KMAP = new Map();
const NAT = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI'];
const SHARP = ['KeyD', 'KeyF', 'KeyH', 'KeyJ', 'KeyK', 'Digit2', 'Digit3', 'Digit5', 'Digit6', 'Digit7'];
let model, lcd;
function loadModel(v) {
  if (model) { scene.remove(model.root); model.dispose(); lcd?.texture.dispose(); }
  model = buildModel(v);
  scene.add(model.root);
  ground.position.y = model.floorY;
  model.setCaseColor(S.caseColor); model.setGrid(S.grid);
  lcd = new Lcd(...model.lcdRes); model.lcdMat.map = lcd.texture;
  KMAP.clear();
  NAT.forEach((c, i) => KMAP.set(c, model.byId['n' + i]));
  SHARP.forEach((c, i) => KMAP.set(c, model.byId['s' + i]));
  syncPot(); model.byId.level.ang = model.byId.level.angTarget; model.setPower?.(S.power);
  lcdDirty = true; dirty = true;
}

const camera = new THREE.PerspectiveCamera(28, 1, 10, 8000);
const target = new THREE.Vector3(0, -8, 0);
// Directions from the orbit target toward the camera. Front is centered on the
// player's side (no yaw). Perspective keeps the previous three-quarter angle.
const VIEW_DIR = {
  front: new THREE.Vector3(0, 0.92, 0.55),
  top: new THREE.Vector3(0, 1, 0.035),
  side: new THREE.Vector3(1, 0.62, 0),
  persp: new THREE.Vector3(-0.3, 0.92, 0.55),
};
const VIEW_ANG = Object.fromEntries(Object.entries(VIEW_DIR).map(([k, v]) => [k, new THREE.Spherical().setFromVector3(v.clone().normalize())]));
const _dir = new THREE.Vector3(), _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _camUp = new THREE.Vector3(), _sph = new THREE.Spherical();
let dirty = true, lcdDirty = true, viewAnim = null, activeView = 'front';
const mark = () => { dirty = true; };

function frameDistance(dir) {
  _fwd.copy(dir).negate();
  _right.crossVectors(_fwd, _camUp.set(0, 1, 0));
  if (_right.lengthSq() < 1e-8) _right.set(1, 0, 0); else _right.normalize();
  _camUp.crossVectors(_right, _fwd).normalize();
  const hx = model.width / 2 + 43, y0 = model.floorY - 5 - target.y, y1 = 24 - target.y, hz = model.depth / 2 + 24;
  let maxR = 1, maxU = 1;
  for (const x of [-hx, hx]) for (const y of [y0, y1]) for (const z of [-hz, hz]) {
    maxR = Math.max(maxR, Math.abs(x * _right.x + y * _right.y + z * _right.z));
    maxU = Math.max(maxU, Math.abs(x * _camUp.x + y * _camUp.y + z * _camUp.z));
  }
  const v = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const h = v * Math.max(camera.aspect, 0.25);
  return Math.max(maxR / h, maxU / v) * 1.28;
}
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  if (viewAnim) viewAnim.r1 = frameDistance(_dir.copy(VIEW_DIR[viewAnim.name]).normalize());
  else if (controls) {
    _dir.copy(camera.position).sub(controls.target);
    if (_dir.lengthSq() > 1) {
      _dir.normalize();
      camera.position.copy(controls.target).addScaledVector(_dir, frameDistance(_dir));
    }
  }
  mark();
}
function placeCamera(name, animate = true) {
  if (!VIEW_DIR[name]) return;
  const dist = frameDistance(_dir.copy(VIEW_DIR[name]).normalize());
  const goal = new THREE.Spherical().setFromVector3(_dir.multiplyScalar(dist));
  controls._sphericalDelta.set(0, 0, 0);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const curOff = camera.position.clone().sub(controls.target);
  if (!animate || reduce || curOff.lengthSq() < 1) {
    viewAnim = null;
    camera.position.copy(target).add(_dir);
    controls.target.copy(target);
    camera.lookAt(target);
    controls.update();
  } else {
    const cur = new THREE.Spherical().setFromVector3(curOff);
    let dTheta = goal.theta - cur.theta;
    if (dTheta > Math.PI) dTheta -= Math.PI * 2;
    else if (dTheta < -Math.PI) dTheta += Math.PI * 2;
    viewAnim = { t0: performance.now(), dur: 600, theta0: cur.theta, dTheta, phi0: cur.phi, phi1: goal.phi, r0: cur.radius, r1: goal.radius, name };
  }
  activeView = name;
  ui.paintViews(name);
  mark();
}
function stepView(now) {
  const a = viewAnim;
  if (!a) return false;
  const t = Math.min(1, (now - a.t0) / a.dur);
  const e = t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
  _sph.set(a.r0 + (a.r1 - a.r0) * e, a.phi0 + (a.phi1 - a.phi0) * e, a.theta0 + a.dTheta * e);
  camera.position.setFromSpherical(_sph).add(target);
  controls.target.copy(target);
  camera.lookAt(target);
  if (t >= 1) viewAnim = null;
  return true;
}
function syncViewHighlight() {
  _sph.setFromVector3(_dir.copy(camera.position).sub(controls.target));
  let best = null, bestD = 0.16;
  for (const [name, ang] of Object.entries(VIEW_ANG)) {
    let dth = Math.abs(_sph.theta - ang.theta);
    if (dth > Math.PI) dth = Math.PI * 2 - dth;
    const dph = Math.abs(_sph.phi - ang.phi);
    const d = _sph.phi < 0.2 && ang.phi < 0.2 ? dph : Math.hypot(dth, dph);
    if (d < bestD) { best = name; bestD = d; }
  }
  if (best !== activeView) { activeView = best; ui.paintViews(best); }
}
function resetView() { placeCamera('front', true); }

// ---- interaction (registered before OrbitControls so it can claim events)
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const pick = e => {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const h = ray.intersectObjects(model.pickables, false)[0];
  return h ? h.object.userData.ctl : null;
};
const onCase = e => {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObject(model.root, true).length > 0;
};
const ptrs = new Map();
let controls;
const noteFor = ctl => BASE_NOTE + 12 * S.octave + ctl.off;

canvas.addEventListener('pointerdown', e => {
  const c = pick(e);
  // Dragging on the case does nothing; the camera only moves from the background.
  if (!c) { if (onCase(e)) { e.stopImmediatePropagation(); e.preventDefault(); } return; }
  e.stopImmediatePropagation(); e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const p = { ctl: c, y: e.clientY, acc: 0 }; ptrs.set(e.pointerId, p);
  if (controls) controls.enabled = false;
  if (c.type === 'key') press('p' + e.pointerId, c);
  else if (c.type === 'btn') { c.target = 1; btnDown(c.id); mark(); }
}, true);

canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId);
  if (!p) { hover(pick(e)); showTip(e); return; }
  const c = p.ctl;
  if (c.type === 'key') {
    const n = pick(e);
    if (S.mode === 'key' && n && n.type === 'key' && n !== c) { noteOff('p' + e.pointerId); p.ctl = n; noteOn('p' + e.pointerId, noteFor(n), 100); }
  } else if (c.type === 'enc' || c.type === 'pot') {
    const dy = p.y - e.clientY; p.y = e.clientY;
    if (c.type === 'pot') { setPot(c, dy * 0.6); return; }
    p.acc += dy;
    const per = c.id === 'mode' ? 22 : 7;
    const d = Math.trunc(p.acc / per); if (d) { p.acc -= d * per; stepEnc(c, d); }
  }
});
const release = e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  ptrs.delete(e.pointerId);
  if (p.ctl.type === 'key') noteOff('p' + e.pointerId);
  else if (p.ctl.type === 'btn') { p.ctl.target = 0; mark(); }
  if (!ptrs.size && controls) controls.enabled = true;
};
canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
let hovered = null;
function hover(c) {
  if (c === hovered) return;
  model.setHover(hovered, false); model.setHover(c, true); hovered = c; mark();
  canvas.style.cursor = c ? (c.type === 'enc' || c.type === 'pot' ? 'ns-resize' : 'pointer') : '';
}
canvas.addEventListener('pointerleave', () => { hover(null); hideTip(); });

// ---- tooltips (mouse / trackpad only)
const tipEl = document.getElementById('tip');
const fineHover = matchMedia('(hover: hover) and (pointer: fine)');
let tipFor = null;
function hideTip() { if (tipFor) { tipFor = null; tipEl.hidden = true; } }
function showTip(e) {
  if (!fineHover.matches || e.buttons || e.pointerType !== 'mouse') return hideTip();
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const o = ray.intersectObjects([...model.pickables, ...model.infos], false)[0]?.object;
  const ctl = o?.userData.ctl, tip = ctl ? ctl.tip : o?.userData.tip;
  if (!tip) return hideTip();
  const key = ctl || o;
  if (key !== tipFor) {
    tipFor = key;
    let [title, detail] = tip;
    if (ctl?.type === 'key') title += ' · ' + (S.mode === 'key' ? noteName(noteFor(ctl)) : ctl.sharp ? PIECES[keyIndex(ctl)].name : 'Step ' + (keyIndex(ctl) + 1));
    const ei = ENC.indexOf(ctl?.id);
    if (ei >= 0) detail = 'Rotary encoder · ' + knobsNow()[ei][0].toLowerCase();
    tipEl.replaceChildren(Object.assign(document.createElement('b'), { textContent: title }));
    if (detail) tipEl.append(Object.assign(document.createElement('span'), { textContent: detail }));
    tipEl.hidden = false;
  }
  const x = Math.min(e.clientX + 14, innerWidth - tipEl.offsetWidth - 8), y = e.clientY + 18;
  tipEl.style.transform = `translate(${x}px, ${y + tipEl.offsetHeight > innerHeight - 8 ? e.clientY - tipEl.offsetHeight - 10 : y}px)`;
}
canvas.addEventListener('pointerdown', hideTip);
canvas.addEventListener('wheel', hideTip, { passive: true });
let wheelAcc = 0;
canvas.addEventListener('wheel', e => {
  const c = pick(e); if (!c || (c.type !== 'enc' && c.type !== 'pot')) return;
  e.stopImmediatePropagation(); e.preventDefault();
  wheelAcc += e.deltaMode ? e.deltaY * 30 : e.deltaY;
  const d = Math.trunc(wheelAcc / 30); if (!d) return;
  wheelAcc -= d * 30;
  if (c.type === 'pot') setPot(c, -d * 4); else stepEnc(c, -d);
}, { passive: false, capture: true });

controls = new OrbitControls(camera, canvas);
Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: 120, maxDistance: 4000, maxPolarAngle: Math.PI * 0.47, minPolarAngle: 0 });
controls.addEventListener('change', () => { mark(); if (!viewAnim) syncViewHighlight(); });
controls.addEventListener('start', () => { viewAnim = null; });
canvas.style.touchAction = 'none';

// ---- notes
const held = new Map(), vis = new Map();
const keyForNote = n => model.byOff.get(n - (BASE_NOTE + 12 * S.octave));
function visPress(ctl, d) {
  if (!ctl) return; const n = (vis.get(ctl) || 0) + d; vis.set(ctl, n); ctl.target = n > 0 ? 1 : 0; mark();
}
function noteOn(src, note, vel) {
  if (!S.power) return;
  noteOff(src);
  synth.noteOn(src, note, vel); midi.noteOn(note, vel);
  const ctl = keyForNote(note); held.set(src, { note, ctl }); visPress(ctl, 1);
  S.lastNote = note; lcdDirty = true;
}
function noteOff(src) {
  const h = held.get(src); if (!h) return;
  held.delete(src); visPress(h.ctl, -1);
  if (h.note != null) { synth.noteOff(src); midi.noteOff(h.note); }
}
const allOff = () => [...held.keys()].forEach(noteOff);
// A key from the panel, pointer or computer keyboard. In drum mode the white
// keys are the sixteen steps of the selected piece and the black keys pick
// (and play) a piece.
const keyIndex = ctl => +ctl.id.slice(1);
function press(src, ctl) {
  if (!S.power) return;
  if (S.mode === 'key') return noteOn(src, noteFor(ctl), 100);
  noteOff(src);
  held.set(src, { note: null, ctl }); visPress(ctl, 1);
  if (ctl.sharp) { S.drum.sel = keyIndex(ctl); drums.hit(S.drum.sel); }
  else { const row = S.drum.pattern[S.drum.sel], i = keyIndex(ctl); row[i] = !row[i]; }
  lcdDirty = true; persist();
}

// ---- parameters
// The four page knobs (E1-E4) follow the page in keyboard mode and the
// selected piece in drum mode. The TEMPO encoder sets the sequencer tempo in both modes.
const knobsNow = () => (S.mode === 'drum' ? DRUM_KNOBS : PAGES[S.page].knobs);
function setParam(k, v, send = true, fromMidi = false) {
  v = Math.max(0, Math.min(paramMax(k), Math.round(v)));
  if (S.params[k] === v && !fromMidi) return;
  const old = S.params[k]; S.params[k] = v; synth.setParam(k, v);
  lcdDirty = true; persist();
  if (fromMidi && S.mode === 'key') {
    const i = PAGES[S.page].knobs.findIndex(x => x[1] === k);
    if (i >= 0) { S.touched['k' + i] = performance.now(); const c = model.byId[ENC[i]]; if (c) c.angTarget += (v - old) * 3; }
  }
  if (send && CC_OUT[k]) midi.cc(CC_OUT[k], v);
  mark();
}
function setLevel(v, send = true) {
  v = Math.max(0, Math.min(127, Math.round(v)));
  if (v === S.level) return;
  S.level = v; synth.setLevel(v); syncPot(); persist(); mark();
  if (send) midi.cc(CC_OUT.level, v);
}
const syncPot = () => { model.byId.level.angTarget = -135 + (S.level / 127) * 270; };
function setPot(c, dv) { setLevel(S.level + dv); }
function loadPreset(i) {
  S.preset = (i + PRESETS.length) % PRESETS.length;
  S.params = { ...PRESETS[S.preset].params }; synth.setParams(S.params);
  lcdDirty = true; persist();
}
function stepEnc(c, d) {
  c.angTarget += d * 15;
  const i = ENC.indexOf(c.id);
  if (c.id === 'mode') {
    S.drum.bpm = Math.max(40, Math.min(240, S.drum.bpm + d)); S.touched.tempo = performance.now(); lcdDirty = true; persist();
  } else if (i >= 0) {
    S.touched['k' + i] = performance.now();
    const [, k, names] = knobsNow()[i];
    if (S.mode === 'drum') {
      const p = S.drum.params[S.drum.sel]; p[k] = Math.max(0, Math.min(127, p[k] + d * 2));
      lcdDirty = true; persist();
    } else setParam(k, S.params[k] + (names ? d : d * 2));
  }
  mark();
}

function setOctave(d) {
  const o = Math.max(-3, Math.min(3, S.octave + d)); if (o === S.octave) return;
  allOff(); S.octave = o; lcdDirty = true; persist();
}
function setPower(on) {
  if (on === S.power) return;
  if (!on) { allOff(); drums.stop(); }
  S.power = on; synth.setPower(on); model.setPower?.(on); lcdDirty = true; mark();
}
function setMode(m) {
  if (m === S.mode) return;
  allOff(); S.mode = m; S.touched = {}; lcdDirty = true; persist(); ui?.paintMode(m);
}
function setPage(p) { S.page = p; S.touched = {}; lcdDirty = true; persist(); }
function btnDown(id) {
  if (!S.power && id !== 'power') return;
  if (id === 'octd') setOctave(-1);
  else if (id === 'octu') setOctave(1);
  else if (id === 'home') { if (S.mode === 'key') setPage(0); }
  else if (id === 'shift') { /* modifier: no function yet */ }
  else if (id in F_PAGE) { if (S.mode === 'key') setPage(F_PAGE[id]); }
  else if (id in F_PRESET) { if (S.mode === 'key') loadPreset(F_PRESET[id]); }
  else if (id === 'play') { drums.toggle(); lcdDirty = true; }
  else if (id === 'rec') { drums.rec = !drums.rec; lcdDirty = true; }
  else if (id === 'menu') setPage((S.page + 1) % PAGES.length);
  else if (id === 'power') setPower(!S.power);
  else if (id === 'value' && !model.byId.mode) loadPreset(S.preset + 1);
}

// ---- computer keyboard
const CTRL = { Minus: 'octd', Equal: 'octu', Backquote: 'menu' };
const typing = e => !document.getElementById('design-menu').hidden || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
addEventListener('keydown', e => {
  if (typing(e)) return;
  const k = KMAP.get(e.code), b = CTRL[e.code];
  if (!k && !b) return;
  e.preventDefault(); if (e.repeat) return;
  if (k) press(e.code, k);
  else { const c = model.byId[b]; if (c) c.target = 1; btnDown(b); mark(); }
});
addEventListener('keyup', e => {
  const b = CTRL[e.code];
  if (KMAP.has(e.code)) noteOff(e.code);
  else if (b && model.byId[b]) { model.byId[b].target = 0; mark(); }
});
addEventListener('blur', () => { allOff(); });

// ---- audio / midi start on first gesture
const modalOpen = () => document.getElementById('modal').open;
const start = () => { synth.resume(); midi.init(); };
addEventListener('pointerdown', start, { once: true, capture: true });
addEventListener('keydown', start, { once: true, capture: true });

// ---- variants
function switchVariant(v) {
  if (!IDEAS.some(i => i.id === v) || v === S.variant) return;
  allOff(); ptrs.clear(); vis.clear(); hover(null);
  if (controls) controls.enabled = true;
  S.variant = v; persist();
  try { history.replaceState(null, '', '#idea' + v); } catch {}
  loadModel(v); resetView();
}
addEventListener('hashchange', () => {
  const v = ideaFromHash(location.hash);
  if (v) { switchVariant(v); ui.paintIdeas(); }
});
loadModel(S.variant);

// ---- ui
const ui = initUI({
  S, midi, persist, resetView, start, IDEAS, setView: name => placeCamera(name, true),
  setCase: c => { S.caseColor = c; model.setCaseColor(c); mark(); persist(); },
  setGrid: g => { S.grid = g; model.setGrid(g); mark(); persist(); },
  setMidi: () => { midi.inId = S.midiIn; midi.outId = S.midiOut; midi.channel = S.channel; lcdDirty = true; persist(); },
  setMode,
});
const lightEl = document.getElementById('light-range');
lightEl.value = S.light; setLight(S.light);
lightEl.addEventListener('input', () => { setLight(lightEl.value); persist(); });

// ---- loop
addEventListener('resize', resize);
placeCamera('top', false); resize();
let lastLcd = 0, hotWas = false;
document.fonts?.load('500 16px "Inter Tight"').then(() => { lcdDirty = true; }, () => {});
// NeoPixels: keyboard mode keeps the model's rainbow. Drum mode lights the
// selected piece's steps on the white keys, the playhead in white, and each
// piece's colour on its black key (brighter when selected, flashing on hits).
function drumLed(c) {
  if (!S.power) return { h: 0, s: 0, l: 0 };
  if (S.mode !== 'drum') return null;
  const i = +c.id.slice(1), now = synth.ctx?.currentTime ?? 0;
  if (c.sharp) {
    const pc = PIECES[i], flash = drums.hits[i] >= 0 ? Math.max(0, 1 - (now - drums.hits[i]) / 0.15) : 0;
    return { h: pc.hue, s: 1, l: (i === S.drum.sel ? 0.32 : 0.06) + flash * 0.3 };
  }
  const on = S.drum.pattern[S.drum.sel][i], head = drums.step(now) === i;
  if (head) return { h: 0, s: 0, l: on ? 0.75 : 0.35 };
  return on ? { h: PIECES[S.drum.sel].hue, s: 1, l: 0.3 } : { h: 0, s: 0, l: i % 4 ? 0.015 : 0.05 };
}
function frame(now) {
  requestAnimationFrame(frame);
  if (controls.update()) dirty = true;
  if (stepView(now)) { if (!viewAnim) controls.update(); dirty = true; }
  model.ledFn = drumLed;
  if (model.update()) dirty = true;
  const step = drums.step();
  const live = S.power && !!synth.ctx && (S.mode === 'key' ? S.page === 0 : drums.playing);
  const hot = Object.values(S.touched).some(t => now - t < 1300);
  if (lcdDirty || hot || hotWas || (live && now - lastLcd > 33)) {
    S.scope = S.mode === 'key' && S.page === 0 && synth.ctx ? synth.scope() : null;
    const audioNow = synth.ctx?.currentTime ?? 0;
    drawScreen(lcd, {
      ...S, presetName: PRESETS[S.preset].name, step, playing: drums.playing, rec: drums.rec,
      hits: drums.hits.map(t => (t < 0 ? -1e9 : now - (audioNow - t) * 1000)),
    }, now);
    lcd.flush(); lcdDirty = false; lastLcd = now; dirty = true;
  }
  hotWas = hot;
  if (dirty) { dirty = false; renderer.render(scene, camera); }
}
requestAnimationFrame(frame);
