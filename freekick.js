// 프리킥 한 방 · 공 뒤 시점, 쓸어서 차고 휘게 쓸면 감긴다
import { THREE, D, makeStage, mat, mesh, canvasTex, noise, makeRig, setPose, track, lerpPose, runPose, makeCrowd, standStrip, smoothV } from './engine3d.js';
const G = window.G, A = G.audio, fx = G.fx, clamp = G.clamp, lerp = G.lerp;
fx.accent = '#3DBA6A'; fx.bannerY = 0.3;

const GW = 3.66, GH = 2.44, BR = 0.11, GR = 9.8, WD = 9.15;
// [거리, 공 좌우 위치, 벽 인원, 벽 치우침, 벽 점프, 골키퍼 실력, 바람]
const ST = [
  [16, 0, 0, 0, 0, 0, 0], [18, 0, 0, 0, 0, 1, 0], [18, 2, 2, -0.5, 0, 1, 0], [20, -3, 2, 0.5, 0, 1, 0], [20, 0, 3, -0.6, 0, 2, 0],
  [22, 4, 3, -0.5, 1, 2, 0], [22, -4, 3, 0.5, 1, 2, 1.5], [24, 0, 3, 0.7, 1, 2, -2], [19, 6, 4, -0.4, 1, 3, 0], [25, -2, 4, 0.5, 1, 3, 2],
  [17, -7, 3, 0.4, 1, 3, 0], [26, 3, 4, -0.6, 1, 3, -2.5], [21, 0, 5, 0, 1, 3, 0], [23, 8, 4, -0.3, 1, 3, 1.5], [28, 0, 3, 0.6, 1, 4, 0],
  [20, -5, 5, 0.3, 1, 4, -2], [24, 5, 4, -0.6, 1, 4, 3], [18, 9, 3, -0.3, 1, 4, 0], [27, -3, 5, 0.4, 1, 4, 2.5], [30, 0, 4, -0.5, 1, 4, -3],
  [22, -8, 4, 0.3, 1, 4, 2], [25, 4, 5, -0.5, 1, 5, 0], [19, 0, 5, 0.2, 1, 5, -2], [28, -6, 4, 0.5, 1, 5, 3], [23, 7, 5, -0.4, 1, 5, -3],
  [30, 3, 5, -0.6, 1, 5, 2], [21, -9, 4, 0.3, 1, 5, -2.5], [26, 0, 5, 0, 1, 5, 3.5], [32, -4, 5, 0.5, 1, 5, -3], [29, 6, 5, -0.3, 1, 5, 4],
];
const TR = [0, 0.55, 0.46, 0.38, 0.32, 0.27], VK = [0, 2.6, 3.0, 3.4, 3.8, 4.2];
const HOME = { c1: '#C23B22', c2: '#F4F1EA' }, AWAY = { c1: '#F2F1EC', c2: '#1B1D21' };
const S = { phase: 'idle', goals: 0, miss: 0, left: 0, stage: 0, shots: 0, t: 0 };
const cv = document.getElementById('cv'), hud = document.getElementById('hud');
const V = makeStage(cv, { fov: 42, exposure: 1.0, envI: 0.45 });
const H2 = G.canvas(hud);
const { scene, camera } = V;

// ---------- 경기장 ----------
let netGeo, netBase = [];
function build() {
  scene.background = canvasTex(4, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6F8FAE'); g.addColorStop(0.55, '#AFC3D3'); g.addColorStop(1, '#D9E1E6'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog('#C9D4DC', 90, 260);
  scene.add(new THREE.HemisphereLight('#E6EEF5', '#3C5A2E', 0.9));
  const sun = new THREE.DirectionalLight('#FFF0DA', 2.6); sun.position.set(-30, 45, 25); sun.target.position.set(0, 0, 10);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 5, far: 120 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  // 잔디와 선: 골라인이 z=0
  const ppm = 20, Wm = 76, Lm = 64;
  const pitch = canvasTex(Wm * ppm, Lm * ppm, (c, w, h) => {
    for (let i = 0; i * 5.5 * ppm < h + 1; i++) { c.fillStyle = i % 2 ? '#3E7F38' : '#478B3F'; c.fillRect(0, i * 5.5 * ppm, w, 5.5 * ppm); }
    noise(c, w, h, 60000, 0.22, ['#2E6A2A', '#5C9C4E', '#356F30']);
    const X = (x) => (x + Wm / 2) * ppm, Z = (z) => (z + 4) * ppm;
    c.strokeStyle = '#F4F2EC'; c.lineWidth = 0.12 * ppm;
    const L = (x1, z1, x2, z2) => { c.beginPath(); c.moveTo(X(x1), Z(z1)); c.lineTo(X(x2), Z(z2)); c.stroke(); };
    L(-34, 0, 34, 0); L(-34, 0, -34, 60); L(34, 0, 34, 60);
    L(-20.16, 0, -20.16, 16.5); L(20.16, 0, 20.16, 16.5); L(-20.16, 16.5, 20.16, 16.5);
    L(-9.16, 0, -9.16, 5.5); L(9.16, 0, 9.16, 5.5); L(-9.16, 5.5, 9.16, 5.5);
    const a = Math.acos(5.5 / 9.15); c.beginPath(); c.arc(X(0), Z(11), 9.15 * ppm, Math.PI / 2 - a, Math.PI / 2 + a); c.stroke();
    c.fillStyle = '#F4F2EC'; c.beginPath(); c.arc(X(0), Z(11), 0.15 * ppm, 0, 6.283); c.fill();
    for (const s of [-1, 1]) { c.beginPath(); c.arc(X(s * 34), Z(0), 1 * ppm, s > 0 ? Math.PI / 2 : 0, s > 0 ? Math.PI : Math.PI / 2); c.stroke(); }
  });
  const pl = mesh(new THREE.PlaneGeometry(Wm, Lm), new THREE.MeshStandardMaterial({ map: pitch, roughness: 0.95 }), 0, 0, Lm / 2 - 4, scene, false); pl.rotation.x = -Math.PI / 2;
  const out = mesh(new THREE.PlaneGeometry(260, 260), mat('#3A6E33', 0.95), 0, -0.02, 20, scene, false); out.rotation.x = -Math.PI / 2;
  // 골대
  const white = mat('#F6F5F0', 0.4);
  for (const x of [-GW - 0.06, GW + 0.06]) mesh(new THREE.CylinderGeometry(0.06, 0.06, GH + 0.06, 14), white, x, (GH + 0.06) / 2, 0, scene);
  const bar = mesh(new THREE.CylinderGeometry(0.06, 0.06, GW * 2 + 0.24, 14), white, 0, GH + 0.06, 0, scene); bar.rotation.z = Math.PI / 2;
  for (const x of [-GW - 0.06, GW + 0.06]) { const sp = mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 8), mat('#DADAD4', 0.5), x, GH / 2 + 0.3, -1.1, scene); sp.rotation.x = 0.55; }
  netBase = []; const NX = 22, NY = 9;
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const x = -GW + (2 * GW * i) / NX, y = (GH * j) / NY; netBase.push([x, y]); }
  const idx = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const k = j * (NX + 1) + i; if (i < NX) idx.push(k, k + 1); if (j < NY) idx.push(k, k + NX + 1); }
  const sideStart = netBase.length;
  for (const sx of [-GW, GW]) for (let j = 0; j <= NY; j++) for (let m = 0; m <= 4; m++) netBase.push([sx, (GH * j) / NY, m / 4]);
  for (let s = 0; s < 2; s++) for (let j = 0; j <= NY; j++) for (let m = 0; m <= 4; m++) { const k = sideStart + s * (NY + 1) * 5 + j * 5 + m; if (m < 4) idx.push(k, k + 1); if (j < NY) idx.push(k, k + 5); }
  netGeo = new THREE.BufferGeometry(); netGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(netBase.length * 3), 3)); netGeo.setIndex(idx);
  const net = new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: '#F2F2EE', transparent: true, opacity: 0.85 })); net.frustumCulled = false; scene.add(net);
  S.netNY = NY; S.netNX = NX; S.sideStart = sideStart;
  // 광고판과 관중석
  const led = canvasTex(2048, 96, (c, w, h) => { const l = [['한강 FC', HOME.c1], ['참맛 치킨', '#C8281F'], ['푸른생명', '#0F5A4A'], ['바로배송', '#2B3F8C'], ['한결 타이어', '#1C1C1C'], ['새벽우유', '#1F4E8C']]; l.forEach(([t, bg], i) => { c.fillStyle = bg; c.fillRect((i * w) / l.length, 0, w / l.length, h); c.fillStyle = '#FFF'; c.font = '700 48px "IBM Plex Sans KR"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, ((i + 0.5) * w) / l.length, h / 2 + 3); }); }, { repeat: [1, 1] });
  led.wrapS = THREE.RepeatWrapping; S.led = led;
  const ledM = new THREE.MeshBasicMaterial({ map: led, toneMapped: false });
  mesh(new THREE.BoxGeometry(44, 0.9, 0.12), ledM, 0, 0.45, -4.2, scene);
  for (const s of [-1, 1]) { const b = mesh(new THREE.BoxGeometry(50, 0.9, 0.12), ledM, s * 36.5, 0.45, 22, scene); b.rotation.y = Math.PI / 2; }
  const inner = [], outer = [], add = (x, z, nx, nz) => { inner.push(new THREE.Vector3(x, 1.4, z)); outer.push(new THREE.Vector3(x + nx * 30, 20, z + nz * 30)); };
  for (let z = 60; z >= -13; z -= 0.8) add(-42, z, -1, 0);
  for (let x = -41; x <= 41; x += 0.8) add(x, -14, 0, -1);
  for (let z = -13; z <= 60; z += 0.8) add(42, z, 1, 0);
  const seats = standStrip(scene, inner, outer, mat('#5A6066', 0.9), 20, 1.0);
  S.crowd = makeCrowd(scene, seats, { dim: 0.9, shirts: [HOME.c1, HOME.c1, '#E8E6E0', '#2C2C2C', '#7D8C99', '#D9D2C2', '#9E2A2F', '#3E6E4E'] });
  const roof = mesh(new THREE.BoxGeometry(110, 1, 18), mat('#2B2F33', 0.8), 0, 26, -32, scene, false); roof.rotation.x = -0.12;
}

// ---------- 선수 ----------
const ballTex = canvasTex(512, 256, (c, w, h) => { c.fillStyle = '#F5F4EF'; c.fillRect(0, 0, w, h); c.fillStyle = '#1C1D20'; for (let i = 0; i < 12; i++) { const x = ((i % 6) + (i > 5 ? 0.5 : 0)) * (w / 6), y = i > 5 ? h * 0.72 : h * 0.28; c.beginPath(); for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.283 - Math.PI / 2; c.lineTo(x + Math.cos(a) * 26, y + Math.sin(a) * 22); } c.fill(); } c.fillRect(0, 0, w, 10); c.fillRect(0, h - 10, w, 10); });
const ball = mesh(new THREE.SphereGeometry(BR, 28, 18), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.45 }), 0, BR, 20, scene);
const kicker = makeRig({ top: HOME.c1, pants: HOME.c2, legs: 'shorts', socks: HOME.c1, shoes: '#F2F2F2', num: 10, numColor: HOME.c2, h: 1.8, skin: '#C99A78' });
scene.add(kicker.root);
const keeper = makeRig({ top: '#D8D23A', sleeve: '#D8D23A', arms: 'long', pants: '#1B1D21', legs: 'shorts', socks: '#D8D23A', shoes: '#111', num: 1, numColor: '#1B1D21', gloves: '#F2F2F2', h: 1.92, skin: '#B47F5E' });
scene.add(keeper.root);
const wall = [];
for (let i = 0; i < 5; i++) { const r = makeRig({ top: AWAY.c1, pants: AWAY.c2, legs: 'shorts', socks: AWAY.c1, shoes: '#111', num: [4, 5, 8, 6, 15][i], numColor: AWAY.c2, h: 1.78 + i * 0.03, skin: ['#C99A78', '#8C5A3C', '#E0B394', '#B47F5E', '#D6A585'][i] }); r.root.visible = false; scene.add(r.root); wall.push(r); }
const P_WALL = { pos: [0, -0.03, 0], hipL: [-4, 0, 3], hipR: [-4, 0, -3], knL: [6, 0, 0], knR: [6, 0, 0], spine: [6, 0, 0], shL: [-22, 0, -22], shR: [-22, 0, 22], elL: [-50, 0, 0], elR: [-50, 0, 0], hnL: [0, 0, -20], hnR: [0, 0, 20] };
const P_WJUMP = { pos: [0, 0, 0], hipL: [-12, 0, 3], hipR: [-12, 0, -3], knL: [40, 0, 0], knR: [40, 0, 0], ftL: [30, 0, 0], ftR: [30, 0, 0], spine: [-2, 0, 0], shL: [-25, 0, -20], shR: [-25, 0, 20], elL: [-50, 0, 0], elR: [-50, 0, 0], head: [-10, 0, 0] };
const P_KREADY = { pos: [0, -0.2, 0], hipL: [-40, 0, 18], hipR: [-40, 0, -18], knL: [60, 0, 0], knR: [60, 0, 0], ftL: [-20, 0, 0], ftR: [-20, 0, 0], spine: [22, 0, 0], shL: [-30, 0, 35], shR: [-30, 0, -35], elL: [-50, 0, 0], elR: [-50, 0, 0], head: [-18, 0, 0] };
const P_KDIVE = { pos: [0, 0, 0], hipL: [-10, 0, 25], hipR: [-5, 0, -10], knL: [20, 0, 0], knR: [30, 0, 0], ftL: [20, 0, 0], ftR: [20, 0, 0], spine: [0, 0, 0], shL: [-175, 0, 20], shR: [-175, 0, -20], elL: [-5, 0, 0], elR: [-5, 0, 0], head: [-10, 0, 0] };
const K_STAND = { pos: [0, -0.04, 0], hipL: [-6, 0, 4], hipR: [8, 0, -4], knL: [10, 0, 0], knR: [14, 0, 0], spine: [6, 0, 0], shL: [0, 0, 10], shR: [0, 0, -10], elL: [-20, 0, 0], elR: [-20, 0, 0], head: [-8, 0, 0] };
const KICK = [
  [0, { pos: [0, -0.12, 0], hipL: [-30, 0, 0], knL: [30, 0, 0], hipR: [55, 0, 0], knR: [110, 0, 0], ftR: [40, 0, 0], spine: [5, -20, 0], shL: [-40, 0, 50], elL: [-30, 0, 0], shR: [30, 0, -40], elR: [-30, 0, 0], head: [-15, 0, 0] }],
  [0.12, { pos: [0, -0.1, 0], hipL: [-20, 0, 0], knL: [25, 0, 0], hipR: [-55, 0, 0], knR: [15, 0, 0], ftR: [45, 0, 0], spine: [12, 15, 0], shL: [-30, 0, 70], elL: [-20, 0, 0], shR: [-30, 0, -50], elR: [-30, 0, 0], head: [-20, 0, 0] }],
  [0.45, { pos: [0, -0.05, 0], hipL: [-6, 0, 0], knL: [12, 0, 0], hipR: [-80, 0, 0], knR: [25, 0, 0], ftR: [30, 0, 0], spine: [-4, 20, 0], shL: [-20, 0, 55], elL: [-20, 0, 0], shR: [-50, 0, -40], elR: [-30, 0, 0], head: [-5, 0, 0] }],
  [1.1, K_STAND],
];

// ---------- 물리 ----------
function newShot(cfg) {
  S.cfg = cfg; const [dist, bx, wn, ws, jump, kl, wind] = cfg;
  S.bx = bx; S.dist = dist; S.D = Math.sqrt(dist * dist - bx * bx);
  S.dir = { x: -bx / dist, z: -S.D / dist }; S.right = { x: -S.dir.z, z: S.dir.x };
  S.wall = []; for (let i = 0; i < wn; i++) S.wall.push(ws + (i - (wn - 1) / 2) * 0.52);
  S.jump = jump; S.kl = kl; S.wind = wind; S.kx = kl ? clamp(-ws * 2, -1.2, 1.2) : 0;
  S.ball = { x: bx, y: BR, z: S.D, vx: 0, vy: 0, vz: 0, ax: 0, az: 0, dead: true };
  S.keep = { x0: S.kx, tx: S.kx, ty: 1.25, t0: 9, t1: 10, save: false };
  S.t = 0; S.phase = 'ready'; S.net = null; S.sw = null; S.pred = null; G.slow = 1; S.kt = -1; S.trail = [];
  wall.forEach((r, i) => { r.root.visible = i < wn; if (i < wn) { const w = S.wall[i]; r.root.position.set(bx + S.dir.x * WD + S.right.x * w, 0, S.D + S.dir.z * WD + S.right.z * w); r.root.rotation.y = Math.atan2(-S.dir.x, -S.dir.z); setPose(r, P_WALL); } });
  keeper.root.visible = kl > 0; keeper.root.position.set(S.kx, 0, 0.45); keeper.root.rotation.set(0, 0, 0); setPose(keeper, P_KREADY);
  // 키커: 공 왼쪽 뒤에서 비스듬히
  S.kStart = new THREE.Vector3(bx - S.right.x * 1.6 - S.dir.x * 2.6, 0, S.D - S.right.z * 1.6 - S.dir.z * 2.6);
  kicker.root.position.copy(S.kStart); kicker.root.rotation.y = Math.atan2(bx - S.kStart.x, S.D - S.kStart.z); setPose(kicker, K_STAND);
  ball.position.set(bx, BR, S.D); ball.rotation.set(0, 0, 0);
  S.camGoal = { p: new THREE.Vector3(bx - S.dir.x * 5.4 + S.right.x * 0.35, 1.8, S.D - S.dir.z * 5.4 + S.right.z * 0.35), l: new THREE.Vector3(0, 1.3, 0) };
}
function randCfg(n) {
  const dist = Math.round(G.rand(16, 20 + Math.min(n, 12)));
  const bx = Math.round(G.rand(-1, 1) * Math.min(2 + n * 0.7, 9, dist * 0.45));
  const wn = n === 0 ? 0 : Math.min(5, 2 + (n >> 1));
  return [dist, bx, wn, +G.rand(-0.7, 0.7).toFixed(1), n >= 3 ? 1 : 0, Math.min(5, 1 + ((n / 3) | 0)), n >= 4 ? +(G.rand(-1, 1) * Math.min(4, n * 0.4)).toFixed(1) : 0];
}
function step(b, dt, t, live) {
  const pu = (b.x - S.bx) * S.dir.x + (b.z - S.D) * S.dir.z, pz = b.z;
  if (!b.dead) { b.vx += (b.ax + S.wind * 0.7) * dt; b.vz += b.az * dt; }
  b.vy -= GR * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  if (b.y < BR) {
    b.y = BR;
    if (b.vy < -1.4) { b.vy = -b.vy * 0.5; if (live) A.bounce(Math.min(1, b.vy / 6)); } else b.vy = 0;
    b.vx *= 1 - 1.2 * dt; b.vz *= 1 - 1.2 * dt;
  }
  if (b.dead) return null;
  const u = (b.x - S.bx) * S.dir.x + (b.z - S.D) * S.dir.z;
  if (pu < WD && u >= WD && S.wall.length) {
    const s = (b.x - S.bx) * S.right.x + (b.z - S.D) * S.right.z, jy = S.jump ? Math.max(0, 3.0 * t - 4.9 * t * t) : 0;
    for (const w of S.wall) if (Math.abs(s - w) < 0.27 + BR && b.y < 1.78 + jy + BR * 0.5 && b.y > jy - BR) return 'block';
  }
  if (pz > 0 && b.z <= 0) {
    const ax = Math.abs(b.x);
    if (b.y > GH + BR + 0.06 || ax > GW + BR + 0.06) return 'out';
    if (ax > GW - BR || b.y > GH - BR) return ax < GW && b.y < GH ? 'postin' : 'post';
    return 'cross';
  }
  return null;
}
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
function kick(dx, dy, dur, curv) {
  const b = S.ball, p0 = V.toScreen(b.x, b.y, b.z);
  ndc.set(((p0.x + dx) / V.W) * 2 - 1, -((p0.y + dy) / V.H) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(plane, hit)) hit.set(0, 6, 0);
  const T = { x: clamp(hit.x, -14, 14), y: clamp(hit.y * 0.65, BR, 7) };
  const len = Math.hypot(dx, dy), sp = clamp(13 + 7.5 * (len / V.H) / Math.max(dur, 0.06), 15, 32);
  const hx = T.x - b.x, hz = -b.z, hd = Math.hypot(hx, hz), tt = hd / sp, ax = hx / hd, az = hz / hd, rx = -az, rz = ax;
  const dev = clamp(curv, -0.35, 0.35) * hd * 0.9, la = (-8 * dev) / (tt * tt), lv = (4 * dev) / tt;
  b.vx = ax * sp + rx * lv; b.vz = az * sp + rz * lv; b.vy = (T.y - BR + 0.5 * GR * tt * tt) / tt;
  b.ax = rx * la; b.az = rz * la;
  const c = Object.assign({}, b, { dead: false }); let t = 0, ev = null;
  while (t < 4.5 && !ev) { ev = step(c, 1 / 120, t, false); t += 1 / 120; }
  S.pred = { ev, x: c.x, y: c.y, t };
  const K = S.keep; K.save = false; K.tx = S.kx; K.ty = 1.25; K.t0 = TR[S.kl]; K.t1 = Math.max(t, K.t0 + 0.1);
  if (S.kl && (ev === 'cross' || ev === 'postin' || ev === 'post' || ev === 'out')) {
    const run = Math.max(0, VK[S.kl] * (t - TR[S.kl])), ddx = c.x - S.kx, ddy = c.y - 1.25, need = Math.hypot(ddx, ddy);
    if (ev === 'cross' && need <= run + 0.5) { K.save = true; K.tx = c.x; K.ty = c.y; }
    else { const k = Math.min(0.92, (run + 0.2) / Math.max(need, 0.01)) * (ev === 'out' ? 0.4 : 1); K.tx = S.kx + ddx * k; K.ty = 1.25 + ddy * k; }
  }
  S.power = (sp - 15) / 17; S.spinAx = new THREE.Vector3(0, 1, 0).multiplyScalar(-curv * 30).add(new THREE.Vector3(1, 0, 0).multiplyScalar(-8));
}
function launch() { // 키커 발이 공에 닿는 순간
  S.ball.dead = false; S.phase = 'fly'; S.t = 0; S.shots++;
  S.camGoal.p = new THREE.Vector3(S.bx - S.dir.x * 1.5, 3.1, S.D - S.dir.z * 1.5); // 공을 따라 키커 머리 위로
  A.kick(S.power); fx.shake(0.1 + 0.1 * S.power);
  const p = V.toScreen(S.ball.x, 0.05, S.ball.z); fx.burst(p.x, p.y, 6, '#5C8F4A', { v0: 20, v1: 90, g: 200, ang: -1.57, spread: 2.2, r1: 3 });
}
function onEvent(ev) {
  const b = S.ball, p = V.toScreen(b.x, b.y, b.z);
  b.dead = true; G.slow = 1; S.phase = 'after'; S.after = 2.2;
  if (ev === 'cross') ev = S.keep.save ? 'save' : 'goal';
  if (ev === 'goal' || ev === 'postin') {
    b.vx *= 0.12; b.vz *= 0.12; b.vy *= 0.3; S.net = { x: b.x, y: b.y, t: 0 }; S.goals++;
    if (ev === 'postin') A.post();
    A.net(); A.whistle(true); A.cheer(1.5); fx.shake(0.4); G.hitStop(70); S.crowd.hype = 1;
    fx.say('골!', ev === 'postin' ? '골대 맞고 들어갔다' : S.wall.length ? '벽을 넘겨 꽂았다' : '', '#FFD23F');
    return;
  }
  S.miss++; S.crowd.hype = 0.2;
  if (ev === 'save') { b.vz = -b.vz * 0.25; b.vx = (b.x > S.keep.x0 ? 1 : -1) * G.rand(2, 5); b.vy = G.rand(2, 4); A.thud(); A.aw(); fx.shake(0.25); G.hitStop(50); fx.say('선방', '골키퍼 손끝에 걸렸다'); }
  else if (ev === 'block') { b.vz *= -0.3; b.vx = b.vx * -0.3 + G.rand(-2, 2); b.vy = G.rand(1, 3); A.thud(); A.aw(); fx.shake(0.25); fx.say('벽에 맞았다', '수비벽이 막았다'); }
  else if (ev === 'post') { b.vz *= -0.45; b.vy *= 0.5; A.post(); A.aw(); fx.shake(0.5); G.hitStop(80); fx.say('골대!', '한 뼘이 모자랐다'); }
  else { A.aw(); fx.say(ev === 'short' ? '힘이 모자랐다' : '빗나갔다'); }
}
function nextShot() {
  if (S.stage >= 0) {
    if (--S.left > 0) return newShot(S.cfg);
    S.phase = 'end';
    G.ui.endStage(S.stage, S.goals, S.goals ? '공 세 개 가운데 ' + S.goals + '개를 넣었다.' : '하나는 넣어야 다음으로 넘어간다.');
  } else {
    if (S.miss >= 3) { S.phase = 'end'; return G.ui.endEndless(S.goals); }
    newShot(randCfg(S.goals));
  }
}

// ---------- 매 프레임 ----------
const tmp = new THREE.Vector3(), camPos = new THREE.Vector3(0, 12, 40), camLook = new THREE.Vector3(0, 1, 0);
function update(dt) {
  S.t += dt; S.crowd.update(dt); S.led.offset.x = (S.led.offset.x + dt * 0.02) % 1;
  const b = S.ball;
  if (S.phase === 'idle' || !S.cfg) { const a = G.time * 0.06; smoothV(camPos, tmp.set(Math.sin(a) * 14, 4, 22 + Math.cos(a) * 4), 1, dt); smoothV(camLook, tmp.set(0, 1.2, 0), 1, dt); camera.position.copy(camPos); camera.lookAt(camLook); return; }
  smoothV(camPos, S.camGoal.p, 4, dt);
  if (S.phase === 'fly' || S.phase === 'after') smoothV(camLook, tmp.set(b.x * 0.5, clamp(b.y, 0.6, 2.5), Math.min(S.D * 0.4, b.z * 0.5)), 3, dt); else smoothV(camLook, S.camGoal.l, 4, dt);
  // 키커 도움닫기와 킥
  if (S.phase === 'runup') {
    S.kt += dt; const k = clamp(S.kt / 0.6, 0, 1), plant = new THREE.Vector3(b.x - S.right.x * 0.32 - S.dir.x * 0.25, 0, b.z - S.right.z * 0.32 - S.dir.z * 0.25);
    kicker.root.position.copy(S.kStart).lerp(plant, k); kicker.root.rotation.y = Math.atan2(S.dir.x * 0.85 + S.right.x * 0.25, S.dir.z * 0.85 + S.right.z * 0.25);
    setPose(kicker, runPose(S.kt * 15, 0.9));
    if (k >= 1) { S.phase = 'strike'; S.kt = 0; }
  } else if (S.phase === 'strike') { S.kt += dt; setPose(kicker, track(KICK, S.kt)); if (S.kt >= 0.12) launch(); }
  else if (S.phase === 'fly' || S.phase === 'after') { S.kt += dt; setPose(kicker, track(KICK, S.kt + 0.12)); }
  if (S.phase === 'fly') {
    const ev = step(b, dt, S.t, true); S.t += dt;
    const pe = S.pred.ev;
    if ((pe === 'cross' || pe === 'postin' || pe === 'post') && b.z < 5) G.slow = 0.45;
    if (ev) onEvent(ev); else if (S.t > 4.4) onEvent('short');
  } else if (S.phase === 'after') {
    step(b, dt, S.t, true); S.t += dt;
    if (S.net) { S.net.t += dt; if (b.z < -1.6) { b.z = -1.6; b.vz = 0; b.vx *= 0.9; } }
    S.after -= dt; if (S.after <= 0) nextShot();
  }
  if (S.phase === 'fly' || S.phase === 'after') { ball.position.set(b.x, b.y, b.z); ball.rotateOnAxis(tmp.set(1, 0.2 * Math.sign(S.spinAx.y), 0).normalize(), -dt * (14 + S.power * 18)); }
  // 벽 점프
  const jt = S.phase === 'fly' || S.phase === 'after' ? S.t : 0, jy = S.jump ? Math.max(0, 3.0 * jt - 4.9 * jt * jt) : 0;
  wall.forEach((r, i) => { if (!r.root.visible) return; r.root.position.y = jy; setPose(r, jy > 0.02 ? P_WJUMP : P_WALL); });
  // 골키퍼
  if (S.kl) {
    const K = S.keep, k = S.phase === 'fly' || S.phase === 'after' ? clamp((S.t - K.t0) / (K.t1 - K.t0), 0, 1) : 0, e = G.ease.out(k);
    const hx = K.x0 + (K.tx - K.x0) * e, hy = 1.25 + (K.ty - 1.25) * e, dx = hx - K.x0;
    const roll = clamp(-dx * 0.42, -1.35, 1.35) * Math.min(1, k * 1.6);
    keeper.root.position.set(K.x0 + dx * 0.55, Math.max(0, (hy - 1.25) * 0.6) + Math.abs(Math.sin(roll)) * 0.35, 0.45);
    keeper.root.rotation.set(0, 0, roll);
    setPose(keeper, k > 0 ? lerpPose(P_KREADY, P_KDIVE, Math.min(1, k * 2)) : lerpPose(P_KREADY, { ...P_KREADY, pos: [Math.sin(S.t * 2.2) * 0.06, -0.2, 0] }, 1));
  }
  // 그물
  const a = netGeo.attributes.position, NX = S.netNX, NY = S.netNY;
  const dz = (x, y) => { let z = -(0.9 + 1.1 * (1 - y / GH)); if (S.net) { const d2 = (x - S.net.x) ** 2 + (y - S.net.y) ** 2; z -= Math.exp(-d2 / 1.2) * Math.exp(-S.net.t * 2.2) * Math.abs(Math.cos(S.net.t * 9)) * 0.9; } return z; };
  for (let i = 0; i < netBase.length; i++) {
    const p = netBase[i];
    if (i < S.sideStart) a.setXYZ(i, p[0], p[1], dz(p[0], p[1]));
    else a.setXYZ(i, p[0], p[1], dz(p[0], p[1]) * p[2]);
  }
  a.needsUpdate = true;
  camera.position.copy(camPos); camera.lookAt(camLook);
}

// ---------- 중계 그래픽 ----------
function render() {
  V.render();
  const c = H2.ctx, W = H2.W, H = H2.H; c.clearRect(0, 0, W, H);
  if (S.phase === 'idle' || !S.cfg) return;
  const o = fx.offset(); c.save(); c.translate(o.x, o.y);
  if (S.sw && S.sw.pts.length > 1) { c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); S.sw.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke(); }
  if (S.phase === 'ready' && !S.sw && S.stage >= 0 && S.shots === 0 && (S.stage === 0 || S.stage === 2 || S.stage === 6)) {
    const p = V.toScreen(S.ball.x, BR, S.ball.z), t = V.toScreen(S.stage === 2 ? -2.6 : 2.4, 1.6 / 0.65, 0), k = (G.time % 1.6) / 1.1;
    if (k <= 1) { const e = G.ease.out(k), bend = S.stage === 2 ? -W * 0.25 : 0, mx = (p.x + t.x) / 2 + bend, my = (p.y + t.y) / 2;
      const px = (1 - e) * (1 - e) * p.x + 2 * (1 - e) * e * mx + e * e * t.x, py = (1 - e) * (1 - e) * p.y + 2 * (1 - e) * e * my + e * e * t.y;
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 4; c.setLineDash([2, 10]); c.beginPath(); c.moveTo(p.x, p.y); c.quadraticCurveTo(mx, my, t.x, t.y); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#FFF'; c.beginPath(); c.arc(px, py, 12, 0, 6.283); c.fill(); }
    const msg = S.stage === 0 ? '공에서 골대 쪽으로 쓸어 올려 찬다' : S.stage === 2 ? '휘게 쓸면 공도 휘어 벽을 돌아간다' : '바람이 공을 민다';
    c.font = '700 15px "IBM Plex Sans KR"'; c.textAlign = 'center'; c.fillStyle = 'rgba(12,14,17,.8)'; const tw = c.measureText(msg).width; c.fillRect(W / 2 - tw / 2 - 12, H * 0.9 - 16, tw + 24, 30); c.fillStyle = '#F3F2EE'; c.textBaseline = 'middle'; c.fillText(msg, W / 2, H * 0.9);
  }
  fx.draw(c, W, H);
  c.restore();
  const x = 10, y = 10 + G.safeTop, bg = 'rgba(12,14,17,.9)';
  c.fillStyle = bg; c.fillRect(x, y, 200, 56); c.fillStyle = '#3DBA6A'; c.fillRect(x, y, 5, 56);
  c.textBaseline = 'middle'; c.textAlign = 'left'; c.font = '700 13px "IBM Plex Sans KR"'; c.fillStyle = '#A3ABB3';
  c.fillText(S.stage >= 0 ? '프리킥 ' + (S.stage + 1) + '번' : '무한 도전', x + 14, y + 16);
  c.font = '700 13px "Barlow Condensed"'; c.textAlign = 'right'; c.fillText(S.dist + 'M', x + 190, y + 16);
  c.textAlign = 'left'; c.font = '700 26px "Barlow Condensed"'; c.fillStyle = '#FFD23F'; c.fillText(S.goals + (S.stage < 0 ? '' : ''), x + 14, y + 40);
  c.font = '700 12px "IBM Plex Sans KR"'; c.fillStyle = '#A3ABB3'; c.fillText('골', x + 34, y + 41);
  for (let i = 0; i < 3; i++) {
    const cx = x + 112 + i * 26, cy = y + 40;
    if (S.stage >= 0) { const used = i >= S.left - (S.phase === 'ready' ? 0 : 1); c.fillStyle = used ? '#39424A' : '#F3F2EE'; c.beginPath(); c.arc(cx, cy, 7, 0, 6.283); c.fill(); }
    else { c.strokeStyle = i < S.miss ? '#E23A3A' : '#39424A'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 6, cy - 6); c.lineTo(cx + 6, cy + 6); c.moveTo(cx + 6, cy - 6); c.lineTo(cx - 6, cy + 6); c.stroke(); }
  }
  if (S.wind) {
    c.fillStyle = bg; c.fillRect(x, y + 58, 200, 26); c.font = '700 12px "IBM Plex Sans KR"'; c.fillStyle = '#A3ABB3'; c.fillText('바람', x + 14, y + 71);
    const ax = x + 60, len = 18 + Math.abs(S.wind) * 9, s = Math.sign(S.wind);
    c.strokeStyle = '#F3F2EE'; c.lineWidth = 3; c.beginPath(); c.moveTo(ax + (s < 0 ? len : 0), y + 71); c.lineTo(ax + (s < 0 ? 0 : len), y + 71); c.stroke();
    c.fillStyle = '#F3F2EE'; c.beginPath(); const hx = ax + (s < 0 ? 0 : len); c.moveTo(hx + s * 6, y + 71); c.lineTo(hx - s * 2, y + 66); c.lineTo(hx - s * 2, y + 76); c.fill();
    c.font = '700 14px "Barlow Condensed"'; c.fillText(Math.abs(S.wind).toFixed(1) + ' m/s', ax + len + 14, y + 72);
  }
}

// ---------- 조작 ----------
hud.addEventListener('pointerdown', (e) => {
  if (S.phase !== 'ready' || !G.ui.playing || G.paused) return;
  const r = hud.getBoundingClientRect(); S.sw = { id: e.pointerId, pts: [{ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }] };
  try { hud.setPointerCapture(e.pointerId); } catch (er) {}
});
function fire() {
  const sw = S.sw; S.sw = null; if (!sw || S.phase !== 'ready') return;
  const a = sw.pts[0], b = sw.pts[sw.pts.length - 1], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < V.H * 0.07 || dy > -10) return;
  let far = 0; for (const p of sw.pts) { const d = ((p.x - a.x) * dy - (p.y - a.y) * dx) / len; if (Math.abs(d) > Math.abs(far)) far = d; }
  kick(dx, dy, (b.t - a.t) / 1000, -far / len); S.phase = 'runup'; S.kt = 0;
}
hud.addEventListener('pointermove', (e) => {
  if (!S.sw || e.pointerId !== S.sw.id) return;
  const r = hud.getBoundingClientRect(), p = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  S.sw.pts.push(p); if (Math.hypot(p.x - S.sw.pts[0].x, p.y - S.sw.pts[0].y) > V.H * 0.55) fire();
});
hud.addEventListener('pointerup', (e) => { if (S.sw && e.pointerId === S.sw.id) fire(); });
hud.addEventListener('pointercancel', () => { S.sw = null; });

build();
G.ui.init({
  key: 'fk', title: '프리킥 한 방', tag: '벽을 넘기고 골키퍼를 속여라', sheet: '프리킥 기록', stages: ST.length,
  endless: '무한 도전', endlessTag: '세 번 놓치면 끝', unit: '골',
  win: ['겨우 통과', '잘 찼다', '세 개 다 넣었다'], lose: '한 골도 못 넣었다',
  start(i) { S.stage = i; S.goals = 0; S.miss = 0; S.left = 3; S.shots = 0; newShot(i >= 0 ? ST[i] : randCfg(0)); A.whistle(false); A.crowd(1); },
  idle: () => { S.phase = 'idle'; S.cfg = null; A.crowd(0.4); },
});
G.fonts(() => G.loop(update, render));
window.__fk = { S, kick, launch, ST, V, camera };
