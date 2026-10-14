import * as THREE from 'three';

export const BASE_NOTE = 59; // first key = B3 at octave 0
const NAT_OFF = [0, 1, 3, 5, 6, 8, 10, 12, 13, 15, 17, 18, 20, 22, 24, 25];
const SHARP_OFF = [2, 4, 7, 9, 11, 14, 16, 19, 21, 23];
const SHARP_BETWEEN = [[1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [8, 9], [9, 10], [11, 12], [12, 13], [13, 14]];
const PITCH = 19.05, NAT_Z = 26.4, SHARP_Z = 7.6;
const W = 314, D = 80, PLATE_T = 3, BODY_H = 14.6;
const LCD = { x: -28.7, z: -21.8, w: 110, h: 27.5 };

// positions in mm from the PCB layout: x right, z toward the player
const TACT = { rec: -77.3, play: -0.9, save: 56, octd: 133.6, octu: 145.6 };
const ENC = { mode: 61.8, set1: 82.7, set2: 103.6, set3: 124.5, set4: 145.5 };
const RAD = Math.PI / 180;

const rr = (p, x, y, w, h, r) => {
  const x0 = x - w / 2, y0 = y - h / 2;
  p.moveTo(x0 + r, y0); p.lineTo(x0 + w - r, y0); p.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x0 + w, y0 + h - r); p.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false);
  p.lineTo(x0 + r, y0 + h); p.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x0, y0 + r); p.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return p;
};
const holeRect = (x, z, w, d, r) => rr(new THREE.Path(), x, -z, w, d, r);
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

function knobGeometry(r, h) {
  const g = new THREE.CylinderGeometry(r, r * 1.02, h, 120, 1, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), rad = Math.hypot(x, z);
    if (rad > r * 0.9) {
      const k = 1 + 0.02 * Math.cos(Math.atan2(z, x) * 36);
      p.setX(i, x * k); p.setZ(i, z * k);
    }
  }
  g.computeVertexNormals();
  g.translate(0, h / 2, 0);
  return g;
}

export function buildModel() {
  const root = new THREE.Group();
  const pickables = [], controls = [];
  const byOff = new Map(), byId = {};

  const caseMat = new THREE.MeshPhysicalMaterial({ color: '#8d8f94', roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.8 });
  const blackPlastic = new THREE.MeshPhysicalMaterial({ color: '#242428', roughness: 0.45, clearcoat: 0.3 });
  const knobMat = new THREE.MeshPhysicalMaterial({ color: '#1d1e21', metalness: 0.65, roughness: 0.32, clearcoat: 0.2 });
  const ivory = '#ebe8df', charcoal = '#38393d';

  const add = (geo, mat, x, y, z, parent = root) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  };

  // plate holes
  const holes = [];
  const plateShape = rr(new THREE.Shape(), 0, 0, W, D, 6);
  const capGeo = (() => { const g = extrude(rr(new THREE.Shape(), 0, 0, 17.4, 17.4, 2.2), 5, 0.8); g.translate(0, 0.8, 0); return g; })();
  const tactGeo = (() => { const g = extrude(rr(new THREE.Shape(), 0, 0, 9.6, 3.6, 1.6), 1.8, 0.5); g.translate(0, 0.5, 0); return g; })();

  const register = (ctl, mesh) => {
    ctl.mesh = mesh; ctl.press = 0; ctl.target = 0; ctl.hover = false; ctl.baseY = mesh.position.y;
    mesh.userData.ctl = ctl; pickables.push(mesh); controls.push(ctl); byId[ctl.id] = ctl;
  };

  // keys
  const natX = i => (i - 7.5) * PITCH;
  const keyMat = c => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, clearcoat: 0.15, emissive: '#ff9a4a', emissiveIntensity: 0 });
  const makeKey = (x, z, sharp, idx, off) => {
    holes.push(holeRect(x, z, 14.2, 14.2, 0.6));
    add(new THREE.BoxGeometry(13.6, 3, 13.6), darkMat, x, -2.4, z);
    const m = add(capGeo, keyMat(sharp ? charcoal : ivory), x, 1.6, z);
    const ctl = { type: 'key', id: (sharp ? 's' : 'n') + idx, sharp, off, depth: 3 };
    register(ctl, m); byOff.set(off, ctl);
  };
  NAT_OFF.forEach((off, i) => makeKey(natX(i), NAT_Z, false, i, off));
  SHARP_BETWEEN.forEach(([a, b], i) => makeKey((natX(a) + natX(b)) / 2, SHARP_Z, true, i, SHARP_OFF[i]));

  // slot buttons
  const makeTact = (id, x) => {
    holes.push(holeRect(x, SHARP_Z, 11.6, 5.2, 2.4));
    add(new THREE.BoxGeometry(11, 3, 4.6), darkMat, x, -2.4, SHARP_Z);
    const m = add(tactGeo, new THREE.MeshPhysicalMaterial({ color: '#2a2b2f', roughness: 0.5, emissive: '#ff9a4a', emissiveIntensity: 0 }), x, 0.2, SHARP_Z);
    register({ type: 'btn', id, depth: 1.2 }, m);
  };
  Object.entries(TACT).forEach(([id, x]) => makeTact(id, x));

  // round buttons
  const makeRound = (id, x, z, r, h = 3) => {
    holes.push(holeCircle(x, z, r + 0.55));
    add(new THREE.CylinderGeometry(r + 0.3, r + 0.3, 3, 32), darkMat, x, -2.4, z);
    const mat = new THREE.MeshPhysicalMaterial({ color: '#2a2b2f', roughness: 0.45, clearcoat: 0.25, emissive: '#ff9a4a', emissiveIntensity: 0 });
    const m = add(lathe(r, h), mat, x, 0.3, z);
    register({ type: 'btn', id, depth: 1.4 }, m);
  };
  makeRound('power', -141.8, -28.2, 2.2, 2.4);
  makeRound('menu', -106.4, -21.8, 4.2);
  makeRound('value', 43.6, -22.4, 5.4);

  // knobs
  const makeKnob = (id, type, x, z, r, h) => {
    holes.push(holeCircle(x, z, r * 0.62));
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    const km = knobMat.clone();
    add(new THREE.CylinderGeometry(r * 1.2, r * 1.25, 1.2, 64).translate(0, 0.6, 0), km, 0, 0, 0, g);
    const hit = add(knobGeometry(r, h), km, 0, 1.2, 0, g);
    const ind = add(new THREE.BoxGeometry(0.9, 0.3, r * 0.62), new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.5 }), 0, 1.2 + h + 0.05, -r * 0.45, g);
    ind.castShadow = false;
    const ctl = { type, id, ang: 0, angTarget: 0, group: g, hitMat: km };
    hit.userData.ctl = ctl; pickables.push(hit); controls.push(ctl); byId[id] = ctl;
    [...g.children].forEach(c => { if (c !== ind && c !== hit) { c.userData.ctl = ctl; pickables.push(c); } });
    ind.userData.ctl = ctl; pickables.push(ind);
    ctl.hover = false; ctl.press = 0; ctl.target = 0; ctl.mesh = hit; ctl.baseY = 1.2;
  };
  makeKnob('level', 'pot', -123.6, -24.5, 7, 12);
  Object.entries(ENC).forEach(([id, x]) => makeKnob(id, 'enc', x, -17.3, 6, 11));

  // decorative slots above the five encoders
  Object.values(ENC).forEach(x => {
    holes.push(holeRect(x, -30, 12, 3.6, 1.6));
    add(new THREE.BoxGeometry(11.4, 0.4, 3), darkMat, x, -1.6, -30);
  });

  // LCD
  holes.push(holeRect(LCD.x, LCD.z, 114, 31, 2));
  add(new THREE.BoxGeometry(113, 0.2, 30), darkMat, LCD.x, -1.6, LCD.z);
  const lcdMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
  const lcdMesh = new THREE.Mesh(new THREE.PlaneGeometry(LCD.w, LCD.h).rotateX(-Math.PI / 2), lcdMat);
  lcdMesh.position.set(LCD.x, -1.4, LCD.z); root.add(lcdMesh);
  const gridCv = document.createElement('canvas'); gridCv.width = gridCv.height = 4;
  const gx = gridCv.getContext('2d'); gx.fillStyle = 'rgba(0,0,0,0.5)'; gx.fillRect(3, 0, 1, 4); gx.fillRect(0, 3, 4, 1);
  const gridTex = new THREE.CanvasTexture(gridCv);
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping; gridTex.repeat.set(320, 80);
  const gridMesh = new THREE.Mesh(new THREE.PlaneGeometry(LCD.w, LCD.h).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: gridTex, transparent: true, toneMapped: false, depthWrite: false }));
  gridMesh.position.set(LCD.x, -1.35, LCD.z); root.add(gridMesh);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(113, 30).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.07, roughness: 0.04, metalness: 0, depthWrite: false }));
  glass.position.set(LCD.x, -0.6, LCD.z); root.add(glass);

  // plate + body
  plateShape.holes = holes;
  const plateGeo = extrude(plateShape, PLATE_T - 0.8, 0.4); plateGeo.translate(0, -PLATE_T + 0.4, 0);
  const plate = add(plateGeo, caseMat, 0, 0, 0);
  const bodyGeo = extrude(rr(new THREE.Shape(), 0, 0, W - 2, D - 2, 5), BODY_H - 1.2, 0.6);
  const bodyTop = -PLATE_T + 0.4 - 0.4;
  bodyGeo.translate(0, bodyTop + 0.1 - 14.0, 0);
  add(bodyGeo, caseMat, 0, 0, 0);
  const footGeo = extrude(rr(new THREE.Shape(), 0, 0, 34, 20, 4), 2.6, 0.5);
  [-1, 1].forEach(s => add(footGeo, blackPlastic, s * 128, -20.5, 27));
  const floorY = -21.0;

  const setCaseColor = c => caseMat.color.set(c);
  const setGrid = on => { gridMesh.visible = on; };

  return {
    root, pickables, controls, byId, byOff, lcdMat, floorY, setCaseColor, setGrid,
    setHover(ctl, on) {
      if (!ctl || ctl.hover === on) return;
      ctl.hover = on; ctl.hoverDirty = true;
    },
    update() {
      let busy = false;
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
      return busy;
    },
  };
}
