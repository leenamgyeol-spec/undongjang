// 프리킥 한 방
(function () {
  'use strict';
  const C = G.C, A = G.audio, fx = G.fx, clamp = G.clamp;
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
  const S = { phase: 'idle', goals: 0, miss: 0, left: 0, stage: 0, shots: 0 };
  const cv = document.getElementById('cv');
  const V = G.canvas(cv, () => { if (S.cfg) setCam(); });

  function setCam() {
    const d = S.dist, back = 0.22 * d;
    S.camH = 1.7; S.cam = { x: S.bx - S.dir.x * back, z: -S.dir.z * back };
    S.hy = V.H * 0.42;
    S.f = Math.min(0.6 * V.W * (d + back) / 7.32, (V.H * 0.85 - S.hy) * back / S.camH);
  }
  function camXZ(x, z) { const rx = x - S.cam.x, rz = z - S.cam.z; return [rx * S.right.x + rz * S.right.z, rx * S.dir.x + rz * S.dir.z]; }
  function proj(x, y, z) {
    const [xr, zr] = camXZ(x, z); if (zr < 0.4) return null;
    const s = S.f / zr; return { x: V.W / 2 + xr * s, y: S.hy - (y - S.camH) * s, s };
  }
  function unproj(sx, sy) { // 화면 점 → 골문 평면 위 점
    const xr = (sx - V.W / 2) / S.f, yr = -(sy - S.hy) / S.f;
    const dx = xr * S.right.x + S.dir.x, dz = xr * S.right.z + S.dir.z, t = (S.D - S.cam.z) / Math.max(dz, 0.05);
    return { x: S.cam.x + t * dx, y: S.camH + t * yr };
  }

  function newShot(cfg) {
    S.cfg = cfg; const [dist, bx, wn, ws, jump, kl, wind] = cfg;
    S.bx = bx; S.dist = dist; S.D = Math.sqrt(dist * dist - bx * bx);
    S.dir = { x: -bx / dist, z: S.D / dist }; S.right = { x: S.dir.z, z: -S.dir.x };
    S.wall = []; for (let i = 0; i < wn; i++) S.wall.push(ws + (i - (wn - 1) / 2) * 0.52);
    S.jump = jump; S.kl = kl; S.wind = wind; S.kx = kl ? clamp(-ws * 2, -1.2, 1.2) : 0;
    S.ball = { x: bx, y: BR, z: 0, vx: 0, vy: 0, vz: 0, ax: 0, az: 0, dead: true };
    S.keep = { x0: S.kx, tx: S.kx, ty: 1.25, t0: 9, t1: 10, save: false };
    S.t = 0; S.phase = 'ready'; S.trail = []; S.net = null; S.spin = 0; S.sw = null; S.pred = null; G.slow = 1;
    setCam();
  }
  function randCfg(n) {
    const dist = Math.round(G.rand(16, 20 + Math.min(n, 12)));
    const bx = Math.round(G.rand(-1, 1) * Math.min(2 + n * 0.7, 9, dist * 0.45));
    const wn = n === 0 ? 0 : Math.min(5, 2 + (n >> 1));
    return [dist, bx, wn, +G.rand(-0.7, 0.7).toFixed(1), n >= 3 ? 1 : 0, Math.min(5, 1 + ((n / 3) | 0)), n >= 4 ? +(G.rand(-1, 1) * Math.min(4, n * 0.4)).toFixed(1) : 0];
  }

  function step(b, dt, t, live) {
    const pu = (b.x - S.bx) * S.dir.x + b.z * S.dir.z, pz = b.z;
    if (!b.dead) { b.vx += (b.ax + S.wind * 0.7) * dt; b.vz += b.az * dt; }
    b.vy -= GR * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.y < BR) {
      b.y = BR;
      if (b.vy < -1.4) { b.vy = -b.vy * 0.5; if (live) { A.bounce(Math.min(1, b.vy / 6)); const p = proj(b.x, 0, b.z); if (p) fx.burst(p.x, p.y, 4, C.dirtD, { v0: 10, v1: 50, g: 60, ang: -1.57, spread: 2.4, r1: 4 }); } }
      else b.vy = 0;
      b.vx *= 1 - 1.2 * dt; b.vz *= 1 - 1.2 * dt;
    }
    if (b.dead) return null;
    const u = (b.x - S.bx) * S.dir.x + b.z * S.dir.z;
    if (pu < WD && u >= WD && S.wall.length) {
      const s = (b.x - S.bx) * S.right.x + b.z * S.right.z, jy = S.jump ? Math.max(0, 3.0 * t - 4.9 * t * t) : 0;
      for (const w of S.wall) if (Math.abs(s - w) < 0.27 + BR && b.y < 1.78 + jy + BR * 0.5 && b.y > jy - BR) return 'block';
    }
    if (pz < S.D && b.z >= S.D) {
      const ax = Math.abs(b.x);
      if (b.y > GH + BR + 0.06 || ax > GW + BR + 0.06) return 'out';
      if (ax > GW - BR || b.y > GH - BR) return ax < GW && b.y < GH ? 'postin' : 'post';
      return 'cross';
    }
    return null;
  }

  function kick(dx, dy, dur, curv) {
    const b = S.ball, p0 = proj(b.x, b.y, b.z), T = unproj(p0.x + dx, p0.y + dy);
    T.y = clamp(T.y * 0.65, BR, 7); T.x = clamp(T.x, -14, 14);
    const len = Math.hypot(dx, dy), sp = clamp(13 + 7.5 * (len / V.H) / Math.max(dur, 0.06), 15, 32);
    const hx = T.x - b.x, hz = S.D, hd = Math.hypot(hx, hz), tt = hd / sp, ax = hx / hd, az = hz / hd, rx = az, rz = -ax;
    const dev = clamp(curv, -0.35, 0.35) * hd * 0.9, la = -8 * dev / (tt * tt), lv = 4 * dev / tt;
    b.vx = ax * sp + rx * lv; b.vz = az * sp + rz * lv; b.vy = (T.y - BR + 0.5 * GR * tt * tt) / tt;
    b.ax = rx * la; b.az = rz * la; b.dead = false;
    const c = Object.assign({}, b); let t = 0, ev = null;
    while (t < 4.5 && !ev) { ev = step(c, 1 / 120, t, false); t += 1 / 120; }
    S.pred = { ev, x: c.x, y: c.y, t };
    const K = S.keep; K.save = false; K.tx = S.kx; K.ty = 1.25; K.t0 = TR[S.kl]; K.t1 = Math.max(t, K.t0 + 0.1);
    if (S.kl && (ev === 'cross' || ev === 'postin' || ev === 'post' || ev === 'out')) {
      const run = Math.max(0, VK[S.kl] * (t - TR[S.kl])), ddx = c.x - S.kx, ddy = c.y - 1.25, need = Math.hypot(ddx, ddy);
      if (ev === 'cross' && need <= run + 0.5) { K.save = true; K.tx = c.x; K.ty = c.y; }
      else { const k = Math.min(0.92, (run + 0.2) / Math.max(need, 0.01)) * (ev === 'out' ? 0.4 : 1); K.tx = S.kx + ddx * k; K.ty = 1.25 + ddy * k; }
    }
    S.phase = 'fly'; S.t = 0; S.power = (sp - 15) / 17; S.shots++;
    A.kick(S.power); fx.shake(0.12 + 0.1 * S.power);
    fx.burst(p0.x, p0.y + 6, 8, C.dirtD, { v0: 30, v1: 120, g: 200, ang: -1.57, spread: 2.2, r1: 5 });
  }

  function onEvent(ev) {
    const b = S.ball, p = proj(b.x, b.y, b.z) || { x: V.W / 2, y: V.H / 2 };
    b.dead = true; G.slow = 1; S.phase = 'after'; S.after = 1.6;
    if (ev === 'cross') ev = S.keep.save ? 'save' : 'goal';
    if (ev === 'goal' || ev === 'postin') {
      b.vx *= 0.12; b.vz *= 0.12; b.vy *= 0.3; S.net = { x: b.x, y: b.y, t: 0 }; S.goals++;
      if (ev === 'postin') A.post();
      A.net(); A.whistle(true); A.cheer(1); fx.shake(0.45); G.hitStop(70);
      fx.say('골!', ev === 'postin' ? '골대 맞고 들어갔다' : '', C.yellow);
      fx.burst(p.x, p.y, 12, C.lime, { v0: 40, v1: 160, g: 120, r1: 3 });
      return;
    }
    S.miss++;
    if (ev === 'save') {
      b.vz = -b.vz * 0.25; b.vx = (b.x > S.keep.x0 ? 1 : -1) * G.rand(2, 5); b.vy = G.rand(2, 4);
      A.thud(); A.aw(); fx.shake(0.3); G.hitStop(50); fx.say('막혔다', '골키퍼 손에 걸렸다');
    } else if (ev === 'block') {
      b.vz *= -0.3; b.vx = b.vx * -0.3 + G.rand(-2, 2); b.vy = G.rand(1, 3);
      A.thud(); A.aw(); fx.shake(0.3); fx.say('벽!', '수비벽에 맞았다');
    } else if (ev === 'post') {
      b.vz *= -0.45; b.vy *= 0.5; A.post(); A.aw(); fx.shake(0.55); G.hitStop(80); fx.say('골대!', '한 뼘이 모자랐다');
    } else { A.aw(); fx.say(ev === 'short' ? '힘이 모자랐다' : '빗나갔다'); }
  }

  function nextShot() {
    if (S.stage >= 0) {
      if (--S.left > 0) return newShot(S.cfg);
      S.phase = 'idle';
      G.ui.endStage(S.stage, S.goals, S.goals ? '공 세 개 가운데 ' + S.goals + '개를 넣었다.' : '하나는 넣어야 다음으로 넘어간다.');
    } else {
      if (S.miss >= 3) { S.phase = 'idle'; return G.ui.endEndless(S.goals); }
      newShot(randCfg(S.goals));
    }
  }

  function update(dt) {
    const b = S.ball;
    if (S.phase === 'fly') {
      const ev = step(b, dt, S.t, true); S.t += dt; S.spin += dt * (8 + S.power * 14);
      if (((S.t * 120) | 0) % 2 === 0) { const p = proj(b.x, b.y, b.z); if (p) { S.trail.push(p); if (S.trail.length > 16) S.trail.shift(); } }
      const pe = S.pred.ev;
      if ((pe === 'cross' || pe === 'postin' || pe === 'post') && b.z > S.D - 4.5) G.slow = 0.4;
      if (ev) onEvent(ev); else if (S.t > 4.4) onEvent('short');
    } else if (S.phase === 'after') {
      step(b, dt, S.t, true); S.t += dt;
      if (S.net) { S.net.t += dt; if (b.z > S.D + 1.0) { b.z = S.D + 1.0; b.vz = 0; b.vx *= 0.9; } }
      if (S.trail.length) S.trail.shift();
      S.after -= dt; if (S.after <= 0) nextShot();
    }
  }

  // ---------- 그리기 ----------
  function seg(c, x1, z1, x2, z2) {
    let [ax, az] = camXZ(x1, z1), [bx, bz] = camXZ(x2, z2); const N = 0.6;
    if (az < N && bz < N) return;
    if (az < N) { const k = (N - az) / (bz - az); ax += (bx - ax) * k; az = N; }
    if (bz < N) { const k = (N - bz) / (az - bz); bx += (ax - bx) * k; bz = N; }
    const sa = S.f / az, sb = S.f / bz;
    c.lineWidth = clamp(0.12 * (sa + sb) / 2, 1.5, 8);
    c.beginPath(); c.moveTo(V.W / 2 + ax * sa, S.hy + S.camH * sa); c.lineTo(V.W / 2 + bx * sb, S.hy + S.camH * sb); c.stroke();
  }
  function netPt(x, y) {
    let z = S.D + 0.6 + 0.9 * (1 - y / GH);
    if (S.net) { const d2 = (x - S.net.x) * (x - S.net.x) + (y - S.net.y) * (y - S.net.y); z += Math.exp(-d2 / 1.4) * Math.exp(-S.net.t * 2.2) * Math.cos(S.net.t * 9) * 0.9; }
    return proj(x, y, z);
  }
  function drawGoal(c) {
    c.strokeStyle = 'rgba(243,240,230,.62)'; c.lineWidth = 1; c.beginPath();
    for (let i = 0; i <= 14; i++) { const x = -GW + (2 * GW * i) / 14; for (let j = 0; j <= 6; j++) { const p = netPt(x, (GH * j) / 6); if (!p) continue; j ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); } }
    for (let j = 0; j <= 6; j++) { const y = (GH * j) / 6; for (let i = 0; i <= 14; i++) { const p = netPt(-GW + (2 * GW * i) / 14, y); if (!p) continue; i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); } }
    for (const sx of [-GW, GW]) for (const y of [0, GH * 0.5, GH]) { const a = proj(sx, y, S.D), b2 = netPt(sx, y); if (a && b2) { c.moveTo(a.x, a.y); c.lineTo(b2.x, b2.y); } }
    for (let i = 1; i < 6; i++) { const x = -GW + (2 * GW * i) / 6, a = proj(x, GH, S.D), b2 = netPt(x, GH); if (a && b2) { c.moveTo(a.x, a.y); c.lineTo(b2.x, b2.y); } }
    c.stroke();
    const l0 = proj(-GW, 0, S.D), l1 = proj(-GW, GH, S.D), r0 = proj(GW, 0, S.D), r1 = proj(GW, GH, S.D);
    if (!l0 || !r0) return;
    const w = Math.max(3.5, 0.13 * l0.s);
    c.strokeStyle = C.dark; c.lineWidth = w + 2.5; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(l0.x, l0.y); c.lineTo(l1.x, l1.y); c.lineTo(r1.x, r1.y); c.lineTo(r0.x, r0.y); c.stroke();
    c.strokeStyle = C.lime; c.lineWidth = w; c.stroke();
  }
  function keeperHand() {
    const K = S.keep, k = S.phase === 'ready' ? 0 : clamp((S.t - K.t0) / (K.t1 - K.t0), 0, 1), e = G.ease.out(k);
    return { x: K.x0 + (K.tx - K.x0) * e, y: 1.25 + (K.ty - 1.25) * e, k };
  }
  function drawKeeper(c) {
    if (!S.kl) return;
    const h = keeperHand(), dx = h.x - S.keep.x0, rot = clamp(dx * 0.42, -1.25, 1.25);
    const sway = S.phase === 'ready' ? Math.sin(fx.t * 2.4) * 0.12 : 0;
    const lift = Math.max(0, h.y - 1.9) * 0.7 + Math.abs(Math.sin(rot)) * 0.45 * h.k;
    const p = proj(S.keep.x0 + dx * 0.6 + sway, lift, S.D - 0.4); if (!p) return;
    const up = h.k > 0 ? 2.75 : 0.9;
    G.kid(c, p.x, p.y, 1.75 * p.s, { bib: C.bibK, num: 1, rot, aL: up, aR: up, spread: 0.7, pants: C.dark, shirt: C.navy });
  }
  function drawWall(c) {
    const jy = S.jump && S.phase !== 'ready' ? Math.max(0, 3.0 * S.t - 4.9 * S.t * S.t) : 0;
    S.wall.forEach((w, i) => {
      const x = S.bx + S.dir.x * WD + S.right.x * w, z = S.dir.z * WD + S.right.z * w, p = proj(x, jy, z); if (!p) return;
      const g = proj(x, 0, z);
      c.fillStyle = 'rgba(32,38,43,.22)'; c.beginPath(); c.ellipse(g.x, g.y, 0.36 * g.s, 0.09 * g.s, 0, 0, 6.283); c.fill();
      G.kid(c, p.x, p.y, 1.78 * p.s, { bib: C.bib, num: i + 2, aL: -0.28, aR: -0.28, spread: 0.1 });
    });
  }
  function drawBall(c) {
    const b = S.ball, p = proj(b.x, b.y, b.z), g = proj(b.x, 0, b.z); if (!p) return;
    const r = Math.max(5, BR * p.s * 1.5);
    if (g) { c.fillStyle = 'rgba(32,38,43,.28)'; c.beginPath(); c.ellipse(g.x, g.y + 1, Math.max(3, BR * g.s) * 1.1, Math.max(1.2, BR * g.s * 0.35), 0, 0, 6.283); c.fill(); }
    S.trail.forEach((t, i) => { c.globalAlpha = (i / S.trail.length) * 0.5; c.fillStyle = C.lime; c.beginPath(); c.arc(t.x, t.y, Math.max(1.5, BR * t.s * 0.7 * (i / S.trail.length)), 0, 6.283); c.fill(); });
    c.globalAlpha = 1;
    c.fillStyle = '#FBFAF5'; c.strokeStyle = C.dark; c.lineWidth = Math.max(1.2, r * 0.14); c.beginPath(); c.arc(p.x, p.y, r, 0, 6.283); c.fill(); c.stroke();
    if (r > 5) { c.fillStyle = C.dark; for (let i = 0; i < 3; i++) { const a = S.spin + i * 2.094; c.beginPath(); c.arc(p.x + Math.cos(a) * r * 0.48, p.y + Math.sin(a) * r * 0.48, r * 0.22, 0, 6.283); c.fill(); } c.beginPath(); c.arc(p.x, p.y, r * 0.16, 0, 6.283); c.fill(); }
  }
  function render() {
    const c = V.ctx, W = V.W, H = V.H;
    if (!S.cfg) { c.fillStyle = C.dirt; c.fillRect(0, 0, W, H); return; }
    const o = fx.offset(); c.save(); c.translate(o.x, o.y);
    c.fillStyle = C.sky; c.fillRect(-20, -20, W + 40, S.hy + 20);
    const yaw = Math.atan2(S.dir.x, S.dir.z);
    G.school(c, W / 2 - yaw * S.f * 0.45, S.hy, W * 1.5, W + 40);
    c.fillStyle = C.dirt; c.fillRect(-20, S.hy, W + 40, H - S.hy + 20);
    c.fillStyle = C.dirtD; c.fillRect(-20, S.hy, W + 40, 5);
    c.strokeStyle = 'rgba(243,240,230,.9)'; c.lineCap = 'round';
    seg(c, -34, S.D, 34, S.D);
    seg(c, -20.16, S.D, -20.16, S.D - 16.5); seg(c, 20.16, S.D, 20.16, S.D - 16.5); seg(c, -20.16, S.D - 16.5, 20.16, S.D - 16.5);
    seg(c, -9.16, S.D, -9.16, S.D - 5.5); seg(c, 9.16, S.D, 9.16, S.D - 5.5); seg(c, -9.16, S.D - 5.5, 9.16, S.D - 5.5);
    const ps = proj(0, 0, S.D - 11); if (ps) { c.fillStyle = C.lime; c.beginPath(); c.ellipse(ps.x, ps.y, 0.16 * ps.s, 0.06 * ps.s, 0, 0, 6.283); c.fill(); }
    drawGoal(c); drawKeeper(c);
    const u = (S.ball.x - S.bx) * S.dir.x + S.ball.z * S.dir.z;
    if (u >= WD) drawBall(c);
    drawWall(c);
    if (u < WD) drawBall(c);
    if (S.sw && S.sw.pts.length > 1) { c.strokeStyle = 'rgba(243,240,230,.8)'; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); S.sw.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke(); }
    if (S.phase === 'ready' && !S.sw && S.stage >= 0 && S.shots === 0) {
      const b = proj(S.ball.x, BR, 0), t = proj(S.stage === 2 ? -2.6 : 2.4, 1.6, S.D);
      if (S.stage === 0) G.hint(c, b.x, b.y, t.x, t.y, 0, '공을 골대 쪽으로 쓸어 올려 찬다', W, H);
      if (S.stage === 2) G.hint(c, b.x, b.y, t.x, t.y, -W * 0.22, '휘게 쓸면 공도 휘어서 벽을 돌아간다', W, H);
      if (S.stage === 6) G.hint(c, b.x, b.y, t.x, t.y, 0, '깃발을 봐. 바람이 공을 민다', W, H);
    }
    fx.draw(c, W, H);
    c.restore();
    // 점수판
    const top = 14 + G.safeTop;
    G.label(c, 14, top + 10, S.stage >= 0 ? S.stage + 1 + '번' : '무한 도전');
    G.flip(c, 14, top + 20, String(S.goals).padStart(2, '0'), 40);
    c.font = '700 12px "Gothic A1"';
    if (S.stage >= 0) for (let i = 0; i < 3; i++) { c.fillStyle = i < S.left - (S.phase === 'ready' ? 0 : 1) ? '#FBFAF5' : 'rgba(32,38,43,.3)'; c.strokeStyle = C.dark; c.lineWidth = 1.5; c.beginPath(); c.arc(86 + i * 20, top + 40, 7, 0, 6.283); c.fill(); c.stroke(); }
    else for (let i = 0; i < 3; i++) { const x = 86 + i * 20, y = top + 40; c.strokeStyle = i < S.miss ? C.stamp : 'rgba(32,38,43,.3)'; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 6, y - 6); c.lineTo(x + 6, y + 6); c.moveTo(x + 6, y - 6); c.lineTo(x - 6, y + 6); c.stroke(); }
    if (S.wind) { G.flag(c, W / 2, top + 58, S.wind / 4); G.label(c, W / 2 - 13, top + 72, '바람', C.lime, 11); }
    G.label(c, 14, top + 78, S.dist + 'm', C.lime, 12);
  }

  // ---------- 조작 ----------
  cv.addEventListener('pointerdown', (e) => {
    if (S.phase !== 'ready' || !G.ui.playing || G.paused) return;
    const r = cv.getBoundingClientRect();
    S.sw = { id: e.pointerId, pts: [{ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }] };
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  });
  function fire() {
    const sw = S.sw; S.sw = null; if (!sw || S.phase !== 'ready') return;
    const a = sw.pts[0], b = sw.pts[sw.pts.length - 1], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < V.H * 0.07 || dy > -10) return;
    let far = 0;
    for (const p of sw.pts) { const d = ((p.x - a.x) * dy - (p.y - a.y) * dx) / len; if (Math.abs(d) > Math.abs(far)) far = d; }
    kick(dx, dy, (b.t - a.t) / 1000, -far / len);
  }
  cv.addEventListener('pointermove', (e) => {
    if (!S.sw || e.pointerId !== S.sw.id) return;
    const r = cv.getBoundingClientRect(), p = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
    S.sw.pts.push(p);
    if (Math.hypot(p.x - S.sw.pts[0].x, p.y - S.sw.pts[0].y) > V.H * 0.55) fire();
  });
  cv.addEventListener('pointerup', (e) => { if (S.sw && e.pointerId === S.sw.id) fire(); });
  cv.addEventListener('pointercancel', () => { S.sw = null; });

  G.ui.init({
    key: 'fk', title: '프리킥 한 방', tag: '벽을 넘기고 골키퍼를 속여라', sheet: '프리킥 기록표', stages: ST.length,
    endless: '무한 도전', endlessTag: '세 번 놓치면 끝', unit: '골',
    win: ['겨우 통과', '잘 찼다', '세 개 다 넣었다'], lose: '한 골도 못 넣었다',
    start(i) { S.stage = i; S.goals = 0; S.miss = 0; S.left = 3; S.shots = 0; newShot(i >= 0 ? ST[i] : randCfg(0)); A.whistle(false); },
  });
  G.fonts(() => G.loop(update, render));
  window.__fk = { S, kick, proj, unproj, ST };
})();
