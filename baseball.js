// 9회말 2아웃 · 포수 뒤 시점 타격 (커서를 공에 맞추고 타이밍에 스윙)
import { THREE, D, makeStage, mat, mesh, canvasTex, redraw, glowTex, noise, makeRig, setPose, track, lerpPose, runPose, jointPos, armIK, makeCrowd, standStrip, textPlane, smoothV } from './engine3d.js';
const G = window.G, A = G.audio, fx = G.fx, clamp = G.clamp, lerp = G.lerp;
fx.accent = '#E23A3A'; fx.bannerY = 0.5;

// ---------- 데이터 ----------
const HOME = { name: '한강 수달', ab: '수달', c1: '#B42A2F', c2: '#F2F1EC' };
const AWAY = { name: '남해 돌고래', ab: '돌고래', c1: '#1E3D6B', c2: '#A9AEB3' };
const LINEUP = [['하도윤', 0.284, 7, 2], ['진서강', 0.301, 3, 8], ['유하람', 0.318, 14, 51], ['석태오', 0.276, 27, 33], ['모현우', 0.262, 19, 10], ['표지훈', 0.247, 8, 24], ['길재원', 0.259, 5, 6], ['차온유', 0.233, 2, 14], ['남궁민재', 0.241, 4, 1]];
const PITCHERS = ['도세찬', '엄태빈', '구하진', '왕지석', '설민호', '반이현'];
// [아웃, 주자(1루=1,2루=2,3루=4), 이기는 데 필요한 점수, 투수 등급, 상황, 첫 타자]
const ST = [
  [0, 0, 1, 1, '동점, 선두 타자', 2], [1, 2, 1, 1, '동점, 1아웃 2루', 3], [2, 4, 1, 2, '동점, 2아웃 3루', 4],
  [0, 0, 2, 2, '1점 차, 선두 타자', 0], [1, 1, 2, 2, '1점 차, 1아웃 1루', 2], [2, 3, 2, 3, '1점 차, 2아웃 1·2루', 3],
  [2, 7, 2, 3, '1점 차, 2아웃 만루', 4], [1, 0, 2, 3, '1점 차, 1아웃 주자 없음', 5], [2, 1, 2, 4, '1점 차, 2아웃 1루', 6],
  [0, 0, 3, 4, '2점 차, 선두 타자', 1], [2, 7, 4, 4, '3점 차, 2아웃 만루', 3], [1, 2, 3, 5, '2점 차, 1아웃 2루', 2],
  [2, 0, 1, 5, '동점, 2아웃. 상대 마무리 등판', 8], [2, 3, 3, 6, '2점 차, 2아웃 1·2루', 3], [2, 7, 4, 6, '3점 차, 2아웃 만루. 마지막 승부', 3],
];
const PT = {
  f: { n: '직구', v: [143, 151], bx: 0.03, by: 0.05, hump: 0 }, t: { n: '투심', v: [139, 146], bx: -0.2, by: -0.12, hump: 0 },
  s: { n: '슬라이더', v: [130, 138], bx: 0.32, by: -0.16, hump: 0.02 }, k: { n: '커브', v: [114, 123], bx: 0.2, by: -0.52, hump: 0.34 },
  c: { n: '체인지업', v: [124, 132], bx: -0.16, by: -0.3, hump: 0.08 }, o: { n: '포크', v: [127, 135], bx: 0, by: -0.48, hump: 0.05 },
};
const LV = [null,
  { ts: 1.7, mix: 'f', ball: 0.14, edge: 0.45, assist: 1 }, { ts: 1.6, mix: 'fffc', ball: 0.2, edge: 0.6, assist: 1 },
  { ts: 1.5, mix: 'ffscc', ball: 0.25, edge: 0.75, assist: 0 }, { ts: 1.42, mix: 'fftsskk', ball: 0.28, edge: 0.85, assist: 0 },
  { ts: 1.34, mix: 'fftsskc', ball: 0.3, edge: 0.95, assist: 0 }, { ts: 1.26, mix: 'fftssoock', ball: 0.32, edge: 1, assist: 0 }];
const DERBY = { ts: 1.55, mix: 'f', ball: 0, edge: 0.5, assist: 0, v: [116, 124] };
const BH = 1.83, ZB = 0.2764 * BH, ZT = 0.5635 * BH, ZX = 0.216 + 0.037, ZC = (ZB + ZT) / 2; // ABS 존: 키의 27.64%~56.35%
const BASE = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(19.4, 0, -19.4), new THREE.Vector3(0, 0, -38.8), new THREE.Vector3(-19.4, 0, -19.4)];
const REL = new THREE.Vector3(-0.55, 1.78, -17.1);
const KDRAG = 0.0045, WALLH = 2.8;
const fenceR = (phi) => 99 + 23 * Math.cos(2 * Math.min(45, Math.abs(phi)) * D);
const FIELD = { p: [0, -17.6, 6, 0.3, 'in'], c: [0, 1.1, 5.5, 0.3, 'in'], b1: [18.5, -24, 6.2, 0.35, 'in'], b2: [9.5, -33.5, 6.2, 0.35, 'in'], ss: [-9.5, -33.5, 6.2, 0.35, 'in'], b3: [-18, -23, 6.2, 0.35, 'in'], lf: [-37, -72, 7.6, 0.4, 'out'], cf: [0, -90, 7.8, 0.4, 'out'], rf: [37, -72, 7.6, 0.4, 'out'] };
const FNAME = { p: '투수', c: '포수', b1: '1루수', b2: '2루수', ss: '유격수', b3: '3루수', lf: '좌익수', cf: '중견수', rf: '우익수' };

// ---------- 화면 ----------
const S = { phase: 'idle', bases: [0, 0, 0], outs: 0, balls: 0, strikes: 0, runs: 0, cur: { x: 0, y: ZC }, power: false, t: 0 };
const cv = document.getElementById('cv'), hud = document.getElementById('hud');
const V = makeStage(cv, { fov: 40, exposure: 1.05, envI: 0.25 });
const H2 = G.canvas(hud);
const { scene, camera } = V;

function build() {
  scene.background = canvasTex(4, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#040608'); g.addColorStop(0.6, '#0F1419'); g.addColorStop(1, '#232B33'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  scene.fog = new THREE.Fog('#141A20', 170, 520);
  scene.add(new THREE.HemisphereLight('#C9D4E0', '#1E2E1C', 0.65));
  const sun = new THREE.DirectionalLight('#FFF3DF', 2.4); sun.position.set(25, 70, 30); sun.target.position.set(0, 0, -35);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 200 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight('#DDE6FF', 0.7); fill.position.set(-40, 50, -80); scene.add(fill);
  // 잔디: 깎은 줄무늬
  const grass = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#3B7432'; c.fillRect(0, 0, w, h); c.fillStyle = '#468540'; c.fillRect(0, 0, w, h / 4); c.fillRect(0, h / 2, w, h / 4); noise(c, w, h, 12000, 0.25, ['#2B5A25', '#5B9A4A', '#346D2D']); }, { repeat: [30, 30] });
  const g0 = mesh(new THREE.PlaneGeometry(480, 480), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }), 0, 0, -60, scene, false); g0.rotation.x = -Math.PI / 2;
  const dirt = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#A2683F'; c.fillRect(0, 0, w, h); noise(c, w, h, 9000, 0.35, ['#7E4E2D', '#B8805A', '#93603A']); }, { repeat: [12, 12] });
  const flat = (geo, map, col, k, x, z, rot = 0) => { const m = new THREE.MeshStandardMaterial({ map, color: col || '#FFFFFF', roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -k }); const o = mesh(geo, m, x, 0, z, scene, false); o.rotation.set(-Math.PI / 2, 0, rot); return o; };
  flat(new THREE.CircleGeometry(29, 72), dirt, null, 1, 0, -18.44);
  const inGrass = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#3F7C36'; c.fillRect(0, 0, w, h); c.fillStyle = '#4A8B41'; for (let i = 0; i < 8; i += 2) c.fillRect(0, (i * h) / 8, w, h / 8); noise(c, w, h, 6000, 0.25, ['#2B5A25', '#5B9A4A']); }, { repeat: [4, 4] });
  flat(new THREE.PlaneGeometry(24, 24), inGrass, null, 2, 0, -19.4, Math.PI / 4);
  flat(new THREE.CircleGeometry(4.2, 48), dirt, null, 3, 0, 0);
  for (const b of BASE.slice(1)) flat(new THREE.CircleGeometry(2.6, 32), dirt, null, 3, b.x, b.z);
  const mound = mesh(new THREE.CylinderGeometry(2.74, 2.95, 0.25, 40), new THREE.MeshStandardMaterial({ map: dirt, roughness: 0.95 }), 0, 0.125, -18.44, scene, false);
  mesh(new THREE.BoxGeometry(0.61, 0.04, 0.15), mat('#F4F2EC', 0.6), 0, 0.26, -18.44, scene, false);
  // 석회 선
  const chalk = mat('#F1EFE8', 0.9);
  for (const sg of [1, -1]) { const l = flat(new THREE.PlaneGeometry(0.1, 99), null, '#F1EFE8', 4, sg * 35, -35, -sg * 45 * D); l.position.set(sg * 35, 0, -35); }
  const box = (x) => { for (const [w, h, ox, oz] of [[1.22, 0.07, 0, -0.9], [1.22, 0.07, 0, 0.9], [0.07, 1.8, -0.61, 0], [0.07, 1.8, 0.61, 0]]) flat(new THREE.PlaneGeometry(w, h), null, '#F1EFE8', 4, x + ox, oz); };
  box(-0.98); box(0.98);
  const sh = new THREE.Shape(); sh.moveTo(-0.216, -0.22); sh.lineTo(0.216, -0.22); sh.lineTo(0.216, 0); sh.lineTo(0, 0.21); sh.lineTo(-0.216, 0); sh.closePath();
  const plate = mesh(new THREE.ShapeGeometry(sh), mat('#F6F4EE', 0.6), 0, 0.012, 0, scene, false); plate.rotation.x = Math.PI / 2;
  for (const b of BASE.slice(1)) { const bb = mesh(new THREE.BoxGeometry(0.38, 0.08, 0.38), chalk, b.x, 0.04, b.z, scene); bb.rotation.y = 45 * D; }
  // 담장, 광고, 관중석
  const bnd = [], P = (phi, r) => new THREE.Vector3(Math.sin(phi * D) * r, 0, -Math.cos(phi * D) * r);
  for (let a = -45; a <= 45; a += 1.5) bnd.push(P(a, fenceR(a)));
  const QR = new THREE.Vector3(16, 0, 9), QL = new THREE.Vector3(-16, 0, 9);
  const seg = (a, b, n) => { const o = []; for (let i = 1; i <= n; i++) o.push(a.clone().lerp(b, i / n)); return o; };
  const right = seg(P(45, 99), QR, 40), left = seg(QL, P(-45, 99), 40);
  const ring = [...left, ...bnd, ...right];
  const ads = canvasTex(2048, 128, (c, w, h) => {
    const list = [['참맛 치킨', '#C8281F', '#FFF'], ['푸른생명', '#0F5A4A', '#F2F2EE'], ['한결 타이어', '#1C1C1C', '#F4C531'], ['새벽우유', '#F2F2EE', '#1F4E8C'], ['동네 철물', '#E8742A', '#1C1C1C'], ['바로배송', '#2B3F8C', '#FFF']];
    list.forEach(([t, bg, fg], i) => { const x = (i * w) / list.length; c.fillStyle = bg; c.fillRect(x, 0, w / list.length, h); c.fillStyle = fg; c.font = '700 64px "IBM Plex Sans KR"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, x + w / list.length / 2, h / 2 + 4); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, 0, 3, h); });
  });
  ads.wrapS = THREE.RepeatWrapping;
  const wpos = [], wuv = [], widx = []; let acc = 0;
  ring.forEach((p, i) => { if (i) acc += p.distanceTo(ring[i - 1]); const fh = i >= left.length && i < left.length + bnd.length ? WALLH : 1.6; wpos.push(p.x, 0, p.z, p.x, fh, p.z); wuv.push(acc / 60, 0, acc / 60, 1); if (i) { const k = i * 2; widx.push(k - 2, k, k - 1, k - 1, k, k + 1); } });
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(wuv, 2)); wg.setIndex(widx); wg.computeVertexNormals();
  const wall = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ map: ads, roughness: 0.7, side: THREE.DoubleSide, emissive: '#FFFFFF', emissiveMap: ads, emissiveIntensity: 0.25 })); wall.receiveShadow = true; scene.add(wall);
  const cap = []; ring.forEach((p, i) => { const fh = i >= left.length && i < left.length + bnd.length ? WALLH : 1.6; cap.push(new THREE.Vector3(p.x, fh, p.z)); });
  const ctr = new THREE.Vector3(0, 0, -45);
  const inner = cap.map((p) => { const n = new THREE.Vector3(p.x - ctr.x, 0, p.z - ctr.z).normalize(); return p.clone().add(n.multiplyScalar(1.5)).setY(p.y + 1.2); });
  const outer = cap.map((p) => { const n = new THREE.Vector3(p.x - ctr.x, 0, p.z - ctr.z).normalize(); return p.clone().add(n.multiplyScalar(38)).setY(28); });
  const seats = standStrip(scene, inner, outer, mat('#2E3236', 0.9), 16, 1.25);
  S.crowd = makeCrowd(scene, seats.filter((p) => p.z < 6), { dim: 0.85 });
  const capM = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cap.slice(left.length, left.length + bnd.length)), 120, 0.08, 6), mat('#F4C531', 0.5), 0, 0, 0, scene, false);
  for (const sg of [1, -1]) mesh(new THREE.CylinderGeometry(0.15, 0.15, 18, 8), mat('#F4C531', 0.5), sg * 70.4, 9, -70.4, scene); // 폴대
  // 조명탑
  const glow = new THREE.SpriteMaterial({ map: glowTex('rgba(255,244,220,1)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  for (const a of [-75, -38, 0, 38, 75, -120, 120]) {
    const r = a === 0 ? 175 : Math.abs(a) > 100 ? 70 : 150, p = P(a, r);
    mesh(new THREE.CylinderGeometry(0.5, 0.8, 46, 8), mat('#3A3F44', 0.7), p.x, 23, p.z, scene, false);
    const pan = mesh(new THREE.BoxGeometry(12, 6, 0.6), new THREE.MeshStandardMaterial({ color: '#FFF6E2', emissive: '#FFF1D6', emissiveIntensity: 2.2 }), p.x, 47, p.z, scene, false); pan.lookAt(0, 0, -30);
    const sp = new THREE.Sprite(glow); sp.position.set(p.x, 47, p.z); sp.scale.set(40, 40, 1); scene.add(sp);
  }
  // 전광판
  S.board = textPlane(44, 16, 1100, drawBoard); S.board.position.set(0, 34, -158); scene.add(S.board);
  mesh(new THREE.BoxGeometry(46, 18, 1), mat('#1A1D20', 0.8), 0, 34, -158.6, scene, false);
}

function drawBoard(c, w, h) {
  c.fillStyle = '#07090B'; c.fillRect(0, 0, w, h);
  const ln = S.line || { a: [0, 0, 0, 0, 0, 0, 0, 0, 0], h: [0, 0, 0, 0, 0, 0, 0, 0] };
  c.font = '700 34px "Barlow Condensed"'; c.textBaseline = 'middle'; c.textAlign = 'center';
  const x0 = 210, cw = 64, rows = [['', 0], [AWAY.ab, 1], [HOME.ab, 2]];
  for (let i = 0; i < 9; i++) { c.fillStyle = '#9AA3AB'; c.fillText(i + 1, x0 + i * cw, 46); }
  c.fillStyle = '#FFD23F'; c.fillText('R', x0 + 9 * cw + 20, 46);
  rows.slice(1).forEach(([t, r]) => {
    const y = 46 + r * 62;
    c.textAlign = 'left'; c.fillStyle = '#F3F2EE'; c.font = '700 36px "IBM Plex Sans KR"'; c.fillText(t, 30, y); c.font = '700 40px "Barlow Condensed"'; c.textAlign = 'center';
    const arr = r === 1 ? ln.a : ln.h.concat([S.stage < 0 ? '' : S.runs]);
    let sum = 0; arr.forEach((v, i) => { if (v !== '') sum += v; c.fillStyle = i === 8 && r === 2 ? '#FFD23F' : '#F3F2EE'; c.fillText(v, x0 + i * cw, y); });
    c.fillStyle = '#FFD23F'; c.fillText(sum, x0 + 9 * cw + 20, y);
  });
  c.fillStyle = '#20262C'; c.fillRect(20, 210, w - 40, 3);
  const lamp = (lab, n, on, col, x) => { c.fillStyle = '#9AA3AB'; c.textAlign = 'left'; c.font = '700 36px "Barlow Condensed"'; c.fillText(lab, x, 262); for (let i = 0; i < n; i++) { c.fillStyle = i < on ? col : '#252B31'; c.beginPath(); c.arc(x + 46 + i * 36, 262, 13, 0, 6.283); c.fill(); } };
  lamp('B', 3, S.balls, '#3FBF5F', 30); lamp('S', 2, S.strikes, '#FFD23F', 220); lamp('O', 2, Math.min(2, S.outs), '#E23A3A', 380);
  c.textAlign = 'right'; c.fillStyle = '#F3F2EE'; c.font = '700 40px "Barlow Condensed"';
  c.fillText(S.lastV ? S.lastV + ' km/h' : '', w - 30, 262);
  c.font = '700 34px "IBM Plex Sans KR"'; c.textAlign = 'left'; c.fillStyle = '#F3F2EE';
  const b = S.bat; if (b) c.fillText('타석  ' + b[0] + '  타율 ' + b[1].toFixed(3).slice(1), 30, 340);
  c.textAlign = 'right'; c.fillStyle = '#9AA3AB'; c.fillText(S.stage < 0 ? '홈런 더비' : '9회말', w - 30, 340);
}
const boardUp = () => redraw(S.board.userData.tex);

// ---------- 선수 ----------
const ballM = mat('#F7F5EF', 0.5);
const ball = mesh(new THREE.SphereGeometry(0.037, 14, 10), ballM, 0, -5, 0, scene, true);
const trailG = new THREE.BufferGeometry(); trailG.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30 * 3), 3));
const trail = new THREE.Line(trailG, new THREE.LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.55 })); trail.frustumCulled = false; scene.add(trail);
const kit = (team, o) => Object.assign({ top: team.c2, sleeve: team.c1, arms: 'long', pants: team.c2, socks: team.c1, shoes: '#141414', head: 'cap', headColor: team.c1, numColor: team.c1 }, o);
const batter = makeRig(kit(HOME, { head: 'helmet', num: 51, gloves: '#1C1C1C', h: 1.83 }));
batter.root.position.set(-0.86, 0, 0.05); batter.root.rotation.y = 90 * D; scene.add(batter.root);
const bat = new THREE.Group(); scene.add(bat);
const batG = new THREE.CylinderGeometry(0.033, 0.016, 0.86, 14); batG.translate(0, 0.37, 0);
mesh(batG, mat('#C99A62', 0.42), 0, 0, 0, bat); mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 12), mat('#2A1D12', 0.5), 0, -0.065, 0, bat);
const pitcher = makeRig(kit(AWAY, { num: 21, h: 1.9 })); pitcher.root.position.set(0, 0.25, -18.2); scene.add(pitcher.root);
const glove = (r) => mesh(new THREE.SphereGeometry(0.075, 12, 8), mat('#6E4325', 0.75), 0, -0.06, 0.02, r.J.hnL).scale.set(1, 1.35, 0.6);
glove(pitcher);
const catcher = makeRig(kit(AWAY, { head: 'helmet', headColor: '#1A1A1A', num: 2, h: 1.8 })); catcher.root.position.set(0, 0, 1.0); catcher.root.rotation.y = Math.PI; scene.add(catcher.root);
mesh(new THREE.BoxGeometry(0.3, 0.42, 0.08), mat('#20252B', 0.6), 0, 0.08, 0.12, catcher.J.chest);
mesh(new THREE.BoxGeometry(0.2, 0.22, 0.06), mat('#1A1A1A', 0.4, 0.4), 0, 0.09, 0.12, catcher.J.head);
const cGlove = mesh(new THREE.SphereGeometry(0.11, 12, 8), mat('#5A3720', 0.7), 0, -0.07, 0.02, catcher.J.hnL); cGlove.scale.set(1, 1.2, 0.55);
const ump = makeRig({ top: '#1C2026', arms: 'long', pants: '#55595F', socks: '#1C2026', head: 'cap', headColor: '#1C2026', h: 1.82 }); ump.root.position.set(0.95, 0, 2.5); ump.root.rotation.y = Math.PI; scene.add(ump.root);
const fielders = {};
for (const k in FIELD) { if (k === 'p' || k === 'c') continue; const r = makeRig(kit(AWAY, { num: (Math.random() * 60 + 3) | 0 })); glove(r); r.root.position.set(FIELD[k][0], 0, FIELD[k][1]); scene.add(r.root); fielders[k] = { r, home: new THREE.Vector3(FIELD[k][0], 0, FIELD[k][1]), ph: Math.random() * 6 }; }
fielders.p = { r: pitcher, home: pitcher.root.position.clone(), ph: 0 }; fielders.c = { r: catcher, home: catcher.root.position.clone(), ph: 0 };
const runners = [0, 1, 2, 3].map((i) => { const r = makeRig(kit(HOME, { head: 'helmet', num: 10 + i, h: 1.8 })); r.root.visible = false; scene.add(r.root); return { r, on: false, from: 0, to: 0, t: 0, dist: 0 }; });
const lookAt = (r, x, z) => { r.root.rotation.y = Math.atan2(x - r.root.position.x, z - r.root.position.z); };
for (const k in fielders) if (k !== 'c') lookAt(fielders[k].r, 0, 0);

// 자세
const P_CROUCH = { pos: [0, -0.48, 0], hipL: [-105, 0, 28], hipR: [-105, 0, -28], knL: [135, 0, 0], knR: [135, 0, 0], ftL: [-25, 0, 0], ftR: [-25, 0, 0], spine: [20, 0, 0], shR: [-20, 0, -20], elR: [-60, 0, 0], shL: [-60, 0, 15], elL: [-50, 0, 0] };
const P_UMP = { pos: [0, -0.18, 0], hipL: [-35, 0, 12], hipR: [-35, 0, -12], knL: [45, 0, 0], knR: [45, 0, 0], spine: [32, 0, 0], shL: [10, 0, 10], shR: [10, 0, -10], elL: [-90, 0, 0], elR: [-90, 0, 0] };
const P_READY = { pos: [0, -0.12, 0], hipL: [-30, 0, 12], hipR: [-30, 0, -12], knL: [40, 0, 0], knR: [40, 0, 0], spine: [30, 0, 0], shL: [-50, 0, 10], shR: [-50, 0, -10], elL: [-30, 0, 0], elR: [-30, 0, 0], head: [-20, 0, 0] };
const P_STAND = { shL: [0, 0, 8], shR: [0, 0, -8], elL: [-20, 0, 0], elR: [-20, 0, 0] };
const PK = [ // 투수 와인드업 (초, 자세)
  [0, { shL: [-35, 0, 12], elL: [-95, 0, 0], shR: [-35, 0, -12], elR: [-95, 0, 0] }],
  [0.45, { body: [0, -80, 0], shL: [-40, 0, 10], elL: [-100, 0, 0], shR: [-40, 0, -10], elR: [-100, 0, 0], hipL: [-85, 0, 0], knL: [95, 0, 0], hipR: [-8, 0, 0], knR: [12, 0, 0], pos: [0, -0.02, 0] }],
  [0.85, { body: [0, -75, 0], spine: [5, 0, -8], shL: [-95, 0, 0], elL: [-20, 0, 0], shR: [-10, 0, -95], elR: [-100, 0, 0], hipL: [-20, 0, 55], knL: [25, 0, 0], hipR: [10, 0, -10], knR: [35, 0, 0], pos: [0, -0.18, 0.3] }],
  [1.12, { body: [0, -10, 0], spine: [28, 0, 0], chest: [10, 10, 0], shL: [-30, 0, 35], elL: [-90, 0, 0], shR: [-175, 0, -15], elR: [-35, 0, 0], hipL: [-45, 0, 10], knL: [40, 0, 0], hipR: [25, 0, 0], knR: [60, 0, 0], pos: [0, -0.28, 0.75] }],
  [1.22, { body: [0, 0, 0], spine: [45, 0, 0], chest: [10, 15, 0], shL: [10, 0, 30], elL: [-80, 0, 0], shR: [-80, 0, 20], elR: [-10, 0, 0], hipL: [-50, 0, 8], knL: [40, 0, 0], hipR: [40, 0, 0], knR: [70, 0, 0], pos: [0, -0.3, 0.85] }],
  [1.6, { body: [0, 10, 0], spine: [35, 0, 0], shL: [0, 0, 20], elL: [-90, 0, 0], shR: [-30, 0, 40], elR: [-40, 0, 0], hipL: [-30, 0, 5], knL: [30, 0, 0], hipR: [10, 0, 0], knR: [30, 0, 0], pos: [0, -0.15, 0.8] }],
];
const REL_T = 1.2, WIND_T = 1.6;
// 타자: 몸 자세와 그립 위치(월드), 방망이 끝 방향
const BK = [
  [0, { pos: [0, -0.07, 0], hipL: [-20, 0, 16], hipR: [-20, 0, -16], knL: [30, 0, 0], knR: [30, 0, 0], spine: [16, 0, 0], head: [0, 72, 0] }],
  [0.15, { pos: [0, -0.1, 0.02], hips: [0, -12, 0], hipL: [-30, 0, 20], hipR: [-16, 0, -16], knL: [36, 0, 0], knR: [34, 0, 0], spine: [18, -6, 0], head: [0, 80, 0] }],
  [0.5, { pos: [0, -0.12, 0.05], hips: [0, 42, 0], spine: [22, 26, 0], chest: [4, 14, 0], hipL: [-24, 0, 14], hipR: [-6, 0, -14], knL: [12, 0, 0], knR: [42, 0, 0], ftR: [10, 0, 0], head: [10, 20, 0] }],
  [0.75, { pos: [0, -0.1, 0.05], hips: [0, 62, 0], spine: [18, 36, 0], chest: [0, 18, 0], hipL: [-20, 0, 10], hipR: [0, 0, -10], knL: [8, 0, 0], knR: [50, 0, 0], ftR: [25, 0, 0], head: [0, 0, 0] }],
  [1, { pos: [0, -0.06, 0.04], hips: [0, 72, 0], spine: [8, 40, 0], chest: [-4, 22, 0], hipL: [-12, 0, 8], hipR: [5, 0, -10], knL: [6, 0, 0], knR: [55, 0, 0], ftR: [35, 0, 0], head: [0, -10, 0] }],
];
const BATDIR = [[0, new THREE.Vector3(-0.15, 0.85, 0.5)], [0.15, new THREE.Vector3(-0.1, 0.5, 0.86)], [0.32, new THREE.Vector3(0.3, 0.15, 0.94)], [0.5, new THREE.Vector3(0.97, -0.12, -0.18)], [0.75, new THREE.Vector3(0.15, 0.05, -0.99)], [1, new THREE.Vector3(-0.7, 0.55, -0.45)]].map(([t, v]) => [t, v.normalize()]);
function gripAt(s) {
  const c = S.cur, contact = new THREE.Vector3(c.x - 0.58, c.y + 0.06, 0.1);
  const keys = [[0, new THREE.Vector3(-0.8, 1.42, 0.3)], [0.15, new THREE.Vector3(-0.82, 1.38, 0.4)], [0.32, new THREE.Vector3(-0.72, 1.18, 0.32)], [0.5, contact], [0.75, new THREE.Vector3(-0.38, 1.08, -0.4)], [1, new THREE.Vector3(-0.86, 1.5, -0.2)]];
  return interp(keys, s, (a, b, u) => a.clone().lerp(b, u));
}
function interp(keys, s, f) {
  if (s <= keys[0][0]) return keys[0][1].clone();
  for (let i = 1; i < keys.length; i++) if (s <= keys[i][0]) { let u = (s - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]); u = u * u * (3 - 2 * u); return f(keys[i - 1][1], keys[i][1], u); }
  return keys[keys.length - 1][1].clone();
}
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
function poseBatter(s) {
  setPose(batter, track(BK, s));
  const dir = interp(BATDIR, s, (a, b, u) => a.clone().lerp(b, u).normalize()), grip = gripAt(s);
  bat.position.copy(grip); bat.quaternion.setFromUnitVectors(UP, dir);
  armIK(batter, 'L', grip, grip.clone().add(new THREE.Vector3(0, -1, 0.6)));
  armIK(batter, 'R', grip.clone().addScaledVector(dir, 0.09), grip.clone().add(new THREE.Vector3(0.2, -1, 0.9)));
}

// ---------- 경기 진행 ----------
function lineScore(need) {
  const a = [0, 1, 0, 2, 0, 0, 1, 0, 1], away = 5, home = away - (need - 1), h = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < home; i++) h[(Math.random() * 8) | 0]++;
  return { a, h, away, home };
}
function begin(i) {
  S.stage = i; S.runs = 0; S.sk = 0; S.pitches = 0; S.hrs = 0; S.derbyOuts = 0; S.lastV = 0;
  if (i >= 0) { const st = ST[i]; S.outs = st[0]; S.bases = [st[1] & 1, (st[1] >> 1) & 1, (st[1] >> 2) & 1]; S.need = st[2]; S.lv = LV[st[3]]; S.order = st[5]; S.pName = PITCHERS[st[3] - 1]; S.line = lineScore(st[2]); }
  else { S.outs = 0; S.bases = [0, 0, 0]; S.need = Infinity; S.lv = DERBY; S.order = 3; S.pName = '배팅볼 투수'; S.line = lineScore(1); }
  S.cur = { x: 0, y: ZC }; placeRunners(); newBatter(); S.phase = 'pre'; S.tp = 2.2; S.play = null; S.P = null;
  fx.say(i >= 0 ? '9회말' : '홈런 더비', i >= 0 ? ST[i][4] : '아웃 10개 전에 몇 개를 넘길까');
  A.crowd(1); A.whistle(false); boardUp();
}
function newBatter() {
  S.balls = 0; S.strikes = 0; S.bat = LINEUP[S.order % 9]; S.order++; batter.setNum(S.bat[3]); batter.root.visible = true; bat.visible = true; S.lower = 2.6;
}
function placeRunners() {
  runners.forEach((rn) => { rn.on = false; rn.r.root.visible = false; });
  S.bases.forEach((b, i) => { if (b) { const rn = runners[i]; rn.on = true; rn.base = i + 1; rn.r.root.visible = true; const p = BASE[i + 1]; rn.r.root.position.set(p.x + (i === 0 ? -1.2 : i === 2 ? 1.2 : -1.2), 0, p.z + (i === 1 ? 1 : 0.9)); setPose(rn.r, P_READY); lookAt(rn.r, 0, -19.4); } });
}
function pickPitch() {
  const L = S.lv; let ballP = L.ball;
  if (S.balls === 3 && S.strikes < 2) ballP *= 0.4; if (S.strikes === 2 && S.balls < 3) ballP += 0.15;
  let key = L.mix[(Math.random() * L.mix.length) | 0];
  if (S.balls === 3 && Math.random() < 0.6) key = 'f';
  const ty = PT[key], isBall = Math.random() < ballP, v = L.v ? G.rand(L.v[0], L.v[1]) : G.rand(ty.v[0], ty.v[1]);
  let tx, tyy;
  if (isBall) { const a = Math.random() * 6.283, k = G.rand(1.25, 1.75); tx = Math.cos(a) * ZX * k; tyy = ZC + Math.sin(a) * (ZT - ZB) * 0.5 * k; }
  else { tx = G.rand(-1, 1) * (ZX - 0.03) * L.edge; tyy = ZC + G.rand(-1, 1) * ((ZT - ZB) / 2 - 0.03) * L.edge; }
  const T = (17.4 / (v / 3.6)) * 1.05 * L.ts;
  return { key, ty, v: Math.round(v), tx, ty_: tyy, T, t: 0, swung: false, done: false, zone: Math.abs(tx) <= ZX && tyy >= ZB - 0.037 && tyy <= ZT + 0.037 };
}
function ballAt(P, p, out) {
  const t = P.ty, x = lerp(REL.x, P.tx - t.bx, p) + t.bx * p * p, y = lerp(REL.y, P.ty_ - t.by, p) + t.by * p * p + t.hump * 4 * p * (1 - p);
  return out.set(x, y, lerp(REL.z, 0, p));
}
function swing() {
  if (S.phase !== 'pitch' || S.P.swung) return;
  S.P.swung = true; S.P.pressT = S.P.t; S.swingT = 0; A.whoosh();
}

// 타구 계산
function flight(ev, la, phi) {
  const v = ev / 3.6, p = new THREE.Vector3(S.cur.x * 0.3, S.cur.y, -0.2), vel = new THREE.Vector3(Math.sin(phi * D) * Math.cos(la * D), Math.sin(la * D), -Math.cos(phi * D) * Math.cos(la * D)).multiplyScalar(v);
  const path = [], dt = 1 / 60; let air = true, hr = false, wall = false, t = 0, landT = null, land = null;
  for (let i = 0; i < 60 * 9; i++) {
    path.push({ t, x: p.x, y: p.y, z: p.z, air });
    const sp = vel.length();
    vel.x -= KDRAG * sp * vel.x * dt; vel.z -= KDRAG * sp * vel.z * dt; vel.y += (-9.8 - KDRAG * sp * vel.y) * dt;
    p.addScaledVector(vel, dt); t += dt;
    const r = Math.hypot(p.x, p.z), ph = (Math.atan2(p.x, -p.z) / D);
    if (Math.abs(ph) <= 45 && r >= fenceR(ph) && !hr && !wall) {
      if (p.y > WALLH + 0.05) { hr = true; landT = landT == null ? t : landT; }
      else { wall = true; const n = new THREE.Vector3(p.x, 0, p.z).normalize(), vn = vel.dot(n); vel.addScaledVector(n, -1.4 * vn); vel.multiplyScalar(0.5); }
    }
    if (hr && (p.y < 4 || r > fenceR(ph) + 30)) break;
    if (p.y < 0.037) {
      p.y = 0.037; if (air) { air = false; landT = t; land = p.clone(); }
      if (vel.y < -1.5) { vel.y = -vel.y * 0.36; vel.x *= 0.72; vel.z *= 0.72; } else { vel.y = 0; const hs = Math.hypot(vel.x, vel.z); if (hs < 0.3) break; const k = Math.max(0, hs - 4.2 * dt) / hs; vel.x *= k; vel.z *= k; }
    }
  }
  return { path, hr, wall, landT, land, phi };
}
function intercept(F) {
  let best = null;
  for (const k in FIELD) {
    const [fx_, fz, sp, react, kind] = FIELD[k];
    if (F.hr) continue;
    for (const s of F.path) {
      if (s.t < 0.15) continue;
      const hmax = s.air ? (kind === 'in' ? 2.3 : 2.9) : 1.0; if (s.y > hmax) continue;
      const reach = s.air ? (kind === 'in' ? 1.2 : 1.8) : 1.0, need = Math.hypot(s.x - fx_, s.z - fz) - reach;
      if (react + Math.max(0, need) / sp <= s.t) { if (!best || s.t < best.t) best = { k, t: s.t, s, kind, air: s.air }; break; }
    }
  }
  return best;
}
function judge(ev, la, phi, Q) {
  const F = flight(ev, la, phi), foul = Math.abs(phi) > 45;
  const res = { F, phi, la, ev };
  if (foul) {
    const I = la > 35 ? intercept(F) : null;
    if (I && I.air && Math.hypot(I.s.x, I.s.z) < 45) return Object.assign(res, { type: 'out', why: FNAME[I.k] + ' 파울 플라이', I });
    return Object.assign(res, { type: 'foul' });
  }
  if (F.hr) return Object.assign(res, { type: 'hr' });
  const I = intercept(F);
  const ld = F.land ? Math.hypot(F.land.x, F.land.z) : 0;
  if (I && I.air) {
    const name = FNAME[I.k] + (la < 18 ? ' 직선타' : FIELD[I.k][4] === 'out' ? ' 뜬공' : ' 플라이');
    return Object.assign(res, { type: 'out', why: name, I, sac: FIELD[I.k][4] === 'out' && Math.hypot(I.s.x, I.s.z) > 62 });
  }
  if (I && FIELD[I.k][4] === 'in') {
    const p = new THREE.Vector3(I.s.x, 0, I.s.z), toFirst = I.k === 'b1' ? Math.max(0, p.distanceTo(BASE[1]) - 1) / 6.8 + 0.2 : 0.55 + p.distanceTo(BASE[1]) / 32;
    const tOut = I.t + toFirst, runner = 1.05 + 27.43 / 7.4;
    if (tOut < runner) {
      const at2 = I.t + 0.45 + p.distanceTo(BASE[2]) / 32, dp = S.bases[0] && S.outs < 2 && ev > 135 && at2 < 2.9 && at2 + 0.5 + 27.43 / 32 < runner;
      return Object.assign(res, { type: dp ? 'dp' : 'out', why: FNAME[I.k] + (dp ? ' 병살타' : ' 땅볼'), I, throwTo: 1, tOut });
    }
    return Object.assign(res, { type: 'h1', why: '내야 안타', I });
  }
  let bases = 1;
  if (F.wall) bases = Math.abs(phi) > 12 && Math.abs(phi) < 36 && fenceR(phi) > 110 && Math.random() < 0.3 ? 3 : 2;
  else if (ld > 76 && (!I || I.t - F.landT > 1.1)) bases = 2;
  else if (!F.land && I && I.t > 3.8 && Math.abs(phi) > 30) bases = 2;
  return Object.assign(res, { type: 'h' + bases, why: bases === 3 ? '3루타' : bases === 2 ? (F.wall ? '담장 맞는 2루타' : '2루타') : '안타', I });
}
function contact(dtm, d, R) {
  const P = S.P, tq = 1 - Math.abs(dtm) / 0.085, pq = 1 - d / (R + 0.037), Q = clamp(0.55 * tq + 0.45 * pq, 0, 1);
  const nY = clamp((S.cur.y - P.ty_) / (R + 0.037), -1, 1);
  let la = 15 - nY * 40 + G.rand(-5, 5), ev = S.power ? 120 + 62 * Math.pow(Q, 0.9) : 108 + 56 * Math.pow(Q, 0.9);
  if (Math.abs(nY) > 0.7) ev *= 0.85;
  let phi = (dtm / 0.085) * 42 + (P.tx - S.cur.x) * 30 + G.rand(-6, 6);
  if (pq < 0.12) { phi = G.rand(-1, 1) > 0 ? 160 : -160; la = G.rand(30, 60); ev = 90; }
  const r = judge(ev, la, phi, Q);
  S.play = Object.assign(r, { t: 0, Q, done: false });
  S.phase = 'play';
  A.crack(Q); fx.shake(0.12 + 0.4 * Q * Q); if (Q > 0.72) G.hitStop(40 + 70 * Q);
  S.lastEv = Math.round(ev); S.lastLa = Math.round(la);
  if (r.type !== 'foul') { batter.root.visible = false; bat.visible = false; const rn = runners[3]; rn.r.root.visible = true; rn.r.root.position.set(-0.86, 0, 0.05); rn.on = true; rn.base = 0; rn.r.setNum(S.bat[3]); }
  planRunners(r);
  S.crowd.hype = r.type === 'hr' ? 1 : Q > 0.6 ? 0.5 : 0.2;
  if (r.type === 'hr') A.cheer(1.6);
}
// 주자 이동 계획: 각 주자 to = 도착 루(4 = 홈)
function planRunners(r) {
  const b = S.bases, two = S.outs === 2, n = r.type === 'hr' ? 4 : r.type[0] === 'h' ? +r.type[1] : 0;
  const moves = [];
  if (n === 4) { for (let i = 0; i < 3; i++) if (b[i]) moves.push([i + 1, 4]); moves.push([0, 4]); }
  else if (n > 0) {
    if (b[2]) moves.push([3, 4]);
    if (b[1]) moves.push([2, n >= 2 || two || Math.random() < 0.6 ? 4 : 3]);
    if (b[0]) moves.push([1, n >= 3 ? 4 : n === 2 ? (two && Math.random() < 0.6 ? 4 : 3) : two && Math.random() < 0.3 ? 3 : 2]);
    moves.push([0, n]);
  } else if (r.type === 'out' && r.sac && b[2] && S.outs < 2) moves.push([3, 4]);
  else if ((r.type === 'out' || r.type === 'dp') && r.throwTo && S.outs + (r.type === 'dp' ? 2 : 1) < 3) {
    if (b[2] && Math.random() < 0.5) moves.push([3, 4]);
    if (b[1]) moves.push([2, 3]);
    if (b[0] && r.type !== 'dp') moves.push([1, 2]);
    moves.push([0, 1]);
  } else if (r.type === 'out' || r.type === 'dp') moves.push([0, 1]);
  S.moves = moves;
  for (const [from, to] of moves) {
    const rn = from === 0 ? runners[3] : runners[from - 1];
    rn.from = from; rn.to = to; rn.t = 0; rn.prog = 0; rn.go = from === 0 ? 0.45 : 0.15; rn.out = false;
  }
}
const basePos = (i) => BASE[i % 4];
function runnerAt(rn, dist) { // dist: 출발 루에서 달린 거리(m)
  let i = rn.from, d = dist;
  while (i < rn.to) { const L = basePos(i).distanceTo(basePos(i + 1)); if (d <= L) return basePos(i).clone().lerp(basePos(i + 1), d / L); d -= L; i++; }
  return basePos(rn.to).clone();
}
function settle(r) {
  const n = r.type === 'hr' ? 4 : r.type[0] === 'h' ? +r.type[1] : 0;
  let runs = 0; const nb = [0, 0, 0], moved = new Set();
  for (const [from, to] of S.moves) { moved.add(from); if (to >= 4) runs++; else if (!(from === 0 && (r.type === 'out' || r.type === 'dp'))) nb[to - 1] = 1; }
  for (let i = 0; i < 3; i++) if (S.bases[i] && !moved.has(i + 1)) nb[i] = 1;
  if (r.type === 'dp') { for (let i = 0; i < 3; i++) if (S.bases[i] && i === 0) nb[i] = 0; }
  return { runs, nb, n };
}

function resolvePlay(r) {
  if (S.stage < 0) return resolveDerby(r);
  if (r.type === 'foul') { if (S.strikes < 2) S.strikes++; S.sk++; fx.say('파울', '', '#F3F2EE'); return toCall(1.2); }
  const st = settle(r);
  if (r.type === 'out' || r.type === 'dp') {
    const add = r.type === 'dp' ? 2 : 1; S.outs += add;
    if (S.outs < 3) { S.runs += st.runs; S.bases = st.nb; }
    fx.say(r.type === 'dp' ? '병살' : '아웃', r.why + (st.runs && S.outs < 3 ? ', ' + st.runs + '점' : ''), '#F3F2EE'); A.aw();
  } else {
    S.runs += st.runs; S.bases = st.nb;
    const t = r.type === 'hr' ? '홈런!' : r.type === 'h3' ? '3루타!' : r.type === 'h2' ? '2루타!' : '안타!';
    fx.say(t, (r.type === 'hr' ? '비거리 ' + Math.round(Math.hypot(r.F.path[r.F.path.length - 1].x, r.F.path[r.F.path.length - 1].z)) + 'm' : r.why) + (st.runs ? ' · ' + st.runs + '점' : ''), '#FFD23F');
    A.cheer(r.type === 'hr' ? 1.6 : 1);
  }
  newBatter(); toCall(1.6);
}
function resolveDerby(r) {
  if (r.type === 'hr') { S.hrs++; const e = r.F.path[r.F.path.length - 1]; fx.say('홈런!', '비거리 ' + Math.round(Math.hypot(e.x, e.z)) + 'm', '#FFD23F'); A.cheer(1.6); }
  else { S.derbyOuts++; fx.say('아웃 ' + S.derbyOuts, r.type === 'foul' ? '파울' : r.why || '담장을 못 넘겼다', '#F3F2EE'); }
  S.bases = [0, 0, 0]; newBatter(); S.order--; batter.setNum(S.bat[3]); toCall(1.4);
}
function walk() { const b = S.bases; if (b[0]) { if (b[1]) { if (b[2]) S.runs++; b[2] = 1; } b[1] = 1; } b[0] = 1; }
function resolvePitch() { // 안 치거나 헛친 공
  const P = S.P;
  if (S.stage < 0) { if (P.swung || P.zone) { S.derbyOuts++; fx.say('아웃 ' + S.derbyOuts, P.swung ? '헛스윙' : '그냥 보냈다', '#F3F2EE'); } newBatter(); S.order--; batter.setNum(S.bat[3]); return toCall(1.1); }
  if (P.swung || P.zone) {
    S.strikes++; S.sk++;
    if (S.strikes >= 3) { S.outs++; fx.say('삼진', P.swung ? '헛스윙 삼진' : '서서 당한 삼진', '#F3F2EE'); A.aw(); newBatter(); }
    else fx.say('스트라이크', P.swung ? '헛스윙' : P.ty.n + '가 존에 들어왔다', '#F3F2EE');
  } else {
    S.balls++;
    if (S.balls >= 4) { walk(); fx.say('볼넷', '걸어서 1루로', '#F3F2EE'); newBatter(); placeRunners(); }
    else fx.say('볼', '잘 골라냈다', '#F3F2EE');
  }
  toCall(1.2);
}
function toCall(t) { S.phase = 'call'; S.tp = t; boardUp(); }
function afterCall() {
  if (S.stage >= 0 && S.runs >= S.need) {
    S.phase = 'end'; A.whistle(true); A.cheer(2); S.crowd.hype = 1;
    return G.ui.endStage(S.stage, S.sk <= 1 ? 3 : S.sk <= 3 ? 2 : 1, '끝내기. 스트라이크는 ' + S.sk + '개만 먹었다.');
  }
  if (S.stage >= 0 && S.outs >= 3) { S.phase = 'end'; return G.ui.endStage(S.stage, 0, '세 번째 아웃. 경기가 끝났다.'); }
  if (S.stage < 0 && S.derbyOuts >= 10) { S.phase = 'end'; return G.ui.endEndless(S.hrs, '아웃 10개 동안 ' + S.hrs + '개를 넘겼다.'); }
  placeRunners(); runners[3].r.root.visible = false; runners[3].on = false;
  batter.root.visible = true; bat.visible = true;
  S.P = null; S.play = null; S.phase = 'pre'; S.tp = 1.0;
}

// ---------- 매 프레임 ----------
const tmp = new THREE.Vector3(), camPos = new THREE.Vector3(0.28, 1.95, 4.6), camLook = new THREE.Vector3(0, 1.0, -14);
const CAM_BAT = [new THREE.Vector3(0.1, 3.0, 7.2), new THREE.Vector3(0, -0.4, -12)];
function update(dt) {
  S.t += dt; S.crowd.update(dt);
  if (S.lower > 0) S.lower -= dt;
  if (S.pinfo > 0) S.pinfo -= dt;
  const ph = S.phase;
  if (ph === 'idle' || ph === 'end') {
    const a = S.t * 0.05; smoothV(camPos, tmp.set(Math.sin(a) * 30, 14, 26 + Math.cos(a) * 6), 1, dt); smoothV(camLook, tmp.set(0, 2, -40), 1, dt);
  } else if (ph !== 'play') { smoothV(camPos, CAM_BAT[0], 5, dt); smoothV(camLook, CAM_BAT[1], 5, dt); }
  // 투수
  if (ph === 'pre') { S.tp -= dt; setPose(pitcher, PK[0][1]); if (S.tp <= 0) { S.phase = 'windup'; S.wt = 0; S.P = pickPitch(); } }
  else if (ph === 'windup') {
    S.wt += dt; setPose(pitcher, track(PK, S.wt));
    if (S.wt >= REL_T) { S.phase = 'pitch'; S.pitches++; A.whoosh(); }
  } else if (ph === 'pitch') {
    S.wt += dt; setPose(pitcher, track(PK, Math.min(S.wt, WIND_T)));
    const P = S.P; P.t += dt; const p = P.t / P.T;
    ballAt(P, Math.min(p, 1.065), ball.position); ball.visible = true; ball.scale.setScalar(1.25);
    if (P.swung && !P.done && P.t >= P.pressT + 0.12) {
      P.done = true; const dtm = P.pressT + 0.12 - P.T, R = S.power ? 0.115 : 0.16, d = Math.hypot(S.cur.x - P.tx, S.cur.y - P.ty_);
      if (Math.abs(dtm) <= 0.085 && d <= R + 0.037) contact(dtm, d, R); else P.miss = true;
    }
    if (S.phase === 'pitch' && p >= 1.065) {
      A.mitt(); S.lastV = P.v; S.pinfo = 2.6; ball.visible = false; resolvePitch();
    }
  } else if (ph === 'play') {
    const r = S.play; r.t += dt * 1.35;
    const path = r.F.path, i = Math.min(path.length - 1, Math.floor(r.t * 60)), s = path[i];
    let bpos = tmp.set(s.x, s.y, s.z);
    const I = r.I;
    if (I && r.t >= I.t) {
      const f = fielders[I.k]; const gp = jointPos(f.r, 'hnL', new THREE.Vector3(), 0, -0.06, 0);
      if (r.throwTo && r.t >= I.t + 0.4) { const k = clamp((r.t - I.t - 0.4) / (r.tOut - I.t - 0.4 || 0.6), 0, 1); bpos = gp.lerp(new THREE.Vector3(BASE[1].x, 1.2, BASE[1].z), k); }
      else bpos = gp;
      if (!r.caught) { r.caught = true; A.mitt(); }
    }
    ball.position.copy(bpos); ball.visible = true; ball.scale.setScalar(clamp(camera.position.distanceTo(bpos) / 20, 1, 4));
    pushTrail(bpos);
    // 수비수
    for (const k in fielders) {
      if (k === 'c' || k === 'p') continue;
      const f = fielders[k];
      if (I && I.k === k) {
        const goal = new THREE.Vector3(I.s.x, 0, I.s.z), d = f.r.root.position.distanceTo(goal), react = FIELD[k][3];
        if (r.t > react && d > 0.6) { lookAt(f.r, goal.x, goal.z); const step = Math.min(d, FIELD[k][2] * dt * 1.35); f.r.root.position.addScaledVector(goal.sub(f.r.root.position).normalize(), step); f.ph += dt * 14; setPose(f.r, runPose(f.ph, 1)); }
        else { lookAt(f.r, 0, 0); setPose(f.r, r.t >= I.t ? lerpPose(P_READY, { shL: [-150, 0, 10], elL: [-10, 0, 0], shR: [-60, 0, -20], elR: [-60, 0, 0] }, 0.8) : P_READY); }
      } else { setPose(f.r, P_STAND); lookAt(f.r, s.x, s.z); }
    }
    // 주자
    for (const rn of runners) {
      if (!rn.on || rn.to == null || rn.to === rn.from) continue;
      if (r.t < rn.go) continue;
      rn.prog = Math.min(rn.prog + 7.4 * dt * 1.35, (rn.to - rn.from) * 27.43);
      const pos = runnerAt(rn, rn.prog); rn.r.root.position.set(pos.x, 0, pos.z);
      const nxt = runnerAt(rn, rn.prog + 0.5); if (nxt.distanceTo(pos) > 0.01) lookAt(rn.r, nxt.x, nxt.z);
      if (rn.prog < (rn.to - rn.from) * 27.43) { rn.ph = (rn.ph || 0) + dt * 15; setPose(rn.r, runPose(rn.ph, 1)); } else { setPose(rn.r, P_STAND); if (rn.to >= 4) rn.r.root.visible = false; }
    }
    // 카메라: 홈 뒤 높은 곳에서 공을 따라간다
    const far = Math.hypot(s.x, s.z);
    smoothV(camPos, tmp.set(s.x * 0.35, 6 + Math.min(far, 120) * 0.12 + s.y * 0.3, 10 + s.z * 0.3), 2.6, dt);
    smoothV(camLook, new THREE.Vector3(s.x, Math.max(0.5, s.y * 0.8), s.z), 4, dt);
    const endT = r.type === 'foul' ? 1.3 : r.type === 'hr' ? (r.F.landT || path[path.length - 1].t) + 1.6 : Math.max(I ? I.t + (r.throwTo ? r.tOut - I.t : 0) + 0.9 : (r.F.landT || 2) + 1.2, maxRunT(r)) ;
    if (r.t >= Math.min(endT, 8.5)) { ball.visible = false; clearTrail(); resolvePlay(r); }
  } else if (ph === 'call') {
    S.tp -= dt; if (S.tp <= 0) afterCall();
    setPose(pitcher, PK[0][1]);
  }
  // 타자
  if (batter.root.visible) {
    let s = 0;
    if (ph === 'pitch' && S.P) { s = S.P.swung ? 0 : clamp(S.P.t / S.P.T, 0, 1) * 0.15; }
    if (S.P && S.P.swung && (ph === 'pitch' || ph === 'play' || ph === 'call')) { S.swingT += dt; s = S.swingT < 0.12 ? lerp(0.15, 0.5, S.swingT / 0.12) : Math.min(1, 0.5 + (S.swingT - 0.12) / 0.26 * 0.5); }
    poseBatter(s);
  }
  // 포수와 심판
  setPose(catcher, P_CROUCH); setPose(ump, P_UMP);
  if (S.P && (ph === 'pitch' || ph === 'windup')) {
    const gx = ph === 'pitch' ? lerp(0, S.P.tx, clamp(S.P.t / S.P.T * 1.4, 0, 1)) : S.P.tx * 0.6, gy = ph === 'pitch' ? lerp(ZC, S.P.ty_, clamp(S.P.t / S.P.T * 1.4, 0, 1)) : ZC;
    armIK(catcher, 'L', tmp.set(gx + 0.02, gy - 0.02, 0.62), new THREE.Vector3(1, 0, 2));
  }
  camera.position.copy(camPos); camera.lookAt(camLook);
}
function maxRunT(r) { let m = 0; for (const [from, to] of S.moves || []) m = Math.max(m, (from === 0 ? 0.45 : 0.15) + ((to - from) * 27.43) / 7.4); return Math.min(m, 7); }
const tbuf = [];
function pushTrail(p) { tbuf.push(p.clone()); if (tbuf.length > 30) tbuf.shift(); const a = trailG.attributes.position; for (let i = 0; i < 30; i++) { const q = tbuf[Math.max(0, tbuf.length - 30 + i)] || p; a.setXYZ(i, q.x, q.y, q.z); } a.needsUpdate = true; trail.visible = true; }
function clearTrail() { tbuf.length = 0; trail.visible = false; }

// ---------- 중계 그래픽 ----------
function render() {
  V.render();
  const c = H2.ctx, W = H2.W, H = H2.H; c.clearRect(0, 0, W, H);
  if (S.phase === 'idle') return;
  const o = fx.offset(); c.save(); c.translate(o.x, o.y);
  const playing = S.phase === 'pre' || S.phase === 'windup' || S.phase === 'pitch';
  // 스트라이크 존과 타격 커서
  if (playing || S.phase === 'call') {
    const tl = V.toScreen(-ZX, ZT, 0), br = V.toScreen(ZX, ZB, 0);
    c.strokeStyle = 'rgba(243,242,238,.55)'; c.lineWidth = 1.5; c.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    c.strokeStyle = 'rgba(243,242,238,.18)'; c.beginPath();
    for (let i = 1; i < 3; i++) { const x = tl.x + ((br.x - tl.x) * i) / 3, y = tl.y + ((br.y - tl.y) * i) / 3; c.moveTo(x, tl.y); c.lineTo(x, br.y); c.moveTo(tl.x, y); c.lineTo(br.x, y); }
    c.stroke();
    if (S.phase === 'call' && S.P && !S.play) { const m = V.toScreen(S.P.tx, S.P.ty_, 0); c.fillStyle = S.P.zone ? '#FFD23F' : '#F3F2EE'; c.beginPath(); c.arc(m.x, m.y, Math.max(4, (br.x - tl.x) * 0.074), 0, 6.283); c.fill(); c.strokeStyle = '#0E1114'; c.lineWidth = 2; c.stroke(); }
  }
  if (playing) {
    const R = S.power ? 0.115 : 0.16, cc = V.toScreen(S.cur.x, S.cur.y, 0), ce = V.toScreen(S.cur.x + R, S.cur.y, 0), rr = Math.abs(ce.x - cc.x);
    const sw = S.P && S.P.swung;
    c.strokeStyle = sw ? '#FFD23F' : 'rgba(255,255,255,.95)'; c.lineWidth = 3; c.beginPath(); c.arc(cc.x, cc.y, rr, 0, 6.283); c.stroke();
    c.strokeStyle = 'rgba(14,17,20,.6)'; c.lineWidth = 1.5; c.beginPath(); c.arc(cc.x, cc.y, rr + 2.5, 0, 6.283); c.stroke();
    c.fillStyle = sw ? '#FFD23F' : '#FFFFFF'; c.fillRect(cc.x - 7, cc.y - 1, 14, 2); c.fillRect(cc.x - 1, cc.y - 7, 2, 14);
    if (S.lv.assist && S.phase === 'pitch' && S.P) {
      const p = S.P.t / S.P.T;
      if (p > 0.45 && p < 1.02) { const m = V.toScreen(S.P.tx, S.P.ty_, 0), k = clamp((1 - p) / 0.55, 0, 1); c.strokeStyle = '#FFD23F'; c.lineWidth = 2.5; c.beginPath(); c.arc(m.x, m.y, rr * 0.3 + rr * 1.6 * k, 0, 6.283); c.stroke(); }
    }
  }
  fx.draw(c, W, H);
  c.restore();
  drawBug(c, W, H);
}
function drawBug(c, W, H) {
  const x = 10, y = 10 + G.safeTop, bg = 'rgba(12,14,17,.9)';
  c.textBaseline = 'middle';
  if (S.stage >= 0) {
    c.fillStyle = bg; c.fillRect(x, y, 196, 58);
    [[AWAY, S.line.away, 0], [HOME, S.line.home + S.runs, 1]].forEach(([t, sc, i]) => {
      const yy = y + 15 + i * 28; c.fillStyle = t.c1; c.fillRect(x, yy - 12, 5, 24);
      c.font = '700 14px "IBM Plex Sans KR"'; c.textAlign = 'left'; c.fillStyle = '#F3F2EE'; c.fillText(t.ab, x + 13, yy);
      c.font = '700 24px "Barlow Condensed"'; c.textAlign = 'right'; c.fillText(sc, x + 104, yy + 1);
    });
    c.fillStyle = '#2A3138'; c.fillRect(x + 112, y + 6, 1, 46);
    c.font = '700 20px "Barlow Condensed"'; c.textAlign = 'left'; c.fillStyle = '#F3F2EE'; c.fillText('9', x + 120, y + 17);
    c.fillStyle = '#FFD23F'; c.beginPath(); c.moveTo(x + 133, y + 13); c.lineTo(x + 143, y + 13); c.lineTo(x + 138, y + 20); c.fill();
  } else {
    c.fillStyle = bg; c.fillRect(x, y, 196, 58);
    c.font = '700 13px "IBM Plex Sans KR"'; c.textAlign = 'left'; c.fillStyle = '#A3ABB3'; c.fillText('홈런', x + 12, y + 16); c.fillText('아웃', x + 62, y + 16);
    c.font = '700 26px "Barlow Condensed"'; c.fillStyle = '#FFD23F'; c.fillText(S.hrs, x + 12, y + 40); c.fillStyle = '#F3F2EE'; c.fillText(S.derbyOuts + '/10', x + 62, y + 40);
  }
  // 베이스와 아웃
  const dx = x + 172, dy = y + 22;
  [[1, 0, 0], [0, -1, 1], [-1, 0, 2]].forEach(([a, b2, i]) => { c.save(); c.translate(dx + a * 10, dy + b2 * 10); c.rotate(0.785); c.fillStyle = S.bases[i] ? '#FFD23F' : '#39424A'; c.fillRect(-5.5, -5.5, 11, 11); c.restore(); });
  if (S.stage >= 0) for (let i = 0; i < 2; i++) { c.fillStyle = i < Math.min(2, S.outs) ? '#E23A3A' : '#39424A'; c.beginPath(); c.arc(x + 126 + i * 13, y + 42, 4.5, 0, 6.283); c.fill(); }
  c.font = '700 17px "Barlow Condensed"'; c.textAlign = 'left'; c.fillStyle = '#F3F2EE'; c.fillText(S.balls + '-' + S.strikes, x + 156, y + 44);
  // 구종과 구속
  if (S.pinfo > 0 && S.P) {
    const a = Math.min(1, S.pinfo / 0.3); c.globalAlpha = a;
    const t = S.P.ty.n, w = 150, xx = W - w - 10, yy = y + 52;
    c.fillStyle = bg; c.fillRect(xx, yy, w, 44); c.fillStyle = '#E23A3A'; c.fillRect(xx, yy, 4, 44);
    c.textAlign = 'left'; c.font = '700 14px "IBM Plex Sans KR"'; c.fillStyle = '#F3F2EE'; c.fillText(t, xx + 14, yy + 22);
    c.textAlign = 'right'; c.font = '700 24px "Barlow Condensed"'; c.fillText(S.P.v, xx + w - 42, yy + 23); c.font = '700 13px "Barlow Condensed"'; c.fillStyle = '#A3ABB3'; c.fillText('km/h', xx + w - 10, yy + 24);
    c.globalAlpha = 1;
  }
  // 타자 소개 자막
  if (S.lower > 0 && S.bat && S.phase !== 'play') {
    const a = Math.min(1, S.lower / 0.3, (2.6 - S.lower) / 0.25), b = S.bat; c.globalAlpha = Math.max(0, a);
    const yy = H * 0.8; c.fillStyle = bg; c.fillRect(0, yy, 230, 56); c.fillStyle = HOME.c1; c.fillRect(0, yy, 6, 56);
    c.textAlign = 'left'; c.font = '700 13px "IBM Plex Sans KR"'; c.fillStyle = '#A3ABB3'; c.fillText(S.stage < 0 ? '홈런 더비' : ((S.order - 1) % 9) + 1 + '번 타자 · ' + b[3], 16, yy + 17);
    c.font = '20px "Black Han Sans"'; c.fillStyle = '#F3F2EE'; c.fillText(b[0], 16, yy + 39);
    c.font = '700 15px "Barlow Condensed"'; c.textAlign = 'right'; c.fillText('AVG ' + b[1].toFixed(3).slice(1) + '  HR ' + b[2], 220, yy + 40);
    c.globalAlpha = 1;
  }
  if (S.phase === 'play' && S.lastEv && S.play.type !== 'foul') {
    const yy = H * 0.8; c.fillStyle = bg; c.fillRect(0, yy, 170, 38);
    c.font = '700 13px "IBM Plex Sans KR"'; c.textAlign = 'left'; c.fillStyle = '#A3ABB3'; c.fillText('타구 속도', 12, yy + 19);
    c.font = '700 20px "Barlow Condensed"'; c.fillStyle = '#F3F2EE'; c.fillText(S.lastEv + ' km/h  ' + S.lastLa + '°', 74, yy + 20);
  }
}

// ---------- 조작 ----------
const ctl = document.getElementById('ctl');
ctl.innerHTML = '<button class="ctl big" id="bSwing">스윙</button><button class="ctl small" id="bMode"></button>';
const bSwing = document.getElementById('bSwing'), bMode = document.getElementById('bMode');
const setMode = () => { bMode.innerHTML = '<small>스윙 종류</small>' + (S.power ? '강타 · 커서 작게' : '정확히 · 커서 크게'); };
setMode();
bMode.addEventListener('click', () => { S.power = !S.power; setMode(); A.tick(); });
bSwing.addEventListener('pointerdown', (e) => { e.preventDefault(); bSwing.classList.add('down'); swing(); });
const up = () => bSwing.classList.remove('down');
bSwing.addEventListener('pointerup', up); bSwing.addEventListener('pointercancel', up); bSwing.addEventListener('pointerleave', up);
window.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); swing(); } });
let drag = null;
hud.addEventListener('pointerdown', (e) => { if (!G.ui.playing) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { hud.setPointerCapture(e.pointerId); } catch (er) {} });
hud.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const a = V.toScreen(-0.5, ZC, 0), b = V.toScreen(0.5, ZC, 0), ppm = Math.max(40, b.x - a.x);
  S.cur.x = clamp(S.cur.x + ((e.clientX - drag.x) / ppm) * 1.1, -0.62, 0.62); S.cur.y = clamp(S.cur.y - ((e.clientY - drag.y) / ppm) * 1.1, 0.3, 1.35);
  drag.x = e.clientX; drag.y = e.clientY;
});
hud.addEventListener('pointerup', () => { drag = null; });
hud.addEventListener('pointercancel', () => { drag = null; });

build();
poseBatter(0); setPose(catcher, P_CROUCH); setPose(ump, P_UMP); setPose(pitcher, PK[0][1]);
for (const k in fielders) if (k !== 'c' && k !== 'p') setPose(fielders[k].r, P_READY);
G.ui.init({
  key: 'bb', title: '9회말 2아웃', tag: '커서를 공에 대고, 들어오는 순간 스윙', sheet: '끝내기 장면', stages: ST.length,
  endless: '홈런 더비', endlessTag: '아웃 10개까지', unit: '개',
  win: ['진땀 끝내기', '깔끔한 끝내기', '완벽한 끝내기'], lose: '경기 끝',
  start: begin, idle: () => { S.phase = 'idle'; A.crowd(0.4); ball.visible = false; clearTrail(); },
});
G.fonts(() => { boardUp(); G.loop(update, render); });
window.__bb = { S, swing, ballAt, judge, flight, V, camera, fielders };
