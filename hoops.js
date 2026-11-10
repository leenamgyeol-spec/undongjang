// 버저비터 · 슛 미터를 꼭대기에서 놓는 농구 (클러치 장면 + 3점 슛 콘테스트)
import { THREE, D, makeStage, mat, mesh, canvasTex, redraw, noise, makeRig, setPose, lerpPose, runPose, armIK, makeCrowd, standStrip, textPlane, smoothV } from './engine3d.js';
const G = window.G, A = G.audio, fx = G.fx, clamp = G.clamp, lerp = G.lerp;
fx.accent = '#F07A26'; fx.bannerY = 0.4;

const HOME = { ab: '미르', c1: '#9B1B24', c2: '#F1ECE2' }, AWAY = { ab: '범', c1: '#1F5A3C', c2: '#E8E4D8' };
const RIM_Y = 3.05, RIM = 0.2286, BR = 0.12, BOARD_Z = -0.38;
const spot = (a, d) => new THREE.Vector3(Math.sin(a * D) * d, 0, Math.cos(a * D) * d);
const isThree = (p) => Math.hypot(p.x, p.z) >= 7.24 || (Math.abs(p.x) >= 6.7 && p.z <= 2.74);
// [이겨야 할 점수, 남은 시간(초), 공격 자리들 [각도, 거리], 수비 시작 거리(0=없음), 수비 접근 속도, 상황]
const ST = [
  [2, 8, [[0, 4.6]], 0, 0, '1점 뒤진 4쿼터. 자유투 라인 오픈 찬스'],
  [3, 8, [[45, 7.6]], 0, 0, '2점 차. 윙에서 오픈 3점'],
  [2, 6, [[-55, 5.2]], 3.2, 1.2, '1점 차. 수비가 붙으러 온다'],
  [3, 6, [[88, 7.0]], 3.0, 1.4, '2점 차. 코너 3점'],
  [3, 5, [[0, 7.5]], 2.2, 1.4, '2점 차. 아래로 당기면 스텝백'],
  [4, 6, [[-45, 7.6], [30, 5.0]], 2.6, 1.5, '3점 차, 공격 두 번'],
  [2, 3.5, [[-88, 4.5]], 1.8, 1.6, '1점 차, 3.5초. 베이스라인'],
  [3, 4, [[-20, 7.8]], 2.0, 1.8, '2점 차, 4초'],
  [5, 6, [[60, 7.6], [-60, 7.6]], 2.4, 1.6, '4점 차. 3점 두 방이 필요하다'],
  [2, 2.4, [[15, 5.5]], 1.6, 2.0, '1점 차, 2.4초'],
  [6, 6, [[0, 7.6], [88, 7.0], [-88, 7.0]], 2.2, 1.8, '5점 차, 공격 세 번'],
  [3, 2.0, [[-45, 7.9]], 1.6, 2.0, '2점 차, 2초'],
  [3, 3, [[0, 8.6]], 1.3, 2.2, '2점 차. 한 발 뒤 딥 3점'],
  [5, 4, [[88, 7.0], [0, 6.0]], 1.6, 2.2, '4점 차, 공격 두 번'],
  [3, 1.6, [[0, 9.2]], 1.4, 2.4, '2점 차, 1.6초. 마지막 한 방'],
];
const RACKS = [[-88, 7.05], [-45, 7.55], [0, 7.55], [45, 7.55], [88, 7.05]];
const DEEP = [[-22, 8.75], [22, 8.75]];
const CONTEST = ['오픈', '약한 견제', '강한 견제', '완전 봉쇄'];
const S = { phase: 'idle', t: 0, balls: [], score: 0 };
const cv = document.getElementById('cv'), hud = document.getElementById('hud');
const V = makeStage(cv, { fov: 52, exposure: 1.0, envI: 0.6 });
const H2 = G.canvas(hud);
const { scene, camera } = V;

// ---------- 경기장 ----------
const PPM = 128;
function floorTex() {
  return canvasTex(2048, 2048, (c, w, h) => {
    const X = (x) => (x + 8) * PPM, Z = (z) => (z + 2) * PPM;
    for (let i = 0; i * 7 < w; i++) { const l = 0.92 + Math.random() * 0.12; c.fillStyle = `rgb(${(211 * l) | 0},${(160 * l) | 0},${(98 * l) | 0})`; c.fillRect(i * 7, 0, 7, h); }
    c.fillStyle = 'rgba(90,55,25,.35)'; for (let i = 0; i * 7 < w; i++) { c.fillRect(i * 7, 0, 0.8, h); let y = Math.random() * 300; while (y < h) { c.fillRect(i * 7, y, 7, 1); y += 180 + Math.random() * 420; } }
    noise(c, w, h, 30000, 0.12, ['#7A4A22', '#F0C890']);
    c.fillStyle = 'rgba(58,20,22,.96)'; c.fillRect(0, 0, w, Z(-1.6)); c.fillRect(0, 0, X(-7.62), h); c.fillRect(X(7.62), 0, w, h);
    c.fillStyle = 'rgba(155,27,36,.93)'; c.fillRect(X(-2.44), Z(-1.6), 4.88 * PPM, 5.79 * PPM);
    c.strokeStyle = '#F6F2EA'; c.lineWidth = 6.5; c.lineCap = 'butt';
    const L = (x1, z1, x2, z2) => { c.beginPath(); c.moveTo(X(x1), Z(z1)); c.lineTo(X(x2), Z(z2)); c.stroke(); };
    L(-7.62, -1.6, 7.62, -1.6); L(-7.62, -1.6, -7.62, 14); L(7.62, -1.6, 7.62, 14); L(-7.62, 12.73, 7.62, 12.73);
    L(-6.7, -1.6, -6.7, 2.74); L(6.7, -1.6, 6.7, 2.74);
    const a0 = Math.asin(6.7 / 7.24); c.beginPath(); c.arc(X(0), Z(0), 7.24 * PPM, Math.PI / 2 - a0, Math.PI / 2 + a0); c.stroke();
    c.strokeRect(X(-2.44), Z(-1.6), 4.88 * PPM, 5.79 * PPM);
    c.beginPath(); c.arc(X(0), Z(4.19), 1.8 * PPM, 0, Math.PI); c.stroke();
    c.setLineDash([22, 22]); c.beginPath(); c.arc(X(0), Z(4.19), 1.8 * PPM, Math.PI, 2 * Math.PI); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.arc(X(0), Z(0), 1.22 * PPM, 0, Math.PI); c.stroke();
    c.beginPath(); c.arc(X(0), Z(12.73), 1.83 * PPM, Math.PI, 2 * Math.PI); c.stroke();
    for (const s of [-1, 1]) for (const z of [0.6, 1.5, 2.4, 3.3]) L(s * 2.44, z, s * 2.6, z);
    c.save(); c.translate(X(0), Z(-1.1)); c.fillStyle = 'rgba(246,242,234,.9)'; c.font = '78px "Black Han Sans"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('서울 미르', 0, 0); c.restore();
  });
}
function ballTex(money) {
  return canvasTex(512, 256, (c, w, h) => {
    if (money) { ['#C62E2E', '#F2F0EA', '#2A4F9C', '#F2F0EA'].forEach((col, i) => { c.fillStyle = col; c.fillRect((i * w) / 4, 0, w / 4, h); }); }
    else { c.fillStyle = '#C45E1C'; c.fillRect(0, 0, w, h); noise(c, w, h, 9000, 0.4, ['#8E3F10', '#E07A35']); }
    c.strokeStyle = '#1A1210'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    for (const x of [w / 4, (3 * w) / 4]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (const x0 of [0, w / 2]) { c.beginPath(); for (let y = 0; y <= h; y += 4) { const x = x0 + w / 4 + Math.sin((y / h) * Math.PI) * w * 0.18 * (x0 ? 1 : -1) - (x0 ? 0 : 0); y ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
  });
}
const BALLG = new THREE.SphereGeometry(BR, 24, 16), BALLM = new THREE.MeshStandardMaterial({ map: ballTex(false), roughness: 0.7 }), MONEYM = new THREE.MeshStandardMaterial({ map: ballTex(true), roughness: 0.6 });
let netGeo, netBase = [], clockTex;
function build() {
  scene.background = new THREE.Color('#050506'); scene.fog = new THREE.Fog('#050506', 30, 80);
  scene.add(new THREE.HemisphereLight('#FFF6EA', '#3A2A20', 0.6));
  const key = new THREE.DirectionalLight('#FFF4E4', 2.3); key.position.set(4, 18, 9); key.target.position.set(0, 0, 3); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -12, right: 12, top: 14, bottom: -10, near: 2, far: 40 }); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  scene.add(key); scene.add(key.target);
  const rim2 = new THREE.DirectionalLight('#DDE6FF', 0.6); rim2.position.set(-6, 10, -8); scene.add(rim2);
  const fl = mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.28, metalness: 0 }), 0, 0, 6, scene, false); fl.rotation.x = -Math.PI / 2;
  const ap = mesh(new THREE.PlaneGeometry(60, 60), mat('#1C1615', 0.6), 0, -0.01, 6, scene, false); ap.rotation.x = -Math.PI / 2;
  // 관중석: 베이스라인과 양쪽 사이드
  const inner = [], outer = [];
  const add = (x, z, nx, nz) => { inner.push(new THREE.Vector3(x, 1.6, z)); outer.push(new THREE.Vector3(x + nx * 22, 15, z + nz * 22)); };
  for (let z = 22; z >= -8.5; z -= 0.5) add(-11.5, z, -1, 0);
  for (let x = -11; x <= 11; x += 0.5) add(x, -9, 0, -1);
  for (let z = -8.5; z <= 22; z += 0.5) add(11.5, z, 1, 0);
  const seats = standStrip(scene, inner, outer, mat('#151515', 0.95), 18, 0.75);
  S.crowd = makeCrowd(scene, seats, { dim: 0.32 });
  // 코트 옆 광고판
  const led = canvasTex(1024, 64, (c, w, h) => { const l = [['서울 미르', '#9B1B24'], ['한결 타이어', '#1C1C1C'], ['새벽우유', '#1F4E8C'], ['참맛 치킨', '#C8281F']]; l.forEach(([t, bg], i) => { c.fillStyle = bg; c.fillRect((i * w) / 4, 0, w / 4, h); c.fillStyle = '#FFF'; c.font = '700 34px "IBM Plex Sans KR"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, ((i + 0.5) * w) / 4, h / 2 + 2); }); }, { repeat: [2, 1] });
  const ledM = new THREE.MeshBasicMaterial({ map: led, toneMapped: false }); S.led = led;
  mesh(new THREE.BoxGeometry(16, 0.85, 0.1), ledM, 0, 0.43, -4.3, scene, false);
  for (const s of [-1, 1]) { const b = mesh(new THREE.BoxGeometry(18, 0.85, 0.1), ledM, s * 9.4, 0.43, 6, scene, false); b.rotation.y = s * Math.PI / 2; }
  // 골대
  const pad = mat(HOME.c1, 0.7), steel = mat('#2B2E33', 0.4, 0.6);
  mesh(new THREE.BoxGeometry(1.4, 1.1, 2.2), pad, 0, 0.55, -3.6, scene);
  mesh(new THREE.BoxGeometry(0.28, 3.1, 0.28), steel, 0, 2.6, -3.9, scene);
  const arm = mesh(new THREE.BoxGeometry(0.18, 0.18, 3.6), steel, 0, 3.75, -2.2, scene); arm.rotation.x = -0.12;
  mesh(new THREE.BoxGeometry(1.83, 1.07, 0.03), new THREE.MeshStandardMaterial({ color: '#D8E8F0', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2, depthWrite: false }), 0, 3.43, BOARD_Z - 0.015, scene, false);
  const bl = textPlane(1.83, 1.07, 512, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#FFFFFF'; c.lineWidth = 14; c.strokeRect(7, 7, w - 14, h - 14); const sw = (0.59 / 1.83) * w, sh = (0.45 / 1.07) * h; c.lineWidth = 9; c.strokeRect((w - sw) / 2, h - sh - (0.15 / 1.07) * h, sw, sh); });
  bl.material.transparent = true; bl.position.set(0, 3.43, BOARD_Z + 0.001); scene.add(bl);
  mesh(new THREE.BoxGeometry(1.83, 0.08, 0.09), pad, 0, 2.88, BOARD_Z - 0.015, scene);
  const rim = mesh(new THREE.TorusGeometry(RIM + 0.01, 0.01, 8, 40), mat('#E2541B', 0.35, 0.5), 0, RIM_Y, 0, scene); rim.rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.12, 0.03, 0.16), mat('#E2541B', 0.35, 0.5), 0, RIM_Y, BOARD_Z + 0.08, scene);
  // 그물
  const pos = []; netBase = [];
  for (let j = 0; j <= 4; j++) for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + (j % 2) * (Math.PI / 12), r = lerp(RIM + 0.005, 0.13, j / 4), y = RIM_Y - j * 0.11; netBase.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
  const idx = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 12; i++) { const a = j * 12 + i, b1 = (j + 1) * 12 + i, b2 = (j + 1) * 12 + ((i + (j % 2 ? 1 : 11)) % 12); idx.push(a, b1, a, b2); }
  netBase.forEach((p) => pos.push(...p));
  netGeo = new THREE.BufferGeometry(); netGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); netGeo.setIndex(idx);
  const net = new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: '#F4F2EC' })); net.frustumCulled = false; scene.add(net);
  // 보드 위 시계
  mesh(new THREE.BoxGeometry(0.7, 0.3, 0.24), mat('#111214', 0.6), 0, 4.15, BOARD_Z - 0.06, scene);
  const cp = textPlane(0.66, 0.27, 256, drawClock); cp.position.set(0, 4.15, BOARD_Z + 0.065); scene.add(cp); clockTex = cp.userData.tex;
  // 3점 콘테스트 랙
  S.rackObjs = RACKS.map(([a, d]) => {
    const p = spot(a, d), r = new THREE.Vector3(p.x, 0, p.z).normalize(), tng = new THREE.Vector3(r.z, 0, -r.x), rp = p.clone().addScaledVector(tng, a > 0 ? -0.95 : 0.95).addScaledVector(r, 0.35);
    const g = new THREE.Group(); g.position.copy(rp); g.rotation.y = Math.atan2(tng.x, tng.z); scene.add(g);
    mesh(new THREE.BoxGeometry(1.2, 0.05, 0.3), mat('#B9BDC2', 0.3, 0.8), 0, 0.82, 0, g); for (const x of [-0.55, 0.55]) mesh(new THREE.BoxGeometry(0.05, 0.82, 0.3), mat('#B9BDC2', 0.3, 0.8), x, 0.41, 0, g);
    const balls = []; for (let i = 0; i < 5; i++) balls.push(mesh(BALLG, BALLM, -0.48 + i * 0.24, 0.95, 0, g));
    g.visible = false; return { g, balls };
  });
  S.deepObjs = DEEP.map(([a, d]) => { const p = spot(a, d), g = new THREE.Group(); g.position.copy(p).addScaledVector(new THREE.Vector3(p.x, 0, p.z).normalize(), 0.6); mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.95, 12), mat('#B9BDC2', 0.3, 0.8), 0, 0.47, 0, g); const b = mesh(BALLG, MONEYM, 0, 1.07, 0, g); scene.add(g); g.visible = false; return { g, b }; });
}
function drawClock(c, w, h) {
  c.fillStyle = '#0A0B0C'; c.fillRect(0, 0, w, h);
  const t = S.mode === 'contest' ? Math.max(0, S.clock) : Math.max(0, S.clock || 0);
  c.font = '700 70px "Barlow Condensed"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#FF3B2E';
  c.fillText(t >= 10 ? Math.ceil(t) : t.toFixed(1), w / 2, h / 2 + 4);
}

// ---------- 선수 ----------
const shooter = makeRig({ top: HOME.c2, arms: 'none', pants: HOME.c2, legs: 'bball', socks: '#F1ECE2', shoes: '#1A1A1A', num: 7, numColor: HOME.c1, numFront: true, h: 1.96, skin: '#8C5A3C' });
scene.add(shooter.root);
const defender = makeRig({ top: AWAY.c1, arms: 'none', pants: AWAY.c1, legs: 'bball', socks: '#E8E4D8', shoes: '#F1F1F1', num: 23, numColor: AWAY.c2, numFront: true, h: 2.0, skin: '#B9875F' });
scene.add(defender.root); defender.root.visible = false;
const hand = new THREE.Mesh(BALLG, BALLM); hand.castShadow = true; scene.add(hand);
const W3 = (r, x, y, z) => { const a = r.root.rotation.y, p = r.root.position; return new THREE.Vector3(p.x + x * Math.cos(a) + z * Math.sin(a), p.y + y, p.z - x * Math.sin(a) + z * Math.cos(a)); };
const faceRim = (r) => { r.root.rotation.y = Math.atan2(-r.root.position.x, -r.root.position.z); };
const P_HOLD = { pos: [0, -0.08, 0], hipL: [-25, 0, 8], hipR: [-20, 0, -8], knL: [35, 0, 0], knR: [30, 0, 0], ftL: [-10, 0, 0], ftR: [-10, 0, 0], spine: [12, 0, 0] };
const P_DIP = { pos: [0, -0.22, 0], hipL: [-55, 0, 8], hipR: [-50, 0, -8], knL: [85, 0, 0], knR: [80, 0, 0], ftL: [-30, 0, 0], ftR: [-30, 0, 0], spine: [18, 0, 0] };
const P_AIR = { pos: [0, 0, 0], hipL: [-8, 0, 5], hipR: [-4, 0, -5], knL: [12, 0, 0], knR: [10, 0, 0], ftL: [35, 0, 0], ftR: [35, 0, 0], spine: [-3, 0, 0], head: [-10, 0, 0] };
const P_GUARD = { pos: [0, -0.2, 0], hipL: [-45, 0, 22], hipR: [-45, 0, -22], knL: [70, 0, 0], knR: [70, 0, 0], ftL: [-25, 0, 0], ftR: [-25, 0, 0], spine: [20, 0, 0], shL: [-35, 0, 55], shR: [-35, 0, -55], elL: [-40, 0, 0], elR: [-40, 0, 0] };
const P_BLOCK = { pos: [0, 0, 0], hipL: [-10, 0, 6], hipR: [-10, 0, -6], knL: [20, 0, 0], knR: [20, 0, 0], ftL: [30, 0, 0], ftR: [30, 0, 0], shL: [-160, 0, 15], shR: [-175, 0, -5], elL: [-10, 0, 0], elR: [-5, 0, 0], head: [-15, 0, 0] };

// ---------- 슛 ----------
const METER_T = 0.5;
function window_() { const c = S.contest || 0, dist = Math.hypot(shooter.root.position.x, shooter.root.position.z); return 0.056 * (1 - 0.12 * c) * (dist > 8.3 ? 0.8 : 1); }
function grade(e, w) {
  const a = Math.abs(e), side = e < 0 ? '이름' : '늦음';
  if (a <= w) return { n: '완벽', col: '#3DDC6E', p: 1, green: true };
  if (a <= 2.2 * w) return { n: '살짝 ' + (e < 0 ? '이름' : '늦음'), col: '#F3F2EE', p: 0.62 };
  if (a <= 4.5 * w) return { n: side, col: '#F0A030', p: 0.3 };
  return { n: '너무 ' + (e < 0 ? '이름' : '늦음'), col: '#E23A3A', p: 0.06 };
}
function press() {
  if (S.phase !== 'ready' && S.phase !== 'live') return;
  S.phase = 'shoot'; S.st = 0; A.squeak(); S.fb = null;
}
function release() {
  if (S.phase !== 'shoot') return;
  const e = (S.st - METER_T) / METER_T, w = window_(), g = grade(e, w), cl = S.contest || 0;
  const mult = [1, 0.85, 0.6, 0.35][cl], p = g.green ? 1 : g.p * mult, make = Math.random() < p;
  const from = W3(shooter, 0.12, 2.15 + shooter.root.position.y, 0.22).setY(2.2 + shooter.root.position.y);
  const toward = new THREE.Vector3(-from.x, 0, -from.z).normalize(), side = new THREE.Vector3(toward.z, 0, -toward.x);
  let off = 0, lat = G.rand(-0.04, 0.04);
  if (!make) { const big = Math.abs(e) > 4.5 * w; off = (e < 0 ? -1 : 1) * (big ? G.rand(0.45, 0.6) : G.rand(0.21, 0.29)); if (Math.random() < 0.3) { lat = (Math.random() < 0.5 ? -1 : 1) * G.rand(0.2, 0.26); off *= 0.3; } }
  else if (!g.green && Math.random() < 0.4) lat = (Math.random() < 0.5 ? -1 : 1) * G.rand(0.05, 0.08);
  const aim = new THREE.Vector3(0, RIM_Y, 0).addScaledVector(toward, off).addScaledVector(side, lat);
  const hd = new THREE.Vector3(aim.x - from.x, 0, aim.z - from.z), d = hd.length(), dy = aim.y - from.y, th = 52 * D;
  const v = Math.sqrt((9.8 * d * d) / (2 * Math.cos(th) ** 2 * (d * Math.tan(th) - dy)));
  hd.normalize();
  const b = { m: S.ballMoney ? MONEYM : BALLM, mesh: new THREE.Mesh(BALLG, S.ballMoney ? MONEYM : BALLM), p: from.clone(), v: new THREE.Vector3(hd.x * Math.cos(th) * v, Math.sin(th) * v, hd.z * Math.cos(th) * v), made: false, t: 0, floor: 0, val: S.ballVal || (isThree(shooter.root.position) ? 3 : 2), touch: false, green: !!g.green, afterHorn: false, rimT: 0 };
  b.mesh.castShadow = true; scene.add(b.mesh); S.balls.push(b);
  hand.visible = false; S.phase = 'flight'; S.relT = 0; S.lastE = e;
  S.fb = { g, c: cl, t: 0, e, w };
  if (S.mode === 'contest') S.nextIn = 0.42;
  if (defender.root.visible) S.defJump = 0;
}
function stepBall(b, dt) {
  const py = b.p.y; b.t += dt; b.rimT -= dt;
  b.v.y -= 9.8 * dt; b.p.addScaledVector(b.v, dt);
  const rh = Math.hypot(b.p.x, b.p.z) || 1e-6, cx = (b.p.x / rh) * (RIM + 0.01), cz = (b.p.z / rh) * (RIM + 0.01);
  const nx = b.p.x - cx, ny = b.p.y - RIM_Y, nz = b.p.z - cz, d = Math.hypot(nx, ny, nz);
  if (d < BR + 0.01) {
    const n = new THREE.Vector3(nx / d, ny / d, nz / d), vn = b.v.dot(n);
    if (vn < 0) { b.v.addScaledVector(n, -1.55 * vn); b.v.multiplyScalar(0.88); if (b.rimT <= 0) { A.rim(); b.rimT = 0.1; fx.shake(0.05); } b.touch = true; }
    b.p.set(cx, RIM_Y, cz).addScaledVector(n, BR + 0.01);
  }
  if (b.p.z - BR < BOARD_Z && b.v.z < 0 && Math.abs(b.p.x) < 0.92 && b.p.y > 2.9 && b.p.y < 3.97 && b.p.z > BOARD_Z - 0.2) { b.p.z = BOARD_Z + BR; b.v.z = -b.v.z * 0.62; A.bounce(0.5); b.touch = true; }
  if (!b.made && py >= RIM_Y && b.p.y < RIM_Y && b.v.y < 0 && Math.hypot(b.p.x, b.p.z) < RIM - 0.03) { b.made = true; scored(b); }
  if (b.p.y < BR) { b.p.y = BR; if (b.v.y < -1) A.bounce(Math.min(1, -b.v.y / 7)); b.v.y = -b.v.y * 0.68; b.v.x *= 0.85; b.v.z *= 0.85; b.floor++; }
  b.mesh.position.copy(b.p); b.mesh.rotation.x -= dt * 8;
  if (b.made && b.p.y < RIM_Y && b.p.y > RIM_Y - 0.5) { const k = Math.hypot(b.p.x, b.p.z); if (k > 0.1) { b.v.x *= 0.9; b.v.z *= 0.9; } }
}
function scored(b) {
  S.netT = 0; A.net();
  const pts = b.val; S.score += pts; S.made++; if (b.green) S.greens++;
  if (S.mode === 'contest') { const r = S.rackRes[b.rack]; if (r) r[b.slot] = 1; fx.text(H2.W / 2, H2.H * 0.36, '+' + pts, b.val > 1 ? '#FFD23F' : '#F3F2EE', 30); if (b.val > 1) S.crowd.hype = 0.5; }
  else { S.crowd.hype = 0.8; A.cheer(1.1); }
  if (b.afterHorn) { fx.say('버저비터!', '종이 울린 뒤에 들어갔다', '#FFD23F'); A.cheer(1.8); S.crowd.hype = 1; }
}

// ---------- 진행 ----------
function begin(i) {
  S.stage = i; S.score = 0; S.made = 0; S.greens = 0; S.balls.forEach((b) => scene.remove(b.mesh)); S.balls = []; S.fb = null; S.netT = 9;
  S.rackObjs.forEach((r) => { r.g.visible = i < 0; r.balls.forEach((b, k) => { b.visible = true; }); });
  S.deepObjs.forEach((d) => { d.g.visible = i < 0; d.b.visible = true; });
  A.crowd(1);
  if (i >= 0) {
    const st = ST[i]; S.mode = 'clutch'; S.need = st[0]; S.poss = 0; S.spots = st[2]; S.defD0 = st[3]; S.defSp = st[4];
    S.them = 100 + ((i * 7) % 9); S.us = S.them - (S.need - 1);
    startPoss();
  } else {
    S.mode = 'contest'; S.clock = 70; S.rackRes = [[], [], [], [], [], [], []]; S.moneyRack = -1; S.started = false; S.queue = []; S.qi = -1;
    defender.root.visible = false; S.phase = 'choose'; placeAt(spot(RACKS[0][0], RACKS[0][1] + 0.15)); showChoose(true);
    fx.say('3점 슛 콘테스트', '머니볼 랙 위치를 고른다');
  }
  redraw(clockTex);
}
function placeAt(p) { shooter.root.position.set(p.x, 0, p.z); faceRim(shooter); }
function startPoss() {
  const [a, d] = S.spots[S.poss]; placeAt(spot(a, d)); S.clock = ST[S.stage][1]; S.moves = 0; S.move = null; S.contest = 0;
  hand.material = BALLM; hand.visible = true; S.ballVal = 0; S.ballMoney = false;
  if (S.defD0) { defender.root.visible = true; S.defD = S.defD0; placeDef(); } else defender.root.visible = false;
  S.phase = 'intro'; S.tp = 1.4; S.defJump = -1;
  fx.say(S.poss === 0 ? '4쿼터 ' + S.clock.toFixed(1) + '초' : '공격 ' + (S.poss + 1), S.poss === 0 ? ST[S.stage][5] : S.need - (S.us - S.them + S.need - 1) > 0 ? '아직 ' + Math.max(0, S.them - S.us + 1) + '점이 필요하다' : '');
  redraw(clockTex);
}
function placeDef() {
  const s = shooter.root.position, dir = new THREE.Vector3(-s.x, 0, -s.z).normalize();
  defender.root.position.set(s.x + dir.x * S.defD, 0, s.z + dir.z * S.defD); defender.root.rotation.y = Math.atan2(s.x - defender.root.position.x, s.z - defender.root.position.z);
}
function contestLvl() { if (!defender.root.visible) return 0; const d = S.defD; return d > 2.2 ? 0 : d > 1.4 ? 1 : d > 0.8 ? 2 : 3; }
function endPoss(note) {
  S.poss++;
  const won = S.us >= S.them + 1;
  if (S.poss < S.spots.length && !won) { S.phase = 'between'; S.tp = 1.6; return; }
  S.phase = 'end';
  setTimeout(() => {
    if (!won) return G.ui.endStage(S.stage, 0, note || (S.them - S.us + 1) + '점이 모자랐다.');
    const st = 1 + (S.greens >= S.made ? 2 : S.greens > 0 ? 1 : 0);
    G.ui.endStage(S.stage, st, '완벽 릴리스 ' + S.greens + '번. ' + (st === 3 ? '전부 초록불.' : '초록불이 많을수록 별이 늘어난다.'));
  }, 1300);
}
function showChoose(on) {
  const el = document.getElementById('choose'); el.style.display = on ? 'grid' : 'none';
}
function pickMoney(k) {
  S.moneyRack = k; showChoose(false);
  S.rackObjs.forEach((r, i) => r.balls.forEach((b, j) => { b.material = i === k || j === 4 ? MONEYM : BALLM; }));
  S.queue = [];
  for (let r = 0; r < 5; r++) {
    for (let j = 0; j < 5; j++) { const m = r === k || j === 4; S.queue.push({ pos: spot(RACKS[r][0], RACKS[r][1] + 0.15), r, k: j, val: m ? 2 : 1, money: m }); }
    if (r === 1 || r === 2) { const di = r - 1; S.queue.push({ pos: spot(DEEP[di][0], DEEP[di][1]), r: 5 + di, k: 0, val: 3, money: true, deep: di }); }
  }
  S.qi = -1; S.started = true; A.whistle(false); nextShot();
}
function nextShot() {
  if (S.clock <= 0) { S.phase = 'done'; return; }
  S.qi++; if (S.qi >= S.queue.length) { S.phase = 'done'; return; }
  const it = S.queue[S.qi], sp = shooter.root.position;
  if (Math.hypot(it.pos.x - sp.x, it.pos.z - sp.z) > 0.3) { S.phase = 'walk'; S.walkTo = it.pos; hand.visible = false; } else pickUp(it);
}
function pickUp(it) {
  if (it.deep != null) S.deepObjs[it.deep].b.visible = false; else S.rackObjs[it.r].balls[it.k].visible = false;
  S.item = it; S.ballMoney = it.money; S.ballVal = it.val; hand.material = it.money ? MONEYM : BALLM; hand.visible = true;
  S.phase = 'pick'; S.tp = 0.32;
}

// ---------- 매 프레임 ----------
const tmp = new THREE.Vector3(), camPos = new THREE.Vector3(0, 6, 16), camLook = new THREE.Vector3(0, 2, 0);
function update(dt) {
  S.t += dt; S.crowd.update(dt); S.netT += dt;
  if (S.fb) S.fb.t += dt;
  const ph = S.phase, sp = shooter.root.position;
  if (ph === 'idle') { const a = S.t * 0.08; smoothV(camPos, tmp.set(Math.sin(a) * 9, 5.5, 9 + Math.cos(a) * 3), 1, dt); smoothV(camLook, tmp.set(0, 2.4, 0), 1, dt); }
  else {
    const dir = new THREE.Vector3(-sp.x, 0, -sp.z).normalize(), sd = new THREE.Vector3(dir.z, 0, -dir.x);
    smoothV(camPos, tmp.set(sp.x - dir.x * 4.6 + sd.x * 0.5, 2.75, sp.z - dir.z * 4.6 + sd.z * 0.5), 3.5, dt);
    smoothV(camLook, tmp.set(sp.x + dir.x * 4.4, 2.45, sp.z + dir.z * 4.4), 3.5, dt);
  }
  // 시계
  const running = S.mode === 'clutch' ? ['live', 'shoot', 'flight'].includes(ph) && !S.timeUp : S.started && ph !== 'choose' && ph !== 'done' && ph !== 'end' && S.clock > 0;
  if (running && S.clock > 0) {
    const before = Math.ceil(S.clock * (S.clock < 10 ? 10 : 1)); S.clock = Math.max(0, S.clock - dt);
    if (S.clock < 5 && Math.ceil(S.clock) < Math.ceil(S.clock + dt) && S.clock > 0) A.tick();
    if (Math.ceil(S.clock * (S.clock < 10 ? 10 : 1)) !== before) redraw(clockTex);
    if (S.clock <= 0) { A.horn(); S.timeUp = true; S.balls.forEach((b) => { if (!b.made && b.floor === 0) b.afterHorn = true; }); redraw(clockTex);
      if (S.mode === 'clutch' && (ph === 'live' || ph === 'shoot')) { hand.visible = true; S.phase = 'over'; fx.say('시간 초과', '공을 놓기 전에 종이 울렸다', '#E23A3A'); A.aw(); setTimeout(() => endPoss('공을 던지기 전에 시간이 끝났다.'), 900); }
    }
  }
  // 슈터 자세
  let pose = P_HOLD, jump = 0, ballL = [0.05, 1.08, 0.32];
  if (ph === 'intro') { S.tp -= dt; if (S.tp <= 0) { S.phase = 'live'; S.timeUp = false; } }
  if (ph === 'between') { S.tp -= dt; if (S.tp <= 0) startPoss(); }
  if (ph === 'shoot') {
    S.st += dt; const t = S.st;
    if (t < 0.16) pose = lerpPose(P_HOLD, P_DIP, t / 0.16); else pose = lerpPose(P_DIP, P_AIR, clamp((t - 0.16) / 0.22, 0, 1));
    jump = Math.max(0, Math.sin(clamp((t - 0.16) / 0.66, 0, 1) * Math.PI)) * 0.42;
    const k = clamp((t - 0.1) / 0.35, 0, 1); ballL = [lerp(0.05, 0.12, k), lerp(1.0, 2.12, k * k * (3 - 2 * k)), lerp(0.32, 0.2, k)];
    if (t >= METER_T * 1.75) release();
  } else if (ph === 'flight' || (S.relT != null && S.relT < 0.9 && (ph === 'pick' || ph === 'ready'))) {
    S.relT = (S.relT || 0) + dt; const t = S.st + S.relT;
    jump = Math.max(0, Math.sin(clamp((t - 0.16) / 0.66, 0, 1) * Math.PI)) * 0.42; pose = jump > 0.02 ? P_AIR : lerpPose(P_DIP, P_HOLD, clamp(S.relT * 3, 0, 1));
  }
  if (S.move) {
    S.move.t += dt; const k = clamp(S.move.t / 0.45, 0, 1), e = 1 - Math.pow(1 - k, 3);
    sp.copy(S.move.from).lerp(S.move.to, e); faceRim(shooter); pose = lerpPose(P_HOLD, P_DIP, Math.sin(k * Math.PI) * 0.6);
    if (k >= 1) { S.move = null; }
  }
  if (ph === 'walk') {
    const to = S.walkTo, d = Math.hypot(to.x - sp.x, to.z - sp.z);
    if (d > 0.05) { const st = Math.min(d, 4.6 * dt); sp.x += ((to.x - sp.x) / d) * st; sp.z += ((to.z - sp.z) / d) * st; shooter.root.rotation.y = Math.atan2(to.x - sp.x, to.z - sp.z); S.wph = (S.wph || 0) + dt * 13; pose = runPose(S.wph, 0.8); ballL = [0.05, 1.1, 0.3]; }
    else { faceRim(shooter); pickUp(S.queue[S.qi]); }
  }
  if (ph === 'pick') { S.tp -= dt; const k = 1 - clamp(S.tp / 0.32, 0, 1); pose = lerpPose(P_DIP, P_HOLD, k); if (S.tp <= 0) S.phase = 'ready'; }
  if (ph === 'flight' && S.mode === 'contest') { S.nextIn -= dt; if (S.nextIn <= 0) nextShot(); }
  shooter.root.position.y = jump;
  setPose(shooter, pose);
  // 공을 쥔 손
  if (hand.visible && ph !== 'walk') {
    const bp = W3(shooter, ballL[0], ballL[1], ballL[2]); hand.position.copy(bp);
    const side = W3(shooter, 1, 0, 0).sub(sp).setY(0).normalize();
    armIK(shooter, 'R', bp.clone().addScaledVector(side, -0.1).add(new THREE.Vector3(0, -0.06, 0)), W3(shooter, -0.6, 0.6, -0.4));
    armIK(shooter, 'L', bp.clone().addScaledVector(side, 0.12), W3(shooter, 0.6, 0.6, -0.4));
  } else if (ph === 'flight' || ph === 'over') {
    armIK(shooter, 'R', W3(shooter, 0.1, 2.38, 0.42), W3(shooter, -0.6, 1.4, -0.3)); armIK(shooter, 'L', W3(shooter, -0.02, 2.2, 0.36), W3(shooter, 0.6, 1.4, -0.3));
  }
  // 수비
  if (defender.root.visible) {
    if (ph === 'live' || ph === 'shoot') { S.defD = Math.max(0.65, S.defD - S.defSp * dt * (ph === 'shoot' ? 0.6 : 1)); }
    placeDef();
    let dp = P_GUARD, dj = 0;
    if (S.defJump >= 0) { S.defJump += dt; const k = clamp((S.defJump - 0.12) / 0.55, 0, 1); dj = Math.sin(k * Math.PI) * 0.45; dp = k > 0 && k < 1 ? P_BLOCK : P_GUARD; }
    else if (ph === 'live') { dp = lerpPose(P_GUARD, runPose(S.t * 12, 0.4), 0.3); }
    defender.root.position.y = dj; setPose(defender, dp);
    S.contest = ph === 'shoot' ? contestLvl() : S.contest;
  }
  // 공
  for (let i = S.balls.length - 1; i >= 0; i--) {
    const b = S.balls[i]; for (let k = 0; k < 4; k++) stepBall(b, dt / 4);
    const done = b.floor >= 2 || b.t > 3.2;
    if (!b.res && (b.made || b.floor >= 1 || b.t > 3)) {
      b.res = true;
      if (!b.made) { if (S.mode === 'clutch') { A.aw(); } else { const r = S.rackRes[b.rack]; if (r) r[b.slot] = 0; } }
      if (S.mode === 'clutch') {
        if (b.made) S.us += b.val;
        S.phase = 'res';
        setTimeout(() => { if (S.phase === 'res') { if (b.made) fx.say(b.val === 3 ? '3점!' : '2점!', S.us > S.them ? '역전' : S.us === S.them ? '동점' : '', '#FFD23F'); else fx.say('안 들어갔다', b.touch ? '림을 맞고 튀었다' : '림에도 못 닿았다', '#F3F2EE'); endPoss(); } }, b.made ? 250 : 400);
      }
    }
    if (done) { scene.remove(b.mesh); S.balls.splice(i, 1); }
  }
  if (S.mode === 'contest' && (ph === 'done' || (S.clock <= 0 && S.started && ph !== 'end')) && !S.balls.some((b) => !b.res)) {
    S.phase = 'end'; hand.visible = false; A.horn(); S.crowd.hype = 1;
    setTimeout(() => G.ui.endEndless(S.score, '25개 랙 + 딥 3점 2개 중 ' + S.made + '개 성공. 최대 40점.'), 1200);
  }
  // 그물 흔들림
  const a = netGeo.attributes.position, k = Math.exp(-S.netT * 3.5) * (S.netT < 2 ? 1 : 0);
  for (let i = 0; i < netBase.length; i++) { const [x, y, z] = netBase[i], j = Math.floor(i / 12), amp = (j / 4) * k; a.setXYZ(i, x * (1 + 0.25 * amp * Math.sin(S.netT * 22)), y - 0.06 * amp * Math.abs(Math.sin(S.netT * 14)), z * (1 + 0.25 * amp * Math.sin(S.netT * 22 + 1))); }
  a.needsUpdate = true;
  S.led.offset.x = (S.t * 0.03) % 1;
  camera.position.copy(camPos); camera.lookAt(camLook);
}
// 공에 랙 번호 붙이기
const _rel = release;
function releaseTagged() {
  const before = S.balls.length; _rel();
  if (S.balls.length > before) { const b = S.balls[S.balls.length - 1]; if (S.mode === 'contest') { b.rack = S.item.r; b.slot = S.item.k; } }
}

// ---------- 중계 그래픽 ----------
function render() {
  V.render();
  const c = H2.ctx, W = H2.W, H = H2.H; c.clearRect(0, 0, W, H);
  if (S.phase === 'idle') return;
  const o = fx.offset(); c.save(); c.translate(o.x, o.y);
  // 슛 미터
  if (S.phase === 'shoot' || (S.fb && S.fb.t < 0.9)) {
    const hp = V.toScreen(shooter.root.position.x, 2.2 + shooter.root.position.y, shooter.root.position.z), x = hp.x + 46, y = hp.y - 20, h = 92, w = 12;
    const fill = S.phase === 'shoot' ? clamp(S.st / METER_T, 0, 1.3) : clamp(1 + S.fb.e, 0, 1.3), win = window_();
    c.fillStyle = 'rgba(12,14,17,.85)'; c.fillRect(x - 3, y - h - 3, w + 6, h * 1.0 + 6 + 10);
    c.fillStyle = 'rgba(61,220,110,.35)'; c.fillRect(x, y - h - h * win * 0.0, w, h * win);
    const hh = Math.min(fill, 1) * h; c.fillStyle = S.fb && S.phase !== 'shoot' ? S.fb.g.col : '#F3F2EE'; c.fillRect(x, y - hh, w, hh);
    if (fill > 1) { c.fillStyle = '#E23A3A'; c.fillRect(x, y - h - (fill - 1) * 30, w, (fill - 1) * 30); }
    c.fillStyle = '#3DDC6E'; c.fillRect(x - 5, y - h - 1.5, w + 10, 3);
  }
  fx.draw(c, W, H);
  c.restore();
  // 슛 결과 판정 (2K 방식 두 줄)
  if (S.fb && S.fb.t < 1.8) {
    const a = Math.min(1, (1.8 - S.fb.t) / 0.3), y = H * 0.7; c.globalAlpha = a;
    c.fillStyle = 'rgba(12,14,17,.88)'; c.fillRect(W / 2 - 120, y, 240, 60);
    c.font = '700 13px "IBM Plex Sans KR"'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#A3ABB3';
    c.fillText('슛 타이밍', W / 2 - 106, y + 18); c.fillText('수비 견제', W / 2 - 106, y + 42);
    c.textAlign = 'right'; c.font = '700 15px "IBM Plex Sans KR"'; c.fillStyle = S.fb.g.col; c.fillText(S.fb.g.n, W / 2 + 106, y + 18);
    c.fillStyle = ['#3DDC6E', '#F3F2EE', '#F0A030', '#E23A3A'][S.fb.c]; c.fillText(CONTEST[S.fb.c], W / 2 + 106, y + 42);
    c.globalAlpha = 1;
  }
  // 수비 거리 표시
  if (defender.root.visible && (S.phase === 'live' || S.phase === 'shoot')) {
    const lv = contestLvl(), p = V.toScreen(defender.root.position.x, 2.3, defender.root.position.z);
    c.font = '700 12px "IBM Plex Sans KR"'; c.textAlign = 'center'; c.fillStyle = 'rgba(12,14,17,.8)'; c.fillRect(p.x - 34, p.y - 12, 68, 20);
    c.fillStyle = ['#3DDC6E', '#F3F2EE', '#F0A030', '#E23A3A'][lv]; c.fillText(CONTEST[lv], p.x, p.y - 1);
  }
  drawBug(c, W, H);
}
function drawBug(c, W, H) {
  const x = 10, y = 10 + G.safeTop, bg = 'rgba(12,14,17,.9)'; c.textBaseline = 'middle';
  if (S.mode === 'clutch') {
    c.fillStyle = bg; c.fillRect(x, y, 214, 40);
    [[HOME, S.us, 0], [AWAY, S.them, 1]].forEach(([t, sc, i]) => { const xx = x + i * 80; c.fillStyle = t.c1; c.fillRect(xx, y, 5, 40); c.font = '700 13px "IBM Plex Sans KR"'; c.textAlign = 'left'; c.fillStyle = '#F3F2EE'; c.fillText(t.ab, xx + 12, y + 20); c.font = '700 24px "Barlow Condensed"'; c.textAlign = 'right'; c.fillText(sc, xx + 72, y + 21); });
    c.fillStyle = '#2A3138'; c.fillRect(x + 160, y + 6, 1, 28);
    c.font = '700 13px "Barlow Condensed"'; c.textAlign = 'left'; c.fillStyle = '#A3ABB3'; c.font = '700 11px "IBM Plex Sans KR"'; c.fillText('4쿼터', x + 168, y + 11);
    c.font = '700 20px "Barlow Condensed"'; c.fillStyle = S.clock < 5 ? '#FF4A3D' : '#F3F2EE'; c.fillText((S.clock || 0).toFixed(1), x + 168, y + 28);
    if (S.spots && S.spots.length > 1) { c.fillStyle = bg; c.fillRect(x, y + 42, 214, 20); c.font = '700 12px "IBM Plex Sans KR"'; c.fillStyle = '#C9CDD1'; c.fillText('공격 ' + Math.min(S.poss + 1, S.spots.length) + ' / ' + S.spots.length + '   ' + S.need + '점 차를 넘겨야 한다', x + 10, y + 52); }
    if (S.stage === 4 && S.phase === 'live' && S.moves === 0) { c.font = '700 15px "IBM Plex Sans KR"'; c.textAlign = 'center'; c.fillStyle = '#F3F2EE'; c.fillText('아래로 당기면 스텝백, 옆으로 밀면 사이드 스텝', W / 2, H * 0.62); }
  } else if (S.mode === 'contest') {
    c.fillStyle = bg; c.fillRect(x, y, 230, 76);
    c.font = '700 12px "IBM Plex Sans KR"'; c.textAlign = 'left'; c.fillStyle = '#A3ABB3'; c.fillText('3점 슛 콘테스트', x + 10, y + 13);
    c.font = '700 30px "Barlow Condensed"'; c.fillStyle = '#FFD23F'; c.fillText(S.score, x + 10, y + 40);
    c.textAlign = 'right'; c.fillStyle = S.clock < 10 ? '#FF4A3D' : '#F3F2EE'; c.fillText(S.clock >= 10 ? Math.ceil(S.clock) : S.clock.toFixed(1), x + 220, y + 40);
    for (let r = 0; r < 5; r++) for (let k = 0; k < 5; k++) {
      const v = S.rackRes[r][k], money = r === S.moneyRack || k === 4, xx = x + 12 + r * 43 + k * 8, yy = y + 64;
      c.fillStyle = v === 1 ? (money ? '#FFD23F' : '#F3F2EE') : v === 0 ? '#E23A3A' : '#39424A';
      c.beginPath(); c.arc(xx, yy, v === 0 ? 2 : 3.2, 0, 6.283); c.fill();
    }
    for (let d = 0; d < 2; d++) { const v = S.rackRes[5 + d][0]; c.fillStyle = v === 1 ? '#FFD23F' : v === 0 ? '#E23A3A' : '#39424A'; c.fillRect(x + 50 + d * 43 - 3, y + 54, 6, 6); }
  }
}

// ---------- 조작 ----------
const ctl = document.getElementById('ctl');
ctl.innerHTML = '<button class="ctl big" id="bShoot">슛</button><div id="choose" style="position:absolute;left:16px;right:16px;bottom:calc(140px + env(safe-area-inset-bottom));display:none;grid-template-columns:repeat(5,1fr);gap:6px;pointer-events:auto"></div>';
const ch = document.getElementById('choose');
['왼쪽 코너', '왼쪽 윙', '탑', '오른쪽 윙', '오른쪽 코너'].forEach((n, i) => { const b = document.createElement('button'); b.className = 'ctl'; b.style.cssText = 'position:static;padding:12px 4px;font-size:13px;line-height:1.3'; b.textContent = n; b.onclick = () => pickMoney(i); ch.appendChild(b); });
const bShoot = document.getElementById('bShoot');
bShoot.addEventListener('pointerdown', (e) => { e.preventDefault(); bShoot.classList.add('down'); try { bShoot.setPointerCapture(e.pointerId); } catch (er) {} press(); });
const up = () => { bShoot.classList.remove('down'); releaseTagged(); };
bShoot.addEventListener('pointerup', up); bShoot.addEventListener('pointercancel', up);
window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); press(); } });
window.addEventListener('keyup', (e) => { if (e.code === 'Space') { e.preventDefault(); releaseTagged(); } });
let sw = null;
hud.addEventListener('pointerdown', (e) => { sw = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
hud.addEventListener('pointerup', (e) => {
  if (!sw || sw.id !== e.pointerId) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
  if (S.mode !== 'clutch' || S.phase !== 'live' || S.move || S.moves >= 2 || Math.hypot(dx, dy) < 40) return;
  const sp = shooter.root.position, dir = new THREE.Vector3(-sp.x, 0, -sp.z).normalize(), side = new THREE.Vector3(dir.z, 0, -dir.x);
  let to;
  if (dy > Math.abs(dx)) { to = sp.clone().addScaledVector(dir, -1.0); S.defD += 1.3; fx.text(H2.W / 2, H2.H * 0.5, '스텝백', '#F3F2EE', 24); }
  else { to = sp.clone().addScaledVector(side, dx > 0 ? -1.0 : 1.0); S.defD += 0.9; fx.text(H2.W / 2, H2.H * 0.5, '사이드 스텝', '#F3F2EE', 24); }
  if (Math.hypot(to.x, to.z) < 2) return;
  to.y = 0; S.move = { from: sp.clone().setY(0), to, t: 0 }; S.moves++; A.squeak();
});

build();
setPose(shooter, P_HOLD); placeAt(spot(0, 5)); hand.visible = false;
G.ui.init({
  key: 'hp', title: '버저비터', tag: '미터 꼭대기에서 손을 뗀다', sheet: '클러치 장면', stages: ST.length,
  endless: '3점 슛 콘테스트', endlessTag: '70초 · 최대 40점', unit: '점',
  win: ['넣긴 넣었다', '침착했다', '완벽한 클러치'], lose: '경기 끝',
  start: begin, idle: () => { S.phase = 'idle'; S.mode = null; A.crowd(0.4); defender.root.visible = false; showChoose(false); S.balls.forEach((b) => scene.remove(b.mesh)); S.balls = []; },
});
G.fonts(() => { redraw(clockTex); G.loop(update, render); });
window.__hp = { S, press, release: releaseTagged, shooter, defender, pickMoney, camera };
