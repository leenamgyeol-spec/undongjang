// 9회말 2아웃
(function () {
  'use strict';
  const C = G.C, A = G.audio, fx = G.fx, clamp = G.clamp, lerp = G.lerp;
  const ZC = 3, CAMH = 1.73, ZX = 0.25, ZY = 0.8, ZH = 0.3, WOOD = '#C89B5A';
  // [아웃, 주자(1루=1, 2루=2, 3루=4), 이기는 데 필요한 점수, 투수 실력, 상황]
  const ST = [
    [0, 0, 1, 1, '동점, 주자 없음'], [1, 2, 1, 1, '동점, 1아웃 2루'], [2, 4, 1, 1, '동점, 2아웃 3루'],
    [0, 0, 2, 2, '한 점 뒤진 채 시작'], [1, 1, 2, 2, '한 점 차, 1아웃 1루'], [2, 3, 2, 2, '한 점 차, 2아웃 1·2루'],
    [2, 7, 2, 3, '한 점 차, 2아웃 만루'], [1, 0, 2, 3, '한 점 차, 1아웃 주자 없음'], [2, 1, 2, 3, '한 점 차, 2아웃 1루'],
    [0, 0, 3, 3, '두 점 차, 주자 없음'], [2, 7, 4, 4, '석 점 차, 2아웃 만루'], [1, 2, 3, 4, '두 점 차, 1아웃 2루'],
    [2, 0, 1, 5, '동점, 2아웃. 상대는 에이스'], [2, 3, 3, 5, '두 점 차, 2아웃 1·2루'], [2, 7, 4, 6, '석 점 차, 2아웃 만루. 마지막 승부'],
  ];
  const LV = [null,
    { sp: 1.14, types: 'f', ball: 0.15, edge: 0.5, guide: 1 },
    { sp: 1.05, types: 'ffc', ball: 0.2, edge: 0.65, guide: 1 },
    { sp: 0.97, types: 'ffck', ball: 0.25, edge: 0.8, guide: 0.55 },
    { sp: 0.9, types: 'fcks', ball: 0.28, edge: 0.9, guide: 0.3 },
    { sp: 0.84, types: 'fcks', ball: 0.3, edge: 1, guide: 0 },
    { sp: 0.78, types: 'ffckss', ball: 0.32, edge: 1, guide: 0 }];
  const TY = {
    f: { n: '직구', tt: 0.62, bx: 0, by: 0.04, hump: 0.03 }, c: { n: '체인지업', tt: 0.86, bx: 0, by: -0.18, hump: 0.12 },
    k: { n: '커브', tt: 0.82, bx: 0.12, by: -0.5, hump: 0.3 }, s: { n: '슬라이더', tt: 0.7, bx: -0.38, by: -0.12, hump: 0.05 },
  };
  const FIELD = [[13, 25], [6, 36], [-7, 35], [-13, 25], [-24, 72], [0, 86], [24, 72]];
  const S = { phase: 'idle' };
  const cv = document.getElementById('cv');
  const V = G.canvas(cv, fit);
  function fit(v) { S.hy = v.H * 0.33; S.sc = Math.min(0.33 * v.H, 0.76 * v.W); S.F = S.sc * ZC; }
  function proj(x, y, z) { const s = S.F / (z + ZC); return { x: V.W / 2 + x * s, y: S.hy + (CAMH - y) * s, s }; }

  function setCount() { S.strikes = 0; S.balls = 0; }
  function begin(i) {
    S.stage = i; S.runs = 0; S.sk = 0; S.total = 0; S.batters = 0; S.pitches = 0; S.hit = null; S.P = null; S.swing = null;
    if (i >= 0) { const st = ST[i]; S.outs = st[0]; S.bases = [st[1] & 1, (st[1] >> 1) & 1, (st[1] >> 2) & 1]; S.need = st[2]; S.lv = st[3]; }
    else { S.outs = 0; S.bases = [0, 0, 0]; S.need = Infinity; S.lv = 1; }
    setCount(); S.phase = 'wait'; S.tp = 1.6;
    fx.say(i >= 0 ? '9회말' : '끝없는 타석', i >= 0 ? ST[i][4] : '아웃 세 개까지 친다');
  }
  function newPitch() {
    const L = LV[S.lv], ty = TY[L.types[(Math.random() * L.types.length) | 0]], ball = Math.random() < L.ball;
    let tx, tyy;
    if (ball) { const a = Math.random() * 6.283, k = G.rand(1.45, 2.0); tx = Math.cos(a) * ZX * k; tyy = ZY + Math.sin(a) * ZH * k; }
    else { tx = G.rand(-1, 1) * 0.22 * L.edge; tyy = ZY + G.rand(-1, 1) * 0.27 * L.edge; }
    S.P = { ty, tt: ty.tt * L.sp, tx, tyy, t: 0, swung: false, zone: Math.abs(tx) <= ZX + 0.035 && Math.abs(tyy - ZY) <= ZH + 0.035 };
    S.pitches++; A.whoosh();
  }
  function ballPos(p) {
    const P = S.P, t = P.ty;
    return { x: lerp(0.25, P.tx - t.bx, p) + t.bx * p * p, y: lerp(1.85, P.tyy - t.by, p) + t.by * p * p + t.hump * 4 * p * (1 - p), z: 18 * (1 - p) };
  }

  function advance(n) {
    let sc = 0; const b = S.bases;
    if (n === 4) { sc = 1 + b[0] + b[1] + b[2]; S.bases = [0, 0, 0]; }
    else { const nb = [0, 0, 0]; for (let i = 2; i >= 0; i--) if (b[i]) { const to = i + n + (n === 1 && i === 1 ? 1 : 0); if (to >= 3) sc++; else nb[to] = 1; } nb[n - 1] = 1; S.bases = nb; }
    S.runs += sc; S.total += n; return sc;
  }
  function walk() { const b = S.bases; if (b[0]) { if (b[1]) { if (b[2]) S.runs++; b[2] = 1; } b[1] = 1; } b[0] = 1; S.total += 1; }
  function nextBatter() { setCount(); S.batters++; if (S.stage < 0) S.lv = Math.min(6, 1 + ((S.batters / 2) | 0)); }
  function out(why) { S.outs++; nextBatter(); fx.say('아웃', why); A.aw(); }
  function resolve(r) { // 한 공의 결과를 경기에 반영
    if (r === 'swing' || r === 'look') {
      S.strikes++; S.sk++;
      if (S.strikes >= 3) out(r === 'look' ? '서서 삼진' : '헛스윙 삼진'); else fx.say('스트라이크', r === 'look' ? '그냥 보냈다' : '헛스윙');
    } else if (r === 'ball') {
      S.balls++;
      if (S.balls >= 4) { walk(); nextBatter(); fx.say('볼넷', '걸어서 1루로'); } else fx.say('볼', '잘 참았다', C.lime);
    } else if (r === 'foul') { if (S.strikes < 2) S.strikes++; fx.say('파울'); }
    else if (r.out) out(r.out);
    else {
      const sc = advance(r.n); nextBatter();
      fx.say(r.n === 4 ? '홈런!' : r.n === 2 ? '2루타!' : '안타!', sc ? sc + '점 들어왔다' : r.why || '', C.yellow);
      A.cheer(r.n === 4 ? 1.5 : 1); if (r.n === 4) fx.shake(0.5);
    }
    S.phase = 'call'; S.tp = 1.5;
  }
  function afterCall() {
    if (S.stage >= 0 && S.runs >= S.need) {
      S.phase = 'idle'; A.whistle(true); A.cheer(1.5);
      return G.ui.endStage(S.stage, S.sk <= 1 ? 3 : S.sk <= 3 ? 2 : 1, '끝내기. 스트라이크는 ' + S.sk + '개만 먹었다.');
    }
    if (S.outs >= 3) {
      S.phase = 'idle';
      return S.stage >= 0 ? G.ui.endStage(S.stage, 0, '세 번째 아웃. 경기가 끝났다.') : G.ui.endEndless(S.total, S.batters + '타석을 버텼다.');
    }
    S.P = null; S.hit = null; S.swing = null; S.phase = 'wait'; S.tp = 0.7;
  }

  function swing(sx, sy) {
    const P = S.P; P.swung = true;
    const dtm = P.t - P.tt, mx = (sx - V.W / 2) / S.sc, my = CAMH - (sy - S.hy) / S.sc, d = Math.hypot(mx - P.tx, my - P.tyy);
    S.swing = { x: sx, y: sy, t: 0 };
    if (Math.abs(dtm) > 0.14 || d > 0.24) { S.missed = true; A.whoosh(); return; }
    const tq = 1 - Math.abs(dtm) / 0.14, pq = 1 - d / 0.24, Q = tq * 0.55 + pq * 0.45;
    const spray = (dtm / 0.14) * 55, launch = clamp(14 + ((P.tyy - my) / 0.12) * 16, -10, 50);
    const af = launch < 10 ? 0.4 : launch < 20 ? 0.75 : launch <= 35 ? 1 : launch <= 45 ? 0.8 : 0.45;
    let D = (25 + 105 * Math.pow(Q, 1.4)) * af, res;
    if (Math.abs(spray) > 45) res = 'foul';
    else if (launch < 8) res = Q > 0.72 ? { n: 1, why: '내야를 빠져나갔다' } : { out: '땅볼' };
    else if (D >= 100) res = { n: 4 };
    else if (D >= 88) res = { n: 2, why: '담장을 맞혔다' };
    else if (launch < 18) res = Q > 0.5 ? { n: 1, why: '총알 같은 타구' } : { out: '직선타' };
    else if (D >= 70 && Math.abs(spray) > 15 && Math.abs(spray) < 30) res = { n: 2, why: '외야 사이를 갈랐다' };
    else if (D >= 62) res = { out: '외야 뜬공' };
    else if (D >= 48) res = { n: 1, why: '아무도 없는 곳에 떨어졌다' };
    else res = { out: '내야 뜬공' };
    const th = (clamp(launch, 6, 50) * Math.PI) / 180, ph = (spray * Math.PI) / 180;
    const ground = launch < 8, v = ground ? 14 + 22 * Q : Math.sqrt((Math.max(D, 12) * 9.8) / Math.sin(2 * th));
    S.hit = { x: P.tx, y: P.tyy, z: 0, vx: Math.sin(ph) * Math.cos(th) * v, vz: Math.cos(ph) * Math.cos(th) * v, vy: ground ? -2 : Math.sin(th) * v, t: 0, res, trail: [],
      dur: ground ? 1.3 : res === 'foul' ? 1.2 : Math.min(4.2, (2 * Math.sin(th) * v) / 9.8 + 0.25), hr: res.n === 4 };
    S.phase = 'hit'; S.Q = Q;
    A.crack(Q); fx.shake(0.15 + 0.4 * Q * Q); if (Q > 0.7) G.hitStop(40 + 70 * Q);
    fx.burst(sx, sy, 4 + ((Q * 10) | 0), C.lime, { v0: 60, v1: 240, g: 300, r1: 3.5, life: 0.45 });
  }

  function update(dt) {
    if (S.phase === 'idle') return;
    if (S.swing) S.swing.t += dt;
    if (S.phase === 'wait') { S.tp -= dt; if (S.tp <= 0) { S.phase = 'windup'; S.tp = 0.8; } }
    else if (S.phase === 'windup') { S.tp -= dt; if (S.tp <= 0) { S.phase = 'pitch'; S.missed = false; newPitch(); } }
    else if (S.phase === 'pitch') {
      const P = S.P; P.t += dt;
      if (P.t >= P.tt * 1.1) { A.mitt(); resolve(S.missed ? 'swing' : P.zone ? 'look' : 'ball'); }
    } else if (S.phase === 'hit') {
      const h = S.hit, k = dt * 1.5; h.t += k;
      h.vy -= 9.8 * k; h.x += h.vx * k; h.y += h.vy * k; h.z += h.vz * k;
      if (h.y < 0.04) { h.y = 0.04; if (h.vy < -2) { h.vy = -h.vy * 0.4; A.bounce(0.3); } else h.vy = 0; h.vx *= 1 - 0.9 * k; h.vz *= 1 - 0.9 * k; }
      if (((h.t * 60) | 0) % 2 === 0) { h.trail.push(proj(h.x, h.y, h.z)); if (h.trail.length > 12) h.trail.shift(); }
      if (h.t >= h.dur) resolve(h.res);
    } else if (S.phase === 'call') { S.tp -= dt; if (S.tp <= 0) afterCall(); }
  }

  // ---------- 그리기 ----------
  function gline(c, x1, z1, x2, z2) { const a = proj(x1, 0, z1), b = proj(x2, 0, z2); c.lineWidth = clamp(0.1 * (a.s + b.s) / 2, 1.2, 9); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
  function base(c, x, z, on) { const p = proj(x, 0, z), w = Math.max(3, 0.45 * p.s); c.fillStyle = on ? C.yellow : C.lime; c.beginPath(); c.ellipse(p.x, p.y, w, w * 0.35, 0, 0, 6.283); c.fill(); return p; }
  function drawBall(c, p, r) { c.fillStyle = '#FBFAF5'; c.strokeStyle = C.dark; c.lineWidth = Math.max(1, r * 0.14); c.beginPath(); c.arc(p.x, p.y, r, 0, 6.283); c.fill(); c.stroke(); if (r > 7) { c.strokeStyle = C.stamp; c.lineWidth = r * 0.1; c.beginPath(); c.arc(p.x - r * 0.9, p.y, r * 0.8, -0.8, 0.8); c.stroke(); c.beginPath(); c.arc(p.x + r * 0.9, p.y, r * 0.8, 2.34, 3.94); c.stroke(); } }
  function render() {
    const c = V.ctx, W = V.W, H = V.H, o = fx.offset();
    c.save(); c.translate(o.x, o.y);
    c.fillStyle = C.sky; c.fillRect(-20, -20, W + 40, S.hy + 20);
    G.school(c, W * 0.42, S.hy - 2, W * 1.35, W + 40);
    const fz = proj(0, 0, 100), ft = proj(0, 2.6, 100);
    c.fillStyle = C.dirt; c.fillRect(-20, fz.y, W + 40, H - fz.y + 20);
    c.fillStyle = C.fence; c.fillRect(-20, ft.y, W + 40, fz.y - ft.y);
    c.fillStyle = C.yellow; c.fillRect(-20, ft.y, W + 40, 2);
    c.strokeStyle = 'rgba(243,240,230,.9)'; c.lineCap = 'round';
    gline(c, 0, 0, 70, 70); gline(c, 0, 0, -70, 70);
    const mound = proj(0, 0, 18.4); c.fillStyle = C.dirtD; c.beginPath(); c.ellipse(mound.x, mound.y, 2.6 * mound.s, 0.5 * mound.s, 0, 0, 6.283); c.fill();
    if (S.phase === 'idle' && !S.bases) { c.restore(); return; }
    const bp = [base(c, 19.4, 19.4, S.bases[0]), base(c, 0, 38.8, S.bases[1]), base(c, -19.4, 19.4, S.bases[2])];
    FIELD.forEach((f, i) => { const p = proj(f[0], 0, f[1]); G.kid(c, p.x, p.y, Math.max(7, 1.7 * p.s), { shirt: C.wallD, pants: C.steel, cap: C.stamp, spread: 0.5 }); });
    bp.forEach((p, i) => { if (S.bases[i]) G.kid(c, p.x + (i === 2 ? -1 : 1) * 2.4 * p.s, p.y, 1.7 * p.s, { bib: C.bib, cap: C.navy, spread: 0.6 }); });
    // 투수
    const wk = S.phase === 'windup' ? 1 - S.tp / 0.8 : S.phase === 'pitch' ? 1 + Math.min(1, S.P.t / 0.15) : 0;
    const armR = wk <= 1 ? lerp(0.3, 3.3, G.ease.out(wk)) : lerp(3.3, 0.6, wk - 1);
    G.kid(c, mound.x, mound.y, 1.8 * mound.s, { shirt: C.wallD, pants: C.steel, cap: C.stamp, aR: armR, aL: wk > 0 && wk <= 1 ? 1.4 * wk : 0.3, sq: wk > 1 ? 0.3 * (wk - 1) : 0 });
    // 홈플레이트와 스트라이크 존
    const hp = proj(0, 0, 0); c.fillStyle = C.lime; c.beginPath(); c.moveTo(hp.x - 0.22 * hp.s, hp.y - 4); c.lineTo(hp.x + 0.22 * hp.s, hp.y - 4); c.lineTo(hp.x + 0.22 * hp.s, hp.y + 6); c.lineTo(hp.x, hp.y + 16); c.lineTo(hp.x - 0.22 * hp.s, hp.y + 6); c.closePath(); c.fill();
    const z0 = proj(-ZX, ZY + ZH, 0), z1 = proj(ZX, ZY - ZH, 0);
    c.strokeStyle = 'rgba(243,240,230,.55)'; c.lineWidth = 2.5; c.setLineDash([7, 9]); c.strokeRect(z0.x, z0.y, z1.x - z0.x, z1.y - z0.y); c.setLineDash([]);
    // 던진 공
    if (S.P && (S.phase === 'pitch' || (S.phase === 'call' && S.tp > 1.2))) {
      const P = S.P, p = Math.min(1.1, P.t / P.tt), b = ballPos(p), q = proj(b.x, b.y, b.z), g = LV[S.lv].guide;
      if (g && p > 1 - g * 0.62 && p < 1.02 && !P.swung) {
        const f = proj(P.tx, P.tyy, 0), k = clamp((1 - p) / (g * 0.62), 0, 1), r0 = 0.07 * S.sc;
        c.strokeStyle = C.yellow; c.lineWidth = 3; c.beginPath(); c.arc(f.x, f.y, r0 * (1 + 2.6 * k), 0, 6.283); c.stroke();
      }
      if (S.phase === 'pitch') drawBall(c, q, Math.max(2.5, 0.07 * q.s));
    }
    // 친 공
    if (S.hit && S.phase !== 'wait') {
      const h = S.hit, hidden = h.z > 100 && h.y < 2.6;
      h.trail.forEach((t, i) => { c.globalAlpha = (i / h.trail.length) * 0.5; c.fillStyle = C.lime; c.beginPath(); c.arc(t.x, t.y, Math.max(1.2, 0.05 * t.s), 0, 6.283); c.fill(); }); c.globalAlpha = 1;
      if (!hidden && S.phase === 'hit') { const g2 = proj(h.x, 0, h.z); c.fillStyle = 'rgba(32,38,43,.25)'; c.beginPath(); c.ellipse(g2.x, g2.y, Math.max(2, 0.08 * g2.s), Math.max(1, 0.03 * g2.s), 0, 0, 6.283); c.fill(); const q = proj(h.x, h.y, h.z); drawBall(c, q, Math.max(2.5, 0.07 * q.s)); }
    }
    // 타자와 방망이
    const bh = Math.min(H * 0.5, W * 1.1), bx = W * 0.1, by = H * 1.03;
    G.kid(c, bx, by, bh, { back: true, bib: C.bib, num: 7, cap: C.navy, aL: -1.3, aR: 1.4, spread: 0.6 });
    const pv = { x: bx + bh * 0.46, y: by - bh * 0.66 }; let ang = -2.25, L = bh * 0.52;
    if (S.swing) { const sw = S.swing, k = Math.min(1, sw.t / 0.16), a1 = Math.atan2(sw.y - pv.y, sw.x - pv.x); ang = lerp(-2.25, a1 + 1.25, G.ease.out(k)); L = Math.max(L, Math.hypot(sw.x - pv.x, sw.y - pv.y) * 1.12); }
    const tx = pv.x + Math.cos(ang) * L, ty = pv.y + Math.sin(ang) * L;
    G.line(c, pv.x, pv.y, tx, ty, bh * 0.062, C.dark); G.line(c, pv.x, pv.y, tx, ty, bh * 0.042, WOOD);
    c.fillStyle = C.skin; c.beginPath(); c.arc(pv.x, pv.y, bh * 0.045, 0, 6.283); c.fill();
    if (S.stage === 0 && S.pitches <= 2 && (S.phase === 'windup' || S.phase === 'pitch')) { c.font = '700 16px "Gothic A1"'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = C.dark; c.lineJoin = 'round'; const s = '노란 원이 공만 해지는 순간, 공을 누른다'; c.strokeText(s, W / 2, H * 0.46); c.fillStyle = C.lime; c.fillText(s, W / 2, H * 0.46); }
    fx.draw(c, W, H);
    c.restore();
    // 점수판
    const top = 14 + G.safeTop;
    if (S.stage >= 0) {
      const them = S.need + 1, us = 2 + S.runs;
      G.label(c, 14, top + 10, '우리'); G.label(c, 62, top + 10, '상대');
      G.flip(c, 14, top + 20, String(Math.min(us, 9)), 40); G.flip(c, 62, top + 20, String(them), 40, C.lime);
    } else { G.label(c, 14, top + 10, '루타'); G.flip(c, 14, top + 20, String(S.total).padStart(2, '0'), 40); }
    const lx = 112, lamp = (row, n, on, col, lab) => { G.label(c, lx, top + 22 + row * 17, lab, C.lime, 12); for (let i = 0; i < n; i++) { c.fillStyle = i < on ? col : 'rgba(32,38,43,.35)'; c.beginPath(); c.arc(lx + 20 + i * 15, top + 18 + row * 17, 5.5, 0, 6.283); c.fill(); } };
    lamp(0, 3, S.balls, '#58B368', 'B'); lamp(1, 2, S.strikes, C.yellow, 'S'); lamp(2, 2, S.outs, C.stamp, 'O');
    const dx = 196, dy = top + 36; [[1, 0, 0], [0, -1, 1], [-1, 0, 2]].forEach((d) => { c.save(); c.translate(dx + d[0] * 13, dy + d[1] * 13); c.rotate(0.785); c.fillStyle = S.bases[d[2]] ? C.yellow : 'rgba(32,38,43,.35)'; c.fillRect(-6, -6, 12, 12); c.restore(); });
  }

  cv.addEventListener('pointerdown', (e) => {
    if (!G.ui.playing || G.paused || S.phase !== 'pitch' || S.P.swung) return;
    const r = cv.getBoundingClientRect(); swing(e.clientX - r.left, e.clientY - r.top);
  });

  G.ui.init({
    key: 'bb', title: '9회말 2아웃', tag: '공 하나에 경기가 뒤집힌다', sheet: '끝내기 기록표', stages: ST.length,
    endless: '끝없는 타석', endlessTag: '아웃 세 개까지', unit: '루타',
    win: ['진땀 끝내기', '깔끔한 끝내기', '완벽한 끝내기'], lose: '경기 끝',
    start: begin,
  });
  G.fonts(() => G.loop(update, render));
  window.__bb = { S, swing, proj, ballPos, ST };
})();
