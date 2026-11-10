// 세 경기가 같이 쓰는 3D 도구: 렌더러, 선수 모델, 자세, 관중, 글자 텍스처
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
export { THREE };
export const D = Math.PI / 180;

export function makeStage(canvas, o = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.maxDpr || 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.exposure || 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  if (o.env !== false) {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = o.envI == null ? 0.5 : o.envI;
  }
  const camera = new THREE.PerspectiveCamera(o.fov || 40, 1, 0.1, o.far || 900);
  const S = { renderer, scene, camera, W: 1, H: 1 };
  const fit = () => {
    const r = canvas.getBoundingClientRect(); if (!r.width) return;
    S.W = r.width; S.H = r.height; renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); if (o.onResize) o.onResize(S);
  };
  new ResizeObserver(fit).observe(canvas); fit();
  const v = new THREE.Vector3();
  S.toScreen = (x, y, z) => { v.set(x, y, z).project(camera); return { x: ((v.x + 1) / 2) * S.W, y: ((1 - v.y) / 2) * S.H, ok: v.z < 1 && v.z > -1 }; };
  S.render = () => renderer.render(scene, camera);
  return S;
}

const MC = new Map();
export function mat(color, rough = 0.8, metal = 0) {
  const k = color + '|' + rough + '|' + metal;
  if (!MC.has(k)) MC.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return MC.get(k);
}
export function mesh(geo, m, x = 0, y = 0, z = 0, parent, shadow = true) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true;
  if (parent) parent.add(o); return o;
}
export function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  t.userData.canvas = c; t.userData.draw = draw; return t;
}
export function redraw(t) { const c = t.userData.canvas; t.userData.draw(c.getContext('2d'), c.width, c.height); t.needsUpdate = true; }
export function glowTex(col) {
  return canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, col); g.addColorStop(0.25, col.replace(/[\d.]+\)$/, '0.35)')); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
}
export function noise(c, w, h, n, a, cols) {
  for (let i = 0; i < n; i++) { c.globalAlpha = Math.random() * a; c.fillStyle = cols[(Math.random() * cols.length) | 0]; c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  c.globalAlpha = 1;
}

// ---------- 선수 모델 ----------
const GC = {};
const geo = (k, f) => GC[k] || (GC[k] = f());
const lathe = (pts) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), 20);
const cyl = (a, b, l) => geo('c' + a + '_' + b + '_' + l, () => new THREE.CylinderGeometry(a, b, l, 14));
const sph = (r) => geo('s' + r, () => new THREE.SphereGeometry(r, 18, 12));
const dome = (r, k) => geo('d' + r + '_' + k, () => new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI * k));
function numTex(n, col, font) {
  return canvasTex(128, 128, (c) => { c.font = '700 96px ' + (font || '"Barlow Condensed",sans-serif'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(n, 64, 70); });
}

// o: h 키, bulk 체격, skin, hair, top, sleeve(소매색), arms('short'|'long'), pants, legs('long'|'shorts'|'bball'), socks, shoes, head('cap'|'helmet'|null), headColor, num, numColor, numFront, gloves
export function makeRig(o) {
  o = Object.assign({ h: 1.85, bulk: 1, skin: '#B47F5E', hair: '#16110D', top: '#EEEEEA', sleeve: null, arms: 'short', pants: '#EEEEEA', legs: 'long', socks: '#1B1B1B', shoes: '#151515', head: null, headColor: '#1B1B1B', num: null, numColor: '#1B1B1B', numFront: false, gloves: null }, o);
  const root = new THREE.Group(), J = {}, b = o.bulk;
  root.scale.setScalar(o.h / 1.85);
  const skin = mat(o.skin, 0.55), top = mat(o.top, 0.82), slv = mat(o.sleeve || o.top, 0.82), pants = mat(o.pants, 0.82), sock = mat(o.socks, 0.9), shoe = mat(o.shoes, 0.45), hair = mat(o.hair, 0.95), hand = o.gloves ? mat(o.gloves, 0.7) : skin;
  const jt = (n, p, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); J[n] = g; return g; };
  const m = (g, mt, p, x = 0, y = 0, z = 0) => mesh(g, mt, x, y, z, p);
  const body = jt('body', root, 0, 0, 0);
  const hips = jt('hips', body, 0, 1.0, 0);
  m(geo('pelvis', () => lathe([[0.03, -0.14], [0.13, -0.12], [0.155, -0.03], [0.15, 0.06], [0.135, 0.13]])), pants, hips).scale.set(b, 1, 0.72);
  const spine = jt('spine', hips, 0, 0.1, 0);
  m(geo('abd', () => lathe([[0.128, -0.05], [0.133, 0.08], [0.148, 0.2], [0.158, 0.27]])), top, spine).scale.set(b, 1, 0.68);
  const chest = jt('chest', spine, 0, 0.14, 0);
  m(geo('chest', () => lathe([[0.148, -0.06], [0.168, 0.06], [0.178, 0.17], [0.16, 0.25], [0.1, 0.3], [0.05, 0.315]])), top, chest).scale.set(b * 1.06, 1, 0.64);
  const neck = jt('neck', chest, 0, 0.28, 0);
  m(cyl(0.05, 0.056, 0.13), skin, neck, 0, 0.04, 0);
  const head = jt('head', neck, 0, 0.1, 0);
  m(sph(0.105), skin, head, 0, 0.1, 0.006).scale.set(0.9, 1.1, 1);
  m(geo('nose', () => new THREE.BoxGeometry(0.026, 0.045, 0.04)), skin, head, 0, 0.085, 0.1);
  m(sph(0.024), skin, head, 0.094, 0.095, -0.005); m(sph(0.024), skin, head, -0.094, 0.095, -0.005);
  m(geo('brow', () => new THREE.BoxGeometry(0.075, 0.012, 0.02)), hair, head, 0, 0.128, 0.095);
  if (o.head === 'cap') {
    m(dome(0.116, 0.5), mat(o.headColor, 0.8), head, 0, 0.115, -0.004).scale.set(0.95, 0.85, 1.04);
    m(geo('brim', () => new THREE.CylinderGeometry(0.088, 0.088, 0.012, 18)), mat(o.headColor, 0.8), head, 0, 0.12, 0.1).scale.set(1, 1, 0.85);
  } else if (o.head === 'helmet') {
    m(dome(0.13, 0.6), mat(o.headColor, 0.25, 0.1), head, 0, 0.1, -0.006).scale.set(0.95, 1, 1.05);
    m(geo('brimH', () => new THREE.CylinderGeometry(0.08, 0.08, 0.012, 18)), mat(o.headColor, 0.25, 0.1), head, 0, 0.115, 0.115).scale.set(1, 1, 0.7);
    m(sph(0.065), mat(o.headColor, 0.25, 0.1), head, 0.085, 0.07, 0).scale.set(0.6, 1, 1);
  } else m(dome(0.112, 0.52), hair, head, 0, 0.112, -0.01).scale.set(0.93, 1.02, 1.05);
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const sh = jt('sh' + s, chest, sx * 0.205 * b, 0.215, 0);
    m(sph(0.068), slv, sh);
    if (o.arms === 'long') m(cyl(0.058, 0.046, 0.29), slv, sh, 0, -0.145, 0);
    else if (o.arms === 'none') { sh.children[0].material = skin; m(cyl(0.055, 0.045, 0.29), skin, sh, 0, -0.145, 0); }
    else { m(cyl(0.066, 0.06, 0.14), slv, sh, 0, -0.06, 0); m(cyl(0.053, 0.045, 0.29), skin, sh, 0, -0.145, 0); }
    const el = jt('el' + s, sh, 0, -0.29, 0);
    m(sph(0.046), o.arms === 'long' ? slv : skin, el);
    m(cyl(0.046, 0.034, 0.25), o.arms === 'long' ? slv : skin, el, 0, -0.125, 0);
    const hn = jt('hn' + s, el, 0, -0.255, 0);
    m(sph(0.043), hand, hn, 0, -0.045, 0.004).scale.set(0.78, 1.3, 0.55);
    const hp = jt('hip' + s, hips, sx * 0.095, -0.06, 0);
    if (o.legs === 'shorts') { m(cyl(0.097, 0.088, 0.24), pants, hp, 0, -0.1, 0); m(cyl(0.084, 0.062, 0.44), skin, hp, 0, -0.22, 0); }
    else if (o.legs === 'bball') { m(cyl(0.104, 0.092, 0.4), pants, hp, 0, -0.17, 0); m(cyl(0.084, 0.062, 0.44), skin, hp, 0, -0.22, 0); }
    else m(cyl(0.09, 0.064, 0.44), pants, hp, 0, -0.22, 0);
    const kn = jt('kn' + s, hp, 0, -0.44, 0);
    m(sph(0.061), o.legs === 'long' ? pants : skin, kn);
    if (o.legs === 'long') { m(cyl(0.064, 0.052, 0.2), pants, kn, 0, -0.1, 0); m(cyl(0.054, 0.04, 0.42), sock, kn, 0, -0.21, 0); }
    else if (o.legs === 'shorts') { m(cyl(0.058, 0.055, 0.06), skin, kn, 0, -0.03, 0); m(cyl(0.062, 0.043, 0.38), sock, kn, 0, -0.23, 0); }
    else { m(cyl(0.058, 0.04, 0.42), skin, kn, 0, -0.21, 0); m(cyl(0.047, 0.044, 0.1), sock, kn, 0, -0.37, 0); }
    const ft = jt('ft' + s, kn, 0, -0.42, 0);
    m(geo('shoe', () => new THREE.BoxGeometry(0.1, 0.085, 0.27)), shoe, ft, 0, -0.045, 0.045);
  }
  let pm = null;
  if (o.num != null) {
    pm = new THREE.MeshStandardMaterial({ map: numTex(String(o.num), o.numColor), transparent: true, roughness: 0.8, depthWrite: false });
    const p = new THREE.Mesh(geo('numpl', () => new THREE.PlaneGeometry(0.21, 0.21)), pm);
    p.position.set(0, 0.11, -0.119); p.rotation.y = Math.PI; chest.add(p);
    if (o.numFront) { const q = p.clone(); q.position.set(0, 0.09, 0.121); q.rotation.y = 0; q.scale.setScalar(0.62); chest.add(q); }
  }
  const r = { root, J, o };
  r.setNum = (n) => { if (!pm) return; pm.map.dispose(); pm.map = numTex(String(n), o.numColor); pm.needsUpdate = true; };
  setPose(r, REST);
  return r;
}

const Z3 = [0, 0, 0];
export const REST = { shL: [0, 0, 7], shR: [0, 0, -7], elL: [-10, 0, 0], elR: [-10, 0, 0] };
export function setPose(r, p) {
  for (const k in r.J) {
    if (k === 'hips') continue;
    const v = p[k] || Z3; r.J[k].rotation.set(v[0] * D, v[1] * D, v[2] * D);
  }
  const h = p.hips || Z3; r.J.hips.rotation.set(h[0] * D, h[1] * D, h[2] * D);
  const q = p.pos || Z3; r.J.hips.position.set(q[0], 1.0 + q[1], q[2]);
}
export function lerpPose(a, b, t) {
  const o = {};
  for (const k in a) o[k] = a[k];
  for (const k in b) o[k] = b[k];
  for (const k in o) { const x = a[k] || Z3, y = b[k] || Z3; o[k] = [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]; }
  return o;
}
export function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) {
    const [t0, a] = keys[i - 1], [t1, b] = keys[i]; let u = (t - t0) / (t1 - t0); u = u * u * (3 - 2 * u);
    return lerpPose(a, b, u);
  }
  return keys[keys.length - 1][1];
}
export function mirror(p) {
  const o = {};
  for (const k in p) {
    const n = /L$/.test(k) ? k.slice(0, -1) + 'R' : /R$/.test(k) ? k.slice(0, -1) + 'L' : k, v = p[k];
    o[n] = k === 'pos' ? [-v[0], v[1], v[2]] : [v[0], -v[1], -v[2]];
  }
  return o;
}
export function runPose(ph, amp = 1) {
  const s = Math.sin(ph), c = Math.cos(ph);
  return {
    spine: [10 * amp, 0, 0], chest: [4 * amp, -s * 10 * amp, 0], head: [-6 * amp, s * 6 * amp, 0],
    hipL: [-48 * s * amp - 8 * amp, 0, 0], hipR: [48 * s * amp - 8 * amp, 0, 0],
    knL: [15 + 75 * Math.max(0, c) * amp, 0, 0], knR: [15 + 75 * Math.max(0, -c) * amp, 0, 0],
    ftL: [10 * s * amp, 0, 0], ftR: [-10 * s * amp, 0, 0],
    shL: [50 * s * amp, 0, 8], shR: [-50 * s * amp, 0, -8], elL: [-85, 0, 0], elR: [-85, 0, 0],
    pos: [0, -0.04 * amp + Math.abs(c) * 0.06 * amp, 0],
  };
}
// 관절의 월드 위치
const tv = new THREE.Vector3();
export function jointPos(r, name, out, dx = 0, dy = 0, dz = 0) { r.root.updateMatrixWorld(true); return (out || new THREE.Vector3()).set(dx, dy, dz).applyMatrix4(r.J[name].matrixWorld); }
export function handMid(r, out) { const a = jointPos(r, 'hnL', tv, 0, -0.05, 0).clone(), b2 = jointPos(r, 'hnR', out, 0, -0.05, 0); return b2.add(a).multiplyScalar(0.5); }

// ---------- 관중 ----------
const SHIRTS = ['#E8E6E0', '#C9302C', '#1F3A5F', '#2C2C2C', '#F2C230', '#7D8C99', '#3E6E4E', '#D9D2C2', '#9E2A2F', '#5A4B8A', '#E07A3A', '#FFFFFF'];
const SKINS = ['#C8987A', '#B07D5E', '#E0B394', '#8D5E43', '#D6A585'];
export function makeCrowd(scene, spots, o = {}) {
  const n = spots.length, bodyG = new THREE.CapsuleGeometry(0.2, 0.32, 3, 8), headG = new THREE.SphereGeometry(0.115, 10, 8);
  const bodyM = new THREE.MeshStandardMaterial({ roughness: 0.9 }), headM = new THREE.MeshStandardMaterial({ roughness: 0.8 });
  const B = new THREE.InstancedMesh(bodyG, bodyM, n), H = new THREE.InstancedMesh(headG, headM, n);
  const cols = o.shirts || SHIRTS, col = new THREE.Color(), m4 = new THREE.Matrix4(), ph = new Float32Array(n), dim = o.dim || 1;
  spots.forEach((p, i) => {
    ph[i] = Math.random() * 6.28;
    col.set(cols[(Math.random() * cols.length) | 0]).multiplyScalar(dim * (0.75 + Math.random() * 0.3)); B.setColorAt(i, col);
    col.set(SKINS[(Math.random() * SKINS.length) | 0]).multiplyScalar(dim); H.setColorAt(i, col);
  });
  scene.add(B); scene.add(H);
  const C = { B, H, spots, hype: 0, t: 0 };
  C.update = (dt) => {
    C.t += dt; C.hype = Math.max(0, C.hype - dt * 0.4);
    const k = C.hype;
    for (let i = 0; i < n; i++) {
      const p = spots[i], up = k > 0.05 ? Math.max(0, Math.sin(C.t * 9 + ph[i])) * 0.25 * k + 0.15 * k : Math.sin(C.t * 1.3 + ph[i]) * 0.01;
      m4.makeTranslation(p.x, p.y + 0.36 + up, p.z); B.setMatrixAt(i, m4);
      m4.makeTranslation(p.x, p.y + 0.78 + up, p.z); H.setMatrixAt(i, m4);
    }
    B.instanceMatrix.needsUpdate = true; H.instanceMatrix.needsUpdate = true;
  };
  C.update(0);
  return C;
}

// 띠 모양 관중석: inner/outer 점 배열을 이어 경사면을 만들고 좌석 위치를 돌려준다
export function standStrip(scene, inner, outer, m, rows, colGap) {
  const pos = [], idx = [];
  for (let i = 0; i < inner.length; i++) { const a = inner[i], b = outer[i]; pos.push(a.x, a.y, a.z, b.x, b.y, b.z); if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const me = new THREE.Mesh(g, m); me.receiveShadow = true; scene.add(me);
  const spots = []; let acc = 0;
  for (let i = 1; i < inner.length; i++) {
    const a = inner[i - 1], b = inner[i]; acc += Math.hypot(b.x - a.x, b.z - a.z);
    while (acc >= colGap) {
      acc -= colGap; const t = 1 - acc / Math.max(0.001, Math.hypot(b.x - a.x, b.z - a.z));
      for (let r = 1; r <= rows; r++) {
        if (Math.random() < 0.06) continue;
        const f = (r - 0.3) / (rows + 0.4);
        const ix = a.x + (b.x - a.x) * t, iy = a.y + (b.y - a.y) * t, iz = a.z + (b.z - a.z) * t;
        const o1 = outer[i - 1], o2 = outer[i], ox = o1.x + (o2.x - o1.x) * t, oy = o1.y + (o2.y - o1.y) * t, oz = o1.z + (o2.z - o1.z) * t;
        spots.push({ x: ix + (ox - ix) * f, y: iy + (oy - iy) * f, z: iz + (oz - iz) * f });
      }
    }
  }
  return spots;
}

export function textPlane(w, h, pxw, draw) {
  const t = canvasTex(pxw, Math.round((pxw * h) / w), draw);
  const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.userData.tex = t; return p;
}
export function smooth(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
export function smoothV(v, t, rate, dt) { const k = 1 - Math.exp(-rate * dt); v.x += (t.x - v.x) * k; v.y += (t.y - v.y) * k; v.z += (t.z - v.z) * k; return v; }

// 두 마디 팔 IK: 손목을 target(월드)에 두고 팔꿈치는 pole(월드) 쪽으로 굽힌다
const DOWN = new THREE.Vector3(0, -1, 0), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
export function armIK(r, s, target, pole) {
  const sh = r.J['sh' + s], el = r.J['el' + s], par = sh.parent;
  par.updateMatrixWorld(true); _m.copy(par.matrixWorld).invert();
  const T = target.clone().applyMatrix4(_m).sub(sh.position), P = pole.clone().applyMatrix4(_m).sub(sh.position);
  const a = 0.29, b = 0.255, d = Math.min(Math.max(T.length(), 0.08), a + b - 0.002), dir = T.clone().normalize();
  const A = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const pn = P.clone().sub(dir.clone().multiplyScalar(P.dot(dir))); if (pn.lengthSq() < 1e-6) pn.set(0, 0, -1); pn.normalize();
  const E = dir.clone().multiplyScalar(Math.cos(A) * a).add(pn.multiplyScalar(Math.sin(A) * a));
  sh.quaternion.setFromUnitVectors(DOWN, E.clone().normalize());
  const H = dir.multiplyScalar(d).sub(E).applyQuaternion(_q.copy(sh.quaternion).invert()).normalize();
  el.quaternion.setFromUnitVectors(DOWN, H);
}
export function legIK(r, s, target, pole) {
  const hp = r.J['hip' + s], kn = r.J['kn' + s], par = hp.parent;
  par.updateMatrixWorld(true); _m.copy(par.matrixWorld).invert();
  const T = target.clone().applyMatrix4(_m).sub(hp.position), P = pole.clone().applyMatrix4(_m).sub(hp.position);
  const a = 0.44, b = 0.42, d = Math.min(Math.max(T.length(), 0.1), a + b - 0.002), dir = T.clone().normalize();
  const A = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const pn = P.clone().sub(dir.clone().multiplyScalar(P.dot(dir))); if (pn.lengthSq() < 1e-6) pn.set(0, 0, 1); pn.normalize();
  const E = dir.clone().multiplyScalar(Math.cos(A) * a).add(pn.multiplyScalar(Math.sin(A) * a));
  hp.quaternion.setFromUnitVectors(DOWN, E.clone().normalize());
  const H = dir.multiplyScalar(d).sub(E).applyQuaternion(_q.copy(hp.quaternion).invert()).normalize();
  kn.quaternion.setFromUnitVectors(DOWN, H);
}
