// 버저비터
(function () {
  'use strict';
  const C = G.C, A = G.audio, fx = G.fx, clamp = G.clamp;
  const R = 0.13, GR = 9.8, VW = 6.2, BALLC = '#D9772E', DEFX = 3.85;
  // [시간, 도장1, 도장2, 도장3, 자리(0 고정,1 두 곳,2 아무 데나), 골대 움직임(0,1 위아래,2 앞뒤,3 둘 다), 수비, 바람]
  const ST = [
    [40, 6, 10, 14, 0, 0, 0, 0], [40, 8, 12, 16, 1, 0, 0, 0], [45, 8, 13, 18, 2, 0, 0, 0], [45, 8, 12, 16, 0, 1, 0, 0], [45, 8, 13, 18, 2, 1, 0, 0],
    [45, 7, 11, 15, 1, 0, 1, 0], [45, 8, 12, 16, 2, 2, 0, 0], [45, 8, 12, 17, 2, 0, 0, 1.5], [50, 9, 14, 19, 2, 1, 1, 0], [50, 10, 15, 20, 2, 2, 0, -1.5],
    [50, 10, 15, 20, 2, 1, 0, 2], [50, 9, 14, 19, 2, 2, 1, 0], [60, 12, 18, 24, 2, 1, 1, 1.5], [60, 12, 18, 25, 2, 2, 1, -2], [60, 14, 20, 28, 2, 3, 1, 2],
  ];
  const S = { phase: 'idle', balls: [] };
  const cv = document.getElementById('cv');
  const V = G.canvas(cv, (v) => { S.sc = Math.min(v.W / VW, (v.H * 0.84) / 8.6); S.ox = (v.W - VW * S.sc) / 2; S.fy = v.H * 0.84; });
  const X = (x) => S.ox + x * S.sc, Y = (y) => S.fy - y * S.sc;

  function hoop() {
    const m = S.move, t = S.t; let x = 5.0, y = 3.05;
    if (m === 1 || m === 3) y += 0.55 * Math.sin(t * 1.5);
    if (m === 2 || m === 3) x -= 0.45 * (1 + Math.sin(t * 1.25));
    return { x, y, f: x - 0.225, b: x + 0.225, bx: x + 0.36 };
  }
  const defY = () => 2.2 + 0.8 * Math.max(0, Math.sin(S.t * 2.1));
  function nextSpot() {
    if (S.spot === 0) return 2.4;
    if (S.spot === 1) return S.kid.tx < 2.2 ? 3.0 : 1.5;
    let x; do { x = G.rand(0.9, 3.3); } while (Math.abs(x - S.kid.tx) < 0.5); return x;
  }
  function begin(i) {
    S.stage = i; S.score = 0; S.combo = 0; S.miss = 0; S.made = 0; S.shots = 0; S.t = 0; S.balls = []; S.drag = null; S.netT = 9; S.timeUp = false; S.endT = 0; S.rd = 0.4;
    if (i >= 0) { const s = ST[i]; S.time = s[0]; S.goal = [s[1], s[2], s[3]]; S.spot = s[4]; S.move = s[5]; S.def = s[6]; S.wind = s[7]; }
    else { S.time = Infinity; S.spot = 2; S.move = 0; S.def = 0; S.wind = 0; }
    S.kid = { x: 2.4, tx: 2.4 }; if (S.spot === 1) S.kid.x = S.kid.tx = 1.5;
    S.phase = 'play'; A.whistle(false);
    fx.say(i >= 0 ? S.time + '초' : '무한 도전', i >= 0 ? '도장은 ' + S.goal[0] + '점부터' : '세 번 놓치면 끝');
  }
  function launch(vx, vy) {
    S.balls.push({ x: S.kid.x + 0.1, y: 2.0, vx, vy, touch: false, scored: false, dead: false, floor: 0, spin: 0, rimT: 0 });
    S.shots++; S.rd = 0.45; S.hop = 0.25; A.whoosh();
    if (S.spot && S.stage >= 0) S.kid.tx = nextSpot();
  }
  function onScore(b, h) {
    b.scored = true; S.made++;
    let pts = b.touch ? 2 : 3;
    if (!b.touch) { S.combo++; pts += Math.min(3, S.combo - 1); } else S.combo = 0;
    if (S.timeUp) pts *= 2;
    S.score += pts; S.netT = 0; b.vx *= 0.35; b.vy *= 0.55;
    A.net(); fx.shake(b.touch ? 0.12 : 0.25);
    fx.text(X(h.x), Y(h.y) - 30, '+' + pts, C.yellow, 34);
    if (S.timeUp) { fx.say('버저비터!', '종이 울린 뒤에 들어갔다. 두 배', C.yellow); A.cheer(1.4); G.hitStop(90); }
    else if (!b.touch) { fx.text(X(h.x) - 50, Y(h.y) + 26, S.combo > 1 ? '클린 ' + S.combo + '연속' : '클린', C.lime, 22); if (S.combo >= 3) A.cheer(0.7); }
    if (S.stage < 0) { S.kid.tx = nextSpot(); if (S.made === 6) S.move = 1; if (S.made === 12) { S.move = 2; S.def = 1; } if (S.made === 20) S.move = 3; if (S.made % 5 === 0) fx.say(S.made + '개째', S.made === 6 || S.made === 12 || S.made === 20 ? '골대가 움직이기 시작한다' : ''); }
  }
  function onMiss() { S.combo = 0; if (S.stage < 0) { S.miss++; A.aw(); } }
  function bouncePt(b, px, py, rad, e) {
    const dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy);
    if (d >= R + rad || d === 0) return false;
    const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
    if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
    b.x = px + nx * (R + rad); b.y = py + ny * (R + rad); return true;
  }
  function stepBall(b, dt, h) {
    const py = b.y;
    b.vy -= GR * dt; b.vx += S.wind * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.spin += b.vx * dt * 4; b.rimT -= dt;
    if (!b.scored) {
      if (bouncePt(b, h.f, h.y, 0.025, 0.55) | bouncePt(b, h.b, h.y, 0.025, 0.55)) { b.touch = true; if (b.rimT <= 0) { A.rim(); b.rimT = 0.08; fx.shake(0.06); } }
      if (b.vx > 0 && b.x + R > h.bx && b.x < h.bx + 0.15 && b.y > h.y - 0.2 && b.y < h.y + 0.95) { b.x = h.bx - R; b.vx = -b.vx * 0.6; b.touch = true; A.bounce(0.5); }
      if (b.x > h.b && b.x < h.bx && py - R >= h.y && b.y - R < h.y && b.vy < 0) { b.y = h.y + R; b.vy = -b.vy * 0.5; b.touch = true; }
      if (S.def && bouncePt(b, DEFX, defY(), 0.16, 0.4) && !b.blk) { b.blk = true; b.touch = true; A.thud(); fx.text(X(DEFX), Y(defY()) - 20, '쳐냈다', C.lime, 22); }
      if (py >= h.y && b.y < h.y && b.vy < 0 && b.x > h.f + 0.03 && b.x < h.b - 0.03) onScore(b, h);
    }
    if (b.y < R) {
      b.y = R; if (b.vy < -1) A.bounce(Math.min(1, -b.vy / 8)); b.vy = -b.vy * 0.62; b.vx *= 0.8; b.floor++;
      if (!b.scored && !b.dead) { b.dead = true; onMiss(); }
    }
    return b.floor >= 3 || b.x < -1.5 || b.x > VW + 1.5;
  }
  function update(dt) {
    if (S.phase !== 'play') return;
    S.t += dt; S.netT += dt; S.rd -= dt; if (S.hop > 0) S.hop -= dt;
    S.kid.x += clamp(S.kid.tx - S.kid.x, -4 * dt, 4 * dt);
    const h = hoop();
    for (let i = S.balls.length - 1; i >= 0; i--) { const b = S.balls[i]; if (stepBall(b, dt, h)) { if (!b.scored && !b.dead) onMiss(); S.balls.splice(i, 1); } }
    if (S.stage >= 0 && !S.timeUp) {
      const before = Math.ceil(S.time); S.time -= dt;
      if (S.time <= 5 && Math.ceil(S.time) < before && S.time > 0) A.tick();
      if (S.time <= 0) { S.time = 0; S.timeUp = true; S.drag = null; A.bell(); }
    }
    const over = S.stage >= 0 ? S.timeUp : S.miss >= 3;
    if (over && !S.balls.length) {
      S.endT += dt;
      if (S.endT > 0.7) {
        S.phase = 'idle';
        if (S.stage >= 0) { const st = S.score >= S.goal[2] ? 3 : S.score >= S.goal[1] ? 2 : S.score >= S.goal[0] ? 1 : 0; G.ui.endStage(S.stage, st, S.score + '점. 도장은 ' + S.goal.join(', ') + '점에 하나씩.'); }
        else G.ui.endEndless(S.score, S.made + '개를 넣었다.');
      }
    }
  }
  function dragV() {
    const d = S.drag; if (!d) return null;
    let vx = ((d.sx - d.x) / S.sc) * 4.4, vy = ((d.y - d.sy) / S.sc) * 4.4; const m = Math.hypot(vx, vy);
    if (m > 11.5) { vx *= 11.5 / m; vy *= 11.5 / m; }
    return { vx, vy, m: Math.min(m, 11.5) };
  }

  // ---------- 그리기 ----------
  function drawBall(c, x, y, spin) {
    const r = R * S.sc; c.save(); c.translate(X(x), Y(y)); c.rotate(spin);
    c.fillStyle = BALLC; c.strokeStyle = C.dark; c.lineWidth = Math.max(1.5, r * 0.13); c.beginPath(); c.arc(0, 0, r, 0, 6.283); c.fill(); c.stroke();
    c.lineWidth = Math.max(1, r * 0.09); c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.moveTo(0, -r); c.lineTo(0, r); c.stroke();
    c.beginPath(); c.arc(-r * 1.2, 0, r * 0.95, -0.75, 0.75); c.stroke(); c.beginPath(); c.arc(r * 1.2, 0, r * 0.95, 2.39, 3.89); c.stroke();
    c.restore();
  }
  function render() {
    const c = V.ctx, W = V.W, H = V.H, sc = S.sc, o = fx.offset();
    c.save(); c.translate(o.x, o.y);
    const hz = S.fy - 1.15 * sc;
    c.fillStyle = C.sky; c.fillRect(-20, -20, W + 40, hz + 20);
    G.school(c, W * 0.36, hz, W * 1.5, W + 40);
    c.fillStyle = C.dirt; c.fillRect(-20, hz, W + 40, S.fy - hz);
    c.fillStyle = C.turf; c.fillRect(-20, S.fy - 0.42 * sc, W + 40, H - S.fy + 0.42 * sc + 20);
    c.fillStyle = C.track; c.beginPath(); c.moveTo(X(3.3), S.fy - 0.42 * sc); c.lineTo(W + 20, S.fy - 0.42 * sc); c.lineTo(W + 20, S.fy + 0.5 * sc); c.lineTo(X(2.7), S.fy + 0.5 * sc); c.closePath(); c.fill();
    c.strokeStyle = C.lime; c.lineWidth = Math.max(2, 0.05 * sc); c.beginPath(); c.moveTo(-20, S.fy - 0.42 * sc); c.lineTo(W + 20, S.fy - 0.42 * sc); c.moveTo(X(3.3), S.fy - 0.42 * sc); c.lineTo(X(2.7), S.fy + 0.5 * sc); c.lineTo(W + 20, S.fy + 0.5 * sc); c.stroke();
    if (S.phase === 'idle' && S.kid == null) { c.restore(); return; }
    const h = hoop();
    // 농구대
    c.strokeStyle = C.steel; c.lineWidth = 0.16 * sc; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(X(5.95), S.fy); c.lineTo(X(5.95), Y(Math.max(3.0, h.y + 0.2))); c.lineTo(X(h.bx + 0.1), Y(h.y + 0.35)); c.stroke();
    c.fillStyle = C.lime; c.strokeStyle = C.dark; c.lineWidth = 2; c.fillRect(X(h.bx), Y(h.y + 0.95), 0.1 * sc, 1.15 * sc); c.strokeRect(X(h.bx), Y(h.y + 0.95), 0.1 * sc, 1.15 * sc);
    c.fillStyle = C.rim; c.fillRect(X(h.bx) - 2, Y(h.y + 0.5), 3, 0.5 * sc);
    for (const b of S.balls) if (!b.scored || b.y > h.y - 0.5) drawBall(c, b.x, b.y, b.spin);
    // 그물과 림
    const sway = S.netT < 0.7 ? Math.sin(S.netT * 22) * (1 - S.netT / 0.7) * 0.07 : 0, drop = S.netT < 0.25 ? 0.1 * Math.sin((S.netT / 0.25) * 3.14) : 0;
    c.strokeStyle = 'rgba(243,240,230,.92)'; c.lineWidth = Math.max(1.2, 0.022 * sc); c.beginPath();
    for (let i = 0; i <= 5; i++) { const k = i / 5, x0 = h.f + (h.b - h.f) * k, x1 = h.x + (k - 0.5) * 0.26 + sway; c.moveTo(X(x0), Y(h.y)); c.quadraticCurveTo(X(x0 + sway * 0.5), Y(h.y - 0.2), X(x1), Y(h.y - 0.42 - drop)); }
    for (const yy of [0.14, 0.28]) { c.moveTo(X(h.f + 0.03 + sway * 0.3), Y(h.y - yy)); c.lineTo(X(h.b - 0.03 + sway * 0.3), Y(h.y - yy)); }
    c.stroke();
    G.line(c, X(h.f), Y(h.y), X(h.bx), Y(h.y), Math.max(3.5, 0.06 * sc) + 2.5, C.dark); G.line(c, X(h.f), Y(h.y), X(h.bx), Y(h.y), Math.max(3.5, 0.06 * sc), C.rim);
    for (const b of S.balls) if (b.scored && b.y <= h.y - 0.5) drawBall(c, b.x, b.y, b.spin);
    // 수비
    if (S.def) { const jy = defY() - 2.2; G.kid(c, X(DEFX), Y(jy), 1.72 * sc, { shirt: C.wallD, pants: C.steel, aL: 3.0, aR: 3.0, spread: 0.4 }); }
    // 슈터
    const dv = dragV(), sq = dv ? (dv.m / 11.5) * 0.7 : 0, hop = S.hop > 0 ? Math.sin((S.hop / 0.25) * 3.14) * 0.25 : 0;
    c.fillStyle = 'rgba(32,38,43,.2)'; c.beginPath(); c.ellipse(X(S.kid.x), S.fy, 0.35 * sc, 0.08 * sc, 0, 0, 6.283); c.fill();
    G.kid(c, X(S.kid.x), Y(hop), 1.55 * sc, { bib: C.bib, num: 5, aL: 2.95, aR: 2.95, sq: sq - (hop > 0 ? 0.4 : 0), spread: 0.35 });
    const canShoot = S.rd <= 0 && !S.timeUp && (S.stage >= 0 || S.miss < 3) && S.phase === 'play';
    if (canShoot) {
      const bx = S.kid.x + 0.1, by = 2.0 - sq * 0.3;
      drawBall(c, bx, by, 0);
      if (dv && dv.m > 2.5) {
        const n = S.stage >= 8 || (S.stage < 0 && S.made >= 8) ? 5 : 8;
        c.fillStyle = C.lime;
        for (let i = 1; i <= n; i++) { const t = i * 0.06, px = bx + dv.vx * t + 0.5 * S.wind * t * t, py = by + dv.vy * t - 4.9 * t * t; c.globalAlpha = 0.9 - i * 0.08; c.beginPath(); c.arc(X(px), Y(py), Math.max(2, 4.5 - i * 0.3), 0, 6.283); c.fill(); }
        c.globalAlpha = 1;
      } else if (S.stage === 0 && S.shots === 0 && !dv) G.hint(c, X(bx), Y(by), X(bx) - W * 0.2, Y(by) + H * 0.13, 0, '공을 뒤로 당겼다가 놓는다', W, H);
    }
    fx.draw(c, W, H);
    c.restore();
    // 점수판
    const top = 14 + G.safeTop;
    G.label(c, 14, top + 10, '점수'); G.flip(c, 14, top + 20, String(S.score).padStart(2, '0'), 40);
    if (S.stage >= 0) { G.label(c, 84, top + 10, '남은 시간'); G.flip(c, 84, top + 20, String(Math.ceil(S.time)).padStart(2, '0'), 40, S.time <= 5 ? C.stamp : C.lime); G.label(c, 14, top + 80, '도장 ' + S.goal.join(' · ') + '점', C.lime, 12); }
    else for (let i = 0; i < 3; i++) { const x = 96 + i * 22, y = top + 40; c.strokeStyle = i < S.miss ? C.stamp : 'rgba(32,38,43,.3)'; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 6, y - 6); c.lineTo(x + 6, y + 6); c.moveTo(x + 6, y - 6); c.lineTo(x - 6, y + 6); c.stroke(); }
    if (S.wind) { G.flag(c, W / 2 + 30, top + 58, S.wind / 2.5); G.label(c, W / 2 + 17, top + 72, '바람', C.lime, 11); }
  }

  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', (e) => {
    if (!G.ui.playing || G.paused || S.phase !== 'play' || S.rd > 0 || S.timeUp || (S.stage < 0 && S.miss >= 3)) return;
    const p = pos(e); S.drag = { id: e.pointerId, sx: p.x, sy: p.y, x: p.x, y: p.y };
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  });
  cv.addEventListener('pointermove', (e) => { if (S.drag && e.pointerId === S.drag.id) { const p = pos(e); S.drag.x = p.x; S.drag.y = p.y; } });
  cv.addEventListener('pointerup', (e) => {
    if (!S.drag || e.pointerId !== S.drag.id) return;
    const v = dragV(); S.drag = null;
    if (v && v.m > 2.5 && !S.timeUp && !G.paused) launch(v.vx, v.vy);
  });
  cv.addEventListener('pointercancel', () => { S.drag = null; });

  G.ui.init({
    key: 'hp', title: '버저비터', tag: '종이 울리기 전에 던진 공은 끝까지 센다', sheet: '슛 기록표', stages: ST.length,
    endless: '무한 도전', endlessTag: '세 번 놓치면 끝', unit: '점',
    win: ['턱걸이 통과', '손이 풀렸다', '오늘 슛감 최고'], lose: '점수가 모자랐다',
    start: begin,
  });
  G.fonts(() => G.loop(update, render));
  window.__hp = { S, launch, hoop, ST };
})();
