import * as THREE from 'three';

export const BASE_NOTE = 59; // first key = B3 at octave 0
const NAT_OFF = [0, 1, 3, 5, 6, 8, 10, 12, 13, 15, 17, 18, 20, 22, 24, 25];
const SHARP_OFF = [2, 4, 7, 9, 11, 14, 16, 19, 21, 23];
const SHARP_BETWEEN = [[1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [8, 9], [9, 10], [11, 12], [12, 13], [13, 14]];
const PITCH = 19.05, PLATE_T = 3, BODY_H = 14.6;

// mm, x right, z toward the player. Idea 1 follows the PCB layout.
const L1 = {
  D: 80, natZ: 26.4, sharpZ: 7.6,
  joystick: { x: -146, z: -23, radius: 5.2 },
  lcd: { x: -28.7, z: -21.8, w: 110, h: 27.5, cols: 320, rows: 80 },
  tact: { rec: [-77.3, 7.6], play: [-0.9, 7.6], save: [56, 7.6], octd: [133.6, 7.6], octu: [145.6, 7.6] },
  round: { power: [-141.8, -28.2, 2.2, 2.4], menu: [-106.4, -21.8, 4.2, 3], value: [43.6, -22.4, 5.4, 3] },
  knobs: [['level', 'pot', -123.6, -24.5, 7, 12], ['mode', 'enc', 61.8, -17.3, 6, 11], ['set1', 'enc', 82.7, -17.3, 6, 11],
    ['set2', 'enc', 103.6, -17.3, 6, 11], ['set3', 'enc', 124.5, -17.3, 6, 11], ['set4', 'enc', 145.5, -17.3, 6, 11]],
  slots: [61.8, 82.7, 103.6, 124.5, 145.5].map(x => [x, -30]),
  frontTrapezoids: [-132, 132], // paired openings on the lower front corners
};
// Idea 2, from the 200 x 100 mm panel drawing (origin at the panel center).
// LCD: 1.9 inch IPS, 320 x 170, active area 42.6 x 22.6 mm in a 46 x 26 window.
// Keys: 8 x 16 mm stadiums on a 12 mm pitch, sharps at z 12.8, naturals at 31.8.
// Tacts: 16 stadiums, 8 x 4 mm, one per natural column: SHIFT (white), HOME, F1-F12, PLAY (white),
// REC (red); plus OCT+ / OCT- stacked left of the sharp row, labelled to their right.
// Knobs: six 14 mm knobs on a 24 mm pitch; the outer left one is volume (with mark).
const keyCol = i => (i - 7.5) * 12;
const F_KEYS = Array.from({ length: 12 }, (_, i) => 'f' + (i + 1));
const TACT_IDS = ['shift', 'home', ...F_KEYS, 'play', 'rec'];
const L2 = {
  W: 200, D: 100, caseR: 3, bodyH: BODY_H + 8.75, // case 26.25 mm tall (plate top to bottom)
  // Connectors, all on the back face (placement is provisional): 3.5 mm TRS
  // audio in / out, Grove PORT.A, USB-C (device) and USB-C (host). The power slide switch
  // stays on the left side toward the back. `at` runs along the face (world x
  // on the back); y is height.
  ports: {
    audioIn: { face: 'back', at: -70, y: -16 },
    audioOut: { face: 'back', at: -56, y: -16 },
    grove: { face: 'back', at: -6, y: -16 },
    usb: { face: 'back', at: 36, y: -16 },
    usbHost: { face: 'back', kind: 'usb', at: 52, y: -16 },
    power: { face: 'left', at: -36, y: -6.8 },
    // strap hole: an L-shaped tunnel through the back-right corner of the lower shell
    strapSide: { face: 'right', at: -44, y: -20 },
    strapBack: { face: 'back', at: 94, y: -20 },
  },
  // Sticker on the back of the upper shell naming each connector below it.
  backSticker: {
    y: -6.7, h: 5.6, x0: -80, x1: 62,
    items: [[-70, 'AUDIO', 'IN'], [-56, 'AUDIO', 'OUT'], [-6, 'PORT.A', 'GROVE', '#d0352a'], [36, 'USB-C', 'DEVICE'], [52, 'USB-C', 'HOST']],
  },
  pcbSeam: { at: 10.5, t: 1.6, pillars: [-62, 18, 74] }, // board edge 10.5 mm below the top
  pitch: 12, natZ: 31.8, sharpZ: 12.8,
  keyRound: true, keyWidth: 8, keyLen: 16,
  // NeoPixel windows, 6 x 2 mm with 0.8 mm corners, 1.5 mm from the key holes:
  // behind the sharps, in front of the naturals.
  ledZ: { sharp: 1.9, nat: 42.7 }, ledW: 6, ledD: 2, ledR: 0.8,
  knobPlain: true, // matte black, coarse knurl, no indicator mark unless the knob asks for one
  lcd: { x: -24, z: -33, w: 42.6, h: 22.6, win: [46, 26], cols: 320, rows: 170 },
  tact: {
    ...Object.fromEntries(TACT_IDS.map((id, i) => [id, [keyCol(i), -9.5]]).filter(([id]) => id)),
    // octave buttons straight below SHIFT, centred on the sharp row (z 12.8), 8 mm apart
    octu: [keyCol(0), 8.8], octd: [keyCol(0), 16.8],
  },
  tactW: 8, tactD: 4,
  tactColors: { shift: '#e9e7e1', play: '#e9e7e1', rec: '#d0352a' },
  knobLabels: { level: 'VOLUME', mode: 'TEMPO', set1: 'E1', set2: 'E2', set3: 'E3', set4: 'E4' },
  // Printed in black on the case below the tact (Montserrat 400).
  tactLabels: { shift: 'SHIFT', home: 'HOME', ...Object.fromEntries(F_KEYS.map(id => [id, id.toUpperCase()])), play: 'PLAY', rec: 'REC' },
  // labels printed to the right of a tact (left-aligned, on the tact's centre line)
  sideLabels: { octu: 'OCT+', octd: 'OCT-' },
  // Hover tooltips (desktop only): [title, detail].
  tips: {
    key: ['Key', 'Plastic top, velocity-sensitive membrane switch'],
    tact: ['Tact switch', ''],
    octd: ['OCT-', 'Tact switch · octave down'],
    octu: ['OCT+', 'Tact switch · octave up'],
    shift: ['SHIFT', 'Tact switch · modifier'],
    home: ['HOME', 'Tact switch · home page'],
    ...Object.fromEntries(['HOME', 'OSC', 'FILTER', 'ENV', 'LFO', 'FX'].map((p, i) => ['f' + (i + 1), ['F' + (i + 1), `Tact switch · ${p} page`]])),
    ...Object.fromEntries([7, 8, 9, 10, 11, 12].map(n => ['f' + n, ['F' + n, `Tact switch · preset ${n - 6}`]])),
    play: ['PLAY', 'Tact switch · start / stop the sequencer'],
    rec: ['REC', 'Tact switch · record drum hits'],
    level: ['Volume', 'Potentiometer'],
    mode: ['TEMPO', 'Rotary encoder · tempo'],
    set1: ['E1', 'Rotary encoder · page knob 1'],
    set2: ['E2', 'Rotary encoder · page knob 2'],
    set3: ['E3', 'Rotary encoder · page knob 3'],
    set4: ['E4', 'Rotary encoder · page knob 4'],
    usb: ['USB-C (device)', 'Power, data and USB MIDI'],
    usbHost: ['USB-C (host)', 'USB host for MIDI controllers and storage'],
    grove: ['PORT.A', 'Grove (HY2.0-4P) · I²C'],
    audioIn: ['AUDIO IN', '3.5 mm TRS jack (tentative)'],
    audioOut: ['AUDIO OUT', '3.5 mm TRS jack (tentative)'],
    power: ['POWER', 'Slide switch · on toward the back'],
    strap: ['Strap hole', 'Through the back-right corner'],
    lcd: ['Display', '1.9" IPS LCD, 320 × 170 (same as Cardputer Zero)'],
    led: ['NeoPixel', 'RGB LED · rainbow in keyboard mode, steps in drum mode'],
  },
  round: {},
  knobs: [['level', 'pot', -86, -34.5, 7, 12, true], ['mode', 'enc', -62, -34.5, 7, 11], ['set1', 'enc', 14, -34.5, 7, 11],
    ['set2', 'enc', 38, -34.5, 7, 11], ['set3', 'enc', 62, -34.5, 7, 11], ['set4', 'enc', 86, -34.5, 7, 11]],
  slots: [],
};
// Idea B: full-size 1U mechanical-style keycaps on 19.05 mm centers.
// The 16-key row needs 304.8 mm center-to-center envelope including the end caps,
// so the panel expands from 200 to 330 mm. The original 100 mm depth is retained.
// Scale horizontal control locations to retain the Idea A hierarchy; actual PCB
// routing, switch footprints and keycap clearances still require engineering.
const B_SCALE = 19.05 / 12;
const bx = x => x * B_SCALE;
const B_TACT_IDS = ['octd', 'octu', 'shift', 'home', ...F_KEYS, 'play', 'rec'];
const LB = {
  ...L2,
  W: 310, // 16 x 19.05 mm pitch; ~2.6 mm nominal end margin per side
  pitch: 19.05,
  natZ: 35.5, // longer white caps extend forward to fill the front margin
  naturalKeyLength: 23.8, // 1.25U depth (19.05 x 1.25), rounded to 23.8 mm
  underKeyLed: true,
  ledZ: null,
  keyRound: false,
  keyW: 1,
  keyR: 2.2,
  // Eighteen buttons share one row, evenly distributed across the panel.
  tact: Object.fromEntries(B_TACT_IDS.map((id, i) => [id, [(i - 8.5) * 17, -9.5]])),
  tactLabels: { octd: 'OCT-', octu: 'OCT+', ...L2.tactLabels },
  sideLabels: {},
  joystick: { x: -138, z: -34.5, radius: 5.2 },
  lcd: { ...L1.lcd, x: -16, z: -32 }, // wide 110 x 27.5 mm Idea 1 display
  knobs: [
    ['level', 'pot', -114, -34.5, 7, 12, true],
    ['mode', 'enc', -90, -34.5, 7, 11],
    ['set1', 'enc', 57, -34.5, 7, 11],
    ['set2', 'enc', 82, -34.5, 7, 11],
    ['set3', 'enc', 107, -34.5, 7, 11],
    ['set4', 'enc', 132, -34.5, 7, 11],
  ],
  ports: Object.fromEntries(Object.entries(L2.ports).map(([id, cfg]) => [id, { ...cfg, at: cfg.face === 'back' ? bx(cfg.at) : cfg.at }])),
  backSticker: { ...L2.backSticker, x0: bx(L2.backSticker.x0), x1: bx(L2.backSticker.x1), items: L2.backSticker.items.map(([x, ...rest]) => [bx(x), ...rest]) },
  pcbSeam: { ...L2.pcbSeam, pillars: L2.pcbSeam.pillars.map(bx) },
  tips: { ...L2.tips, key: ['Key', '1U mechanical-style keycap · 19.05 mm pitch · switch TBD'], joystick: ['Joystick', 'Control mapping TBD'] },
};
// Add a design here. `id` is the #idea<id> hash and the variant key.
export const IDEAS = [
  { id: 'A', label: 'Idea A', layout: L2 },
  { id: 'B', label: 'Idea B', layout: LB },
  { id: '1', label: 'Idea 1', layout: L1 },
];
const RAD = Math.PI / 180;

const rr = (p, x, y, w, h, r) => {
  const x0 = x - w / 2, y0 = y - h / 2;
  p.moveTo(x0 + r, y0); p.lineTo(x0 + w - r, y0); p.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x0 + w, y0 + h - r); p.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false);
  p.lineTo(x0 + r, y0 + h); p.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x0, y0 + r); p.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return p;
};
// Stadium (two half circles joined by straight sides) with no zero-length
// segments; rr() with r = w/2 leaves duplicate points that break the bevel.
const stadium = (p, x, y, w, h) => {
  const r = Math.min(w, h) / 2;
  if (h >= w) { p.absarc(x, y - h / 2 + r, r, Math.PI, Math.PI * 2, false); p.absarc(x, y + h / 2 - r, r, 0, Math.PI, false); }
  else { p.absarc(x + w / 2 - r, y, r, -Math.PI / 2, Math.PI / 2, false); p.absarc(x - w / 2 + r, y, r, Math.PI / 2, Math.PI * 1.5, false); }
  p.closePath();
  return p;
};
const holeRect = (x, z, w, d, r) => rr(new THREE.Path(), x, -z, w, d, r);
const holeStadium = (x, z, w, d) => stadium(new THREE.Path(), x, -z, w, d);
const holeCircle = (x, z, r) => { const p = new THREE.Path(); p.absarc(x, -z, r, 0, Math.PI * 2, true); return p; };

function extrude(shape, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 24,
  });
  g.rotateX(-Math.PI / 2);
  return g; // spans y: -bevel .. depth+bevel
}

function lathe(r, h, round = 0.7) {
  const pts = [[0, 0], [r, 0], [r, h - round], [r - round * 0.35, h - round * 0.3], [r - round, h], [0, h]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 56);
}

// grooved: narrow rounded grooves between broad lands (the plain knob's knurl),
// enough segments that each ridge stays round instead of a spike.
function knobGeometry(r, h, ridges = 36, amp = 0.02, grooved = false) {
  const g = new THREE.CylinderGeometry(r, r * 1.02, h, grooved ? ridges * 12 : 120, 1, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), rad = Math.hypot(x, z);
    if (rad > r * 0.9) {
      const a = Math.atan2(z, x) * ridges;
      const k = grooved ? 1 - amp * ((1 - Math.cos(a)) / 2) ** 4 : 1 + amp * Math.cos(a);
      p.setX(i, x * k); p.setZ(i, z * k);
    }
  }
  g.computeVertexNormals();
  g.translate(0, h / 2, 0);
  return g;
}

export function buildModel(variant = 'A') {
  const idea = IDEAS.find(i => i.id === variant) || IDEAS.find(i => i.id === 'A') || IDEAS[0];
  const V = idea.layout, D = V.D, W = V.W ?? 314, LCD = V.lcd;
  const root = new THREE.Group();
  const pickables = [], controls = [], infos = []; // infos: tooltip-only meshes
  const byOff = new Map(), byId = {};

  const caseMat = new THREE.MeshPhysicalMaterial({ color: '#8d8f94', roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.8 });
  const blackPlastic = new THREE.MeshPhysicalMaterial({ color: '#242428', roughness: 0.45, clearcoat: 0.3 });
  const knobMat = new THREE.MeshPhysicalMaterial({ color: '#1d1e21', metalness: 0.65, roughness: 0.32, clearcoat: 0.2 });
  const plainKnobMat = new THREE.MeshPhysicalMaterial({ color: '#141416', metalness: 0, roughness: 0.62, clearcoat: 0.05 });
  const ivory = '#ebe8df', charcoal = '#38393d';

  const add = (geo, mat, x, y, z, parent = root) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };

  // plate holes
  const holes = [];
  const CASE_R = V.caseR ?? 6, bodyH = V.bodyH ?? BODY_H, drop = bodyH - BODY_H;
  // The plate (0.4 mm bevel) and body (0.6 mm bevel) both finish at W x D so the
  // plate sits flush on the body instead of overhanging it.
  const plateShape = rr(new THREE.Shape(), 0, 0, W - 0.8, D - 0.8, CASE_R - 0.4);
  // Idea 1 and 2 leave keyW/keyR unset: profile 17.4 mm square, corner 2.2.
  // The bevel adds 0.8 mm per side, so keyW scales that finished width.
  const BEVEL = 0.8, keyScale = V.keyW ?? 1, capD = 17.4, capR = V.keyR ?? 2.2;
  const capW = (capD + 2 * BEVEL) * keyScale - 2 * BEVEL;
  const naturalCapD = V.naturalKeyLength ? V.naturalKeyLength - 2 * BEVEL : capD;
  const holeW = 14.2 * keyScale, holeD = 14.2, wellW = 13.6 * keyScale, wellD = 13.6;
  // Round caps use a softer 1.2 mm edge; the finished diameter stays at 19 * keyW.
  // They are half the square cap height (3.3 mm) and sit 1 mm into a slightly
  // larger plate hole, so they read as set into the case rather than floating.
  const ROUND_BEVEL = 1.2, roundR = (V.keyWidth ?? (capD + 2 * BEVEL) * keyScale) / 2, ROUND_H = 3.3, ROUND_SINK = 1;
  const roundL = Math.max(V.keyLen ?? 0, roundR * 2); // finished length; equal to the width gives a circle
  const capGeo = V.keyRound
    ? (() => { const r = roundR - ROUND_BEVEL, sh = stadium(new THREE.Shape(), 0, 0, r * 2, roundL - ROUND_BEVEL * 2); const g = extrude(sh, ROUND_H - 2 * ROUND_BEVEL, ROUND_BEVEL); g.translate(0, ROUND_BEVEL, 0); return g; })()
    : (() => { const g = extrude(rr(new THREE.Shape(), 0, 0, capW, capD, capR), 5, 0.8); g.translate(0, 0.8, 0); return g; })();
  // tactW/tactD give the finished cap size (0.5 mm bevel each side); a cap
  // whose depth is set becomes a stadium.
  const TACT_W = V.tactW ? V.tactW - 1 : 9.6, TACT_D = V.tactD ? V.tactD - 1 : 3.6;
  const tactShape = V.tactD ? stadium(new THREE.Shape(), 0, 0, TACT_W, TACT_D) : rr(new THREE.Shape(), 0, 0, TACT_W, TACT_D, 1.6);
  const tactGeo = (() => { const g = extrude(tactShape, 1.8, 0.5); g.translate(0, 0.5, 0); return g; })();

  const register = (ctl, mesh) => {
    ctl.mesh = mesh; ctl.press = 0; ctl.target = 0; ctl.hover = false; ctl.baseY = mesh.position.y;
    mesh.userData.ctl = ctl; pickables.push(mesh); controls.push(ctl); byId[ctl.id] = ctl;
  };

  // keys
  const natX = i => (i - 7.5) * (V.pitch ?? PITCH), NAT_Z = V.natZ, SHARP_Z = V.sharpZ;
  const LED_W = V.ledW ?? 7, LED_D = V.ledD ?? 3.2, LED_R = V.ledR ?? 0.5;
  // NeoPixels idle as a dim rainbow drifting across the keyboard; a held key
  // fades its LED up (fast attack, slow release).
  const LED_STILL = matchMedia('(prefers-reduced-motion: reduce)').matches, LED_WHITE = new THREE.Color('#ffffff');
  const leds = [];
  const keyMat = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, clearcoat: 0.15, emissive: '#ff9a4a', emissiveIntensity: 0 });
  const makeKey = (x, z, sharp, idx, off) => {
    const keyDepth = !sharp && V.naturalKeyLength ? naturalCapD : capD;
    const keyHoleD = !sharp && V.naturalKeyLength ? holeD + (naturalCapD - capD) : holeD;
    const keyWellD = !sharp && V.naturalKeyLength ? wellD + (naturalCapD - capD) : wellD;
    if (V.keyRound) {
      // The well is wider than the hole so nothing shows through the gap.
      holes.push(holeStadium(x, z, roundR * 2 + 0.8, roundL + 0.8));
      add(new THREE.BoxGeometry(roundR * 2 + 2, 3, roundL + 2), darkMat, x, -3.8, z);
    } else {
      holes.push(holeRect(x, z, holeW, keyHoleD, 0.6));
      add(new THREE.BoxGeometry(wellW, 3, keyWellD), darkMat, x, -2.4, z);
    }
    const keyGeometry = !sharp && V.naturalKeyLength ? (() => { const g = extrude(rr(new THREE.Shape(), 0, 0, capW, keyDepth, capR), 5, 0.8); g.translate(0, 0.8, 0); return g; })() : capGeo;
    const m = add(keyGeometry, keyMat(sharp ? charcoal : ivory), x, V.keyRound ? -ROUND_SINK : 1.6, z);
    if (V.underKeyLed) { m.material.transparent = true; m.material.opacity = sharp ? 0.65 : 0.72; m.material.depthWrite = false; }
    const ctl = { type: 'key', id: (sharp ? 's' : 'n') + idx, sharp, off, depth: V.keyRound ? 1.2 : 3 };
    register(ctl, m); byOff.set(off, ctl);
    if (V.underKeyLed) {
      // RGB source under a translucent keycap / transparent switch housing.
      // A clear switch alone will not illuminate an opaque cap.
      const led = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000000', toneMapped: false, side: THREE.DoubleSide }));
      led.position.set(x, -1.25, z); root.add(led);
      ctl.led = led.material; ctl.ledHue = (x + W / 2) / W * 0.85; ctl.glow = 0; leds.push(ctl);
    } else if (V.keyLed || V.ledZ) {
      // NeoPixel window: a slot in the plate 3.6 mm behind the key, lit from below.
      const lz = V.ledZ ? V.ledZ[sharp ? 'sharp' : 'nat'] : z - roundL / 2 - 0.4 - 3.6;
      holes.push(holeRect(x, lz, LED_W, LED_D, LED_R));
      add(new THREE.BoxGeometry(LED_W + 1.5, 0.6, LED_D + 1.5), darkMat, x, -3.2, lz);
      const led = new THREE.Mesh(new THREE.PlaneGeometry(LED_W, LED_D).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000000', toneMapped: false }));
      led.position.set(x, -0.9, lz); root.add(led);
      led.userData.tip = V.tips?.led; infos.push(led);
      ctl.led = led.material; ctl.ledHue = (x + W / 2) / W * 0.85; ctl.glow = 0; leds.push(ctl);
    }
  };
  NAT_OFF.forEach((off, i) => makeKey(natX(i), NAT_Z, false, i, off));
  SHARP_BETWEEN.forEach(([a, b], i) => makeKey((natX(a) + natX(b)) / 2, SHARP_Z, true, i, SHARP_OFF[i]));

  // slot buttons
  const makeTact = (id, x, z) => {
    if (V.tactD) {
      holes.push(holeStadium(x, z, TACT_W + 2, TACT_D + 2));
      add(new THREE.BoxGeometry(TACT_W + 3, 3, TACT_D + 3), darkMat, x, -3.4, z);
    } else {
      holes.push(holeRect(x, z, TACT_W + 2, 5.2, 2.4));
      add(new THREE.BoxGeometry(TACT_W + 1.4, 3, 4.6), darkMat, x, -2.4, z);
    }
    // stadium caps sit 0.8 mm down in their hole instead of floating above the plate
    const m = add(tactGeo, new THREE.MeshPhysicalMaterial({ color: V.tactColors?.[id] ?? '#2a2b2f', roughness: 0.5, emissive: '#ff9a4a', emissiveIntensity: 0 }), x, V.tactD ? -0.8 : 0.2, z);
    register({ type: 'btn', id, depth: 1.2 }, m);
  };
  Object.entries(V.tact).forEach(([id, [x, z]]) => makeTact(id, x, z));

  // Printed labels (Montserrat 400, black): one transparent strip across the
  // plate per row. Items are [x, text]; z is the centre of the text line.
  // Drawn with the fallback font first and again when Montserrat loads.
  let labelsDirty = false;
  const labelStrip = (items, z, align = 'center') => {
    const PX = 20, stripD = 4;
    const cv = document.createElement('canvas'); cv.width = W * PX; cv.height = stripD * PX;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const draw = () => {
      const g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = '#000';
      g.font = `400 ${2.4 * PX}px Montserrat, sans-serif`;
      for (const [x, text] of items) g.fillText(text, (x + W / 2) * PX, cv.height / 2);
      tex.needsUpdate = true;
    };
    draw();
    document.fonts?.load(`400 ${2.4 * PX}px Montserrat`).then(() => { draw(); labelsDirty = true; }, () => {});
    const label = new THREE.Mesh(new THREE.PlaneGeometry(W, stripD).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    label.position.set(0, 0.02, z); label.receiveShadow = true; root.add(label);
  };
  // tact labels sit 5 mm in front of the tact row (toward the player)
  if (V.tactLabels) labelStrip(Object.entries(V.tactLabels).map(([id, t]) => [V.tact[id][0], t]), V.tact[Object.keys(V.tactLabels)[0]][1] + 5);
  for (const [id, t] of Object.entries(V.sideLabels || {})) labelStrip([[V.tact[id][0] + 5.6, t]], V.tact[id][1], 'left');
  // knob labels sit just in front of the knob skirts
  if (V.knobLabels) {
    const kz = V.knobs[0][3];
    labelStrip(V.knobs.filter(k => V.knobLabels[k[0]]).map(k => [k[2], V.knobLabels[k[0]]]), kz + 11.5);
  }

  // Idea 1 prototype-inspired joystick. Mechanical representation only:
  // MIDI pitch/mod mapping is intentionally left unassigned.
  if (V.joystick) {
    const { x, z, radius } = V.joystick;
    holes.push(holeCircle(x, z, radius + 1.2));
    add(new THREE.CylinderGeometry(radius + 1.3, radius + 1.3, 1.2, 40), darkMat, x, -0.9, z);
    add(new THREE.CylinderGeometry(2.0, 2.0, 10, 24), new THREE.MeshStandardMaterial({ color: '#188c80', roughness: 0.48 }), x, 4.5, z);
    const stick = add(new THREE.CylinderGeometry(2.6, 2.0, 2.0, 24), new THREE.MeshStandardMaterial({ color: '#b4e1d8', roughness: 0.48 }), x, 10.2, z);
    stick.userData.tip = ['Joystick', 'Prototype-inspired control · mapping TBD']; infos.push(stick);
  }

  // round buttons
  const makeRound = (id, x, z, r, h = 3) => {
    holes.push(holeCircle(x, z, r + 0.55));
    add(new THREE.CylinderGeometry(r + 0.3, r + 0.3, 3, 32), darkMat, x, -2.4, z);
    const mat = new THREE.MeshPhysicalMaterial({ color: '#2a2b2f', roughness: 0.45, clearcoat: 0.25, emissive: '#ff9a4a', emissiveIntensity: 0 });
    const m = add(lathe(r, h), mat, x, 0.3, z);
    register({ type: 'btn', id, depth: 1.4 }, m);
  };
  Object.entries(V.round).forEach(([id, [x, z, r, h]]) => makeRound(id, x, z, r, h));

  // knobs
  const makeKnob = (id, type, x, z, r, h, mark = false) => {
    holes.push(holeCircle(x, z, r * 0.62));
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    const km = (V.knobPlain ? plainKnobMat : knobMat).clone();
    add(new THREE.CylinderGeometry(r * 1.2, r * 1.25, 1.2, 64).translate(0, 0.6, 0), km, 0, 0, 0, g);
    const hit = add(V.knobPlain ? knobGeometry(r, h, 30, 0.06, true) : knobGeometry(r, h), km, 0, 1.2, 0, g);
    const ind = V.knobPlain && !mark ? null
      : add(new THREE.BoxGeometry(0.9, 0.3, r * 0.62), new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.5 }), 0, 1.2 + h + 0.05, -r * 0.45, g);
    if (ind) ind.castShadow = false;
    const ctl = { type, id, ang: 0, angTarget: 0, group: g, hitMat: km };
    hit.userData.ctl = ctl; pickables.push(hit); controls.push(ctl); byId[id] = ctl;
    [...g.children].forEach(c => { if (c !== ind && c !== hit) { c.userData.ctl = ctl; pickables.push(c); } });
    if (ind) { ind.userData.ctl = ctl; pickables.push(ind); }
    ctl.hover = false; ctl.press = 0; ctl.target = 0; ctl.mesh = hit; ctl.baseY = 1.2;
  };
  V.knobs.forEach(([id, type, x, z, r, h, mark]) => makeKnob(id, type, x, z, r, h, mark));
  const T = V.tips || {};
  controls.forEach(c => { c.tip = T[c.id] ?? T[c.type === 'key' ? 'key' : c.type === 'btn' ? 'tact' : c.type]; });

  // decorative slots (idea 1 only)
  V.slots.forEach(([x, z]) => {
    holes.push(holeRect(x, z, 12, 3.6, 1.6));
    add(new THREE.BoxGeometry(11.4, 0.4, 3), darkMat, x, -1.6, z);
  });

  // Two trapezoidal recesses on the front lower shell, as in the prototype.
  // Rendered as dark openings with light rims; true through-holes require shell CAD.
  if (V.frontTrapezoids) {
    const faceZ = D / 2 + 0.32;
    for (const x of V.frontTrapezoids) {
      const shape = new THREE.Shape();
      shape.moveTo(-14, 5); shape.lineTo(14, 5);
      shape.lineTo(10, -5); shape.lineTo(-10, -5); shape.closePath();
      const rim = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: '#d3d5d1', side: THREE.DoubleSide }));
      rim.position.set(x, -12.5, faceZ); root.add(rim);
      const inner = new THREE.Mesh(new THREE.ShapeGeometry(shape), darkMat);
      inner.scale.set(0.82, 0.72, 1); inner.position.set(x, -12.5, faceZ + 0.04); root.add(inner);
      inner.userData.tip = ['Front opening', 'Prototype-inspired trapezoidal opening · geometry TBD']; infos.push(inner);
    }
  }

  // LCD
  holes.push(holeRect(LCD.x, LCD.z, LCD.win?.[0] ?? LCD.w + 4, LCD.win?.[1] ?? LCD.h + 3.5, 2));
  add(new THREE.BoxGeometry(LCD.w + 3, 0.2, LCD.h + 2.5), darkMat, LCD.x, -1.6, LCD.z);
  const lcdMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const lcdMesh = new THREE.Mesh(new THREE.PlaneGeometry(LCD.w, LCD.h).rotateX(-Math.PI / 2), lcdMat);
  lcdMesh.position.set(LCD.x, -1.4, LCD.z); root.add(lcdMesh);
  lcdMesh.userData.tip = V.tips?.lcd; infos.push(lcdMesh);
  const gridCv = document.createElement('canvas'); gridCv.width = gridCv.height = 4;
  const gx = gridCv.getContext('2d'); gx.fillStyle = 'rgba(0,0,0,0.5)'; gx.fillRect(3, 0, 1, 4); gx.fillRect(0, 3, 4, 1);
  const gridTex = new THREE.CanvasTexture(gridCv);
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping; gridTex.repeat.set(LCD.cols, LCD.rows);
  const gridMesh = new THREE.Mesh(new THREE.PlaneGeometry(LCD.w, LCD.h).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: gridTex, transparent: true, toneMapped: false, depthWrite: false }));
  gridMesh.position.set(LCD.x, -1.35, LCD.z); root.add(gridMesh);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(LCD.w + 3, LCD.h + 2.5).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.07, roughness: 0.04, metalness: 0, depthWrite: false }));
  glass.position.set(LCD.x, -0.6, LCD.z); root.add(glass);

  // plate + body
  plateShape.holes = holes;
  const plateGeo = extrude(plateShape, PLATE_T - 0.8, 0.4); plateGeo.translate(0, -PLATE_T + 0.4, 0);
  const plate = add(plateGeo, caseMat, 0, 0, 0);
  const bodyShape = rr(new THREE.Shape(), 0, 0, W - 1.2, D - 1.2, CASE_R - 0.6);
  const bodyTopY = -PLATE_T + 0.1, bodyBotY = bodyTopY - bodyH; // finished extents
  const shell = (top, bot, mat = caseMat) => { const g = extrude(bodyShape, top - bot - 1.2, 0.6); g.translate(0, bot + 0.6, 0); return add(g, mat, 0, 0, 0); };
  if (V.pcbSeam) {
    // Upper shell / PCB / lower shell sandwich. The board edge shows between the
    // shells, inset 0.3 mm, broken by short case pillars where the shells meet.
    const { at, t = 1.6, pillars = [] } = V.pcbSeam;
    const pcbTop = -at, pcbBot = pcbTop - t;
    // The lower enclosure stays charcoal whatever case colour is picked (two-tone, as on Cardputer).
    const lowerMat = new THREE.MeshPhysicalMaterial({ color: '#3a3b3f', roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.45 });
    shell(bodyTopY, pcbTop); shell(pcbBot, bodyBotY, lowerMat);
    const pcbGeo = extrude(rr(new THREE.Shape(), 0, 0, W - 0.6, D - 0.6, CASE_R - 0.3), t, 0); pcbGeo.translate(0, pcbBot, 0);
    add(pcbGeo, new THREE.MeshPhysicalMaterial({ color: '#8f9c8c', roughness: 0.55, clearcoat: 0.3 }), 0, 0, 0);
    const pillarGeo = new THREE.BoxGeometry(10, t + 0.2, 2);
    pillars.forEach(x => [-1, 1].forEach(sz => add(pillarGeo, caseMat, x, pcbBot + t / 2, sz * (D / 2 - 1))));
  } else shell(bodyTopY, bodyBotY);
  const footGeo = extrude(rr(new THREE.Shape(), 0, 0, 34, 20, 4), 2.6, 0.5);
  [-1, 1].forEach(s => add(footGeo, blackPlastic, s * (W / 2 - 29), -20.5 - drop, D / 2 - 13));
  // Side and back connectors. Each sits in a group whose local +z is the face's
  // outward normal; the openings are drawn as thin layers on the face.
  let powerKnob = null;
  if (V.ports) {
    const FACE = { back: [Math.PI, (a, y) => [a, y, -D / 2]], left: [-Math.PI / 2, (a, y) => [-W / 2, y, a]], right: [Math.PI / 2, (a, y) => [W / 2, y, a]] };
    const flat = (shape, mat, z, parent) => { const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), mat); m.position.z = z; parent.add(m); return m; };
    const blackM = new THREE.MeshStandardMaterial({ color: '#08080a', roughness: 0.9 });
    const metalM = new THREE.MeshStandardMaterial({ color: '#b9bcc2', metalness: 0.9, roughness: 0.3 });
    const whiteM = new THREE.MeshStandardMaterial({ color: '#efede6', roughness: 0.6 });
    const circle = r => { const c = new THREE.Shape(); c.absarc(0, 0, r, 0, Math.PI * 2, false); return c; };
    for (const [id, cfg] of Object.entries(V.ports)) {
      const kind = cfg.kind ?? id, [rot, at] = FACE[cfg.face], g = new THREE.Group();
      g.position.set(...at(cfg.at, cfg.y)); g.rotation.y = rot; root.add(g);
      const parts = [];
      if (kind === 'usb') {
        parts.push(flat(stadium(new THREE.Shape(), 0, 0, 9.2, 3.6), blackM, 0.03, g));
        parts.push(flat(stadium(new THREE.Shape(), 0, 0, 8.4, 2.6), metalM, 0.05, g));
        parts.push(flat(stadium(new THREE.Shape(), 0, 0, 7.6, 1.9), blackM, 0.07, g));
        parts.push(flat(rr(new THREE.Shape(), 0, 0, 5.6, 0.7, 0.3), metalM, 0.09, g));
      } else if (kind === 'grove') {
        // HY2.0-4P housing in black: latch window on top, keying notches at the
        // lower corners, four pins at 2.0 mm pitch inside the cavity.
        const housingM = new THREE.MeshPhysicalMaterial({ color: '#1d1e21', roughness: 0.55, clearcoat: 0.2 });
        const pinM = new THREE.MeshStandardMaterial({ color: '#d6b25a', metalness: 0.9, roughness: 0.3 });
        parts.push(flat(rr(new THREE.Shape(), 0, 0, 10.8, 6.2, 0.6), blackM, 0.02, g));
        const frame = rr(new THREE.Shape(), 0, 0, 9.9, 5.1, 0.4);
        frame.holes.push(rr(new THREE.Path(), 0, -0.35, 8.0, 3.4, 0.3));                          // cavity
        const body = new THREE.Mesh(new THREE.ExtrudeGeometry(frame, { depth: 1.2, bevelEnabled: false, curveSegments: 8 }), housingM);
        body.position.z = -1.0; g.add(body); parts.push(body);
        parts.push(flat(rr(new THREE.Shape(), 0, -0.35, 8.0, 3.4, 0.3), blackM, -0.9, g));       // cavity floor
        parts.push(flat(rr(new THREE.Shape(), 0, 1.95, 3.6, 0.8, 0.2), blackM, 0.21, g));        // latch window
        [-1, 1].forEach(sx => parts.push(flat(rr(new THREE.Shape(), sx * 4.45, -2.0, 0.9, 1.1, 0.15), blackM, 0.21, g))); // keying notches
        for (let i = 0; i < 4; i++) {
          const pin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.9), pinM);
          pin.position.set((i - 1.5) * 2.0, -0.35, -0.45); g.add(pin); parts.push(pin);
        }
      } else if (kind === 'audioIn' || kind === 'audioOut') {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.5, 40).rotateX(Math.PI / 2), metalM);
        ring.position.z = 0.25; g.add(ring); parts.push(ring);
        parts.push(flat(circle(1.8), blackM, 0.52, g));
      } else if (id.startsWith('strap')) {
        parts.push(flat(stadium(new THREE.Shape(), 0, 0, 4.4, 2.4), blackM, 0.03, g));
      } else if (id === 'power') {
        parts.push(flat(rr(new THREE.Shape(), 0, 0, 8.4, 3.4, 1), blackM, 0.03, g));
        const knob = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 1.8), new THREE.MeshPhysicalMaterial({ color: '#d0352a', roughness: 0.45, clearcoat: 0.3, emissive: '#ff9a4a', emissiveIntensity: 0 }));
        knob.position.z = 0.9; g.add(knob); parts.push(knob);
        powerKnob = knob;
        // Clickable: toggles power. The knob slides along the face instead of being pressed.
        const ctl = { type: 'btn', id: 'power', depth: 0, tip: V.tips?.power };
        register(ctl, knob);
      }
      parts.forEach(m => { m.castShadow = false; m.receiveShadow = true; if (!m.userData.ctl) { m.userData.tip = V.tips?.[id.startsWith('strap') ? 'strap' : id]; infos.push(m); } });
    }
  }
  // Peripheral sticker on the back of the upper shell: one label above each
  // connector. Items are [world x, line 1, line 2, chip colour].
  if (V.backSticker) {
    const { y, h, x0, x1, items } = V.backSticker, w = x1 - x0, PX = 24, T = 0.15;
    const g = new THREE.Group(); g.position.set(0, y, -D / 2); g.rotation.y = Math.PI; root.add(g); // local x = -world x
    const cx = -(x0 + x1) / 2;
    const sheet = new THREE.Mesh(new THREE.ExtrudeGeometry(rr(new THREE.Shape(), cx, 0, w, h, 1), { depth: T, bevelEnabled: false, curveSegments: 12 }),
      new THREE.MeshPhysicalMaterial({ color: '#f3f2ed', roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 }));
    sheet.receiveShadow = true; g.add(sheet);
    const cv = document.createElement('canvas'); cv.width = w * PX; cv.height = h * PX;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const draw = () => {
      const c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height); c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const [x, l1, l2, chip] of items) {
        const u = (-x - (cx - w / 2)) * PX; // canvas x for world x (the face is seen from behind)
        c.font = `600 ${1.7 * PX}px Montserrat, sans-serif`;
        const y1 = (l2 ? h / 2 - 1.1 : h / 2) * PX;
        if (chip) {
          const tw = c.measureText(l1).width + 1.2 * PX;
          c.fillStyle = chip; c.beginPath(); c.roundRect(u - tw / 2, y1 - 1.25 * PX, tw, 2.5 * PX, 0.5 * PX); c.fill();
          c.fillStyle = '#fff';
        } else c.fillStyle = '#000';
        c.fillText(l1, u, y1);
        if (l2) { c.fillStyle = '#555'; c.font = `400 ${1.3 * PX}px Montserrat, sans-serif`; c.fillText(l2, u, (h / 2 + 1.25) * PX); }
      }
      tex.needsUpdate = true;
    };
    draw();
    document.fonts?.load(`600 ${1.7 * PX}px Montserrat`).then(() => { draw(); labelsDirty = true; }, () => {});
    const print = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5, depthWrite: false }));
    print.position.set(cx, 0, T + 0.01); g.add(print);
  }
  // ON is toward the back of the device.
  const setPower = on => { if (powerKnob) powerKnob.position.x = on ? -2.2 : 2.2; }; // local -x is toward the back on the left face
  setPower(true);
  const floorY = -21.0 - drop;

  const setCaseColor = c => caseMat.color.set(c);
  const setGrid = on => { gridMesh.visible = on; };

  return {
    root, pickables, infos, controls, byId, setPower, byOff, lcdMat, floorY, setCaseColor, setGrid, depth: D, width: W, lcdRes: [LCD.cols, LCD.rows],
    dispose() {
      root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => { m.map?.dispose?.(); m.dispose(); }); } });
    },
    setHover(ctl, on) {
      if (!ctl || ctl.hover === on) return;
      ctl.hover = on; ctl.hoverDirty = true;
    },
    update() {
      let busy = labelsDirty; labelsDirty = false;
      for (const c of controls) {
        const d = c.target - c.press;
        if (Math.abs(d) > 0.003) { c.press += d * 0.5; busy = true; } else c.press = c.target;
        if (c.type === 'enc' || c.type === 'pot') {
          const da = c.angTarget - c.ang;
          if (Math.abs(da) > 0.05) { c.ang += da * 0.45; busy = true; } else c.ang = c.angTarget;
          c.group.rotation.y = -c.ang * RAD;
          if (c.hoverDirty) { c.hitMat.emissive.set(c.hover ? '#ff9a4a' : '#000000'); c.hitMat.emissiveIntensity = c.hover ? 0.18 : 0; c.hoverDirty = false; busy = true; }
        } else {
          c.mesh.position.y = c.baseY - c.depth * c.press;
          const mat = c.mesh.material;
          const want = c.hover ? 0.22 : 0;
          if (Math.abs(mat.emissiveIntensity - want) > 0.01) { mat.emissiveIntensity += (want - mat.emissiveIntensity) * 0.4; busy = true; }
        }
      }
      if (leds.length) {
        const t = LED_STILL ? 0 : performance.now() / 1000;
        // ledFn (set by the app) may override the idle colour per key: { h, s, l }.
        for (const c of leds) {
          c.glow += (c.target - c.glow) * (c.target > c.glow ? 0.25 : 0.05);
          const o = this.ledFn?.(c);
          const hue = o ? o.h : (c.ledHue + t * 0.06) % 1, sat = o ? o.s : 1, lit = o ? o.l : 0.17;
          c.led.color.setHSL(hue, sat, Math.min(0.9, lit + 0.42 * c.glow), THREE.SRGBColorSpace).lerp(LED_WHITE, 0.25 * c.glow);
        }
        busy ||= !LED_STILL || !!this.ledFn || leds.some(c => Math.abs(c.target - c.glow) > 0.002);
      }
      return busy;
    },
  };
}
