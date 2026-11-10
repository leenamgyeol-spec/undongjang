// 방과 후 운동장 · 세 게임이 같이 쓰는 도구
(function () {
  'use strict';
  const G = (window.G = {});
  const C = (G.C = {
    dirt: '#CDAA7A', dirtD: '#B8935F', turf: '#3D7A58', turfD: '#2F6346', track: '#A8503A',
    lime: '#F3F0E6', dark: '#20262B', yellow: '#F4C531', stamp: '#D2362B', sky: '#B9D6E6',
    wall: '#E4DDD0', wallD: '#CFC6B5', glass: '#6E8FA3', ink: '#1F2A44', fence: '#2E5B45',
    tree: '#4C8A4F', treeD: '#3B6F40', bib: '#E8742A', bibK: '#C9DD3A', navy: '#2B3A67',
    skin: '#E9BE95', hair: '#2A2320', steel: '#5E6B73', rim: '#D9482B',
  });
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.ease = {
    out: (t) => 1 - Math.pow(1 - t, 3),
    back: (t) => { const c = 1.70158, m = t - 1; return 1 + (c + 1) * m * m * m + c * m * m; },
  };

  // ---------- 저장 (버전 + 임시 쓰기 + 백업) ----------
  const KEY = 'undongjang.save';
  const DEF = () => ({ version: 1, opt: { sound: true, calm: false },
    fk: { st: [], best: 0 }, bb: { st: [], best: 0 }, hp: { st: [], best: 0 } });
  const valid = (d) => d && d.version === 1 && d.opt && ['fk', 'bb', 'hp'].every((k) => d[k] && Array.isArray(d[k].st));
  G.save = {
    data: DEF(),
    load() {
      for (const k of [KEY, KEY + '_bak']) {
        try { const d = JSON.parse(localStorage.getItem(k)); if (valid(d)) { this.data = d; return; } } catch (e) {}
      }
      this.data = DEF();
    },
    write() {
      try {
        const s = JSON.stringify(this.data);
        localStorage.setItem(KEY + '_tmp', s);
        if (localStorage.getItem(KEY + '_tmp') !== s) return;
        const cur = localStorage.getItem(KEY);
        if (cur) localStorage.setItem(KEY + '_bak', cur);
        localStorage.setItem(KEY, s);
        localStorage.removeItem(KEY + '_tmp');
      } catch (e) {}
    },
  };
  G.save.load();

  // ---------- 소리 (전부 합성) ----------
  const A = (G.audio = { ctx: null });
  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const x = (A.ctx = new AC());
    A.master = x.createGain();
    A.master.gain.value = G.save.data.opt.sound ? 0.8 : 0;
    const comp = x.createDynamicsCompressor();
    A.master.connect(comp); comp.connect(x.destination);
    const n = x.sampleRate, b = x.createBuffer(1, n, n), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    A.nz = b;
  };
  A.setOn = (v) => { if (A.master) A.master.gain.value = v ? 0.8 : 0; };
  function tone(f, dur, o) {
    o = o || {}; const x = A.ctx; if (!x) return null;
    const t = x.currentTime + (o.at || 0), os = x.createOscillator(), g = x.createGain();
    os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t);
    if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.g || 0.3, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(g); g.connect(A.master); os.start(t); os.stop(t + dur + 0.03);
    return os;
  }
  function noise(dur, o) {
    const x = A.ctx; if (!x) return;
    const t = x.currentTime + (o.at || 0), s = x.createBufferSource(), f = x.createBiquadFilter(), g = x.createGain();
    s.buffer = A.nz; s.loop = true;
    f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t + dur);
    f.Q.value = o.q || 1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.g || 0.3, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }
  const v = () => Math.pow(2, (Math.random() * 2 - 1) / 12); // 반음 안팎으로 흔들기
  A.kick = (p) => { tone(150 * v(), 0.16, { to: 45, g: 0.5 + 0.3 * (p || 0) }); noise(0.07, { f: 1800, q: 0.7, g: 0.35 }); };
  A.thud = () => { tone(110 * v(), 0.12, { to: 50, g: 0.45 }); noise(0.05, { type: 'lowpass', f: 600, g: 0.3 }); };
  A.bounce = (p) => { tone(190 * v(), 0.1, { to: 80, g: 0.2 + 0.3 * (p == null ? 0.5 : p) }); noise(0.03, { type: 'lowpass', f: 900, g: 0.15 }); };
  A.post = () => { [523, 1318, 2140, 3310].forEach((f, i) => tone(f * v(), 0.7 - i * 0.12, { g: 0.22 / (i + 1), type: i ? 'sine' : 'triangle' })); noise(0.03, { f: 3000, g: 0.3 }); };
  A.rim = () => { [820, 1740, 2650].forEach((f, i) => tone(f * v(), 0.25, { g: 0.16 / (i + 1), type: 'triangle' })); };
  A.net = () => noise(0.28, { type: 'highpass', f: 2500, fto: 900, q: 0.5, g: 0.3, a: 0.02 });
  A.crack = (q) => { noise(0.04, { f: 2200 + 1500 * q, q: 1.5, g: 0.6 }); tone(900 * v(), 0.07, { to: 300, type: 'triangle', g: 0.3 + 0.2 * q }); tone(260, 0.09, { to: 120, g: 0.3 }); };
  A.whoosh = () => noise(0.16, { f: 500, fto: 1600, q: 1.2, g: 0.18, a: 0.05 });
  A.mitt = () => { noise(0.06, { type: 'lowpass', f: 1400, g: 0.5 }); tone(140, 0.08, { to: 70, g: 0.3 }); };
  A.whistle = (long) => {
    const x = A.ctx; if (!x) return; const d = long ? 0.7 : 0.22;
    [2850, 2990].forEach((f) => {
      const os = tone(f, d, { type: 'square', g: 0.05, a: 0.01 });
      if (os) { const l = x.createOscillator(), lg = x.createGain(); l.frequency.value = 38; lg.gain.value = 60; l.connect(lg); lg.connect(os.frequency); l.start(); l.stop(x.currentTime + d + 0.1); }
    });
    noise(d, { type: 'highpass', f: 5000, g: 0.04 });
  };
  A.cheer = (s) => { s = s || 1; noise(1.3 * s, { f: 1100, fto: 1500, q: 0.6, g: 0.2 * s, a: 0.25 }); noise(1.1 * s, { f: 2600, q: 0.9, g: 0.09 * s, a: 0.3 }); };
  A.aw = () => noise(0.7, { f: 800, fto: 320, q: 1.2, g: 0.14, a: 0.12 });
  A.bell = () => { [659.25, 523.25, 587.33, 392].forEach((f, i) => { tone(f, 1.1, { at: i * 0.42, g: 0.22, a: 0.004 }); tone(f * 2.76, 0.5, { at: i * 0.42, g: 0.05 }); }); };
  A.tick = () => tone(1200, 0.03, { type: 'square', g: 0.05 });
  A.stamp = () => { tone(90, 0.1, { to: 50, g: 0.5 }); noise(0.04, { type: 'lowpass', f: 500, g: 0.4 }); };
  A.chalk = () => noise(0.09, { f: 3200 * v(), q: 2, g: 0.08, a: 0.01 });
  window.addEventListener('pointerdown', () => A.init(), { capture: true });

  // ---------- 캔버스와 고정 간격 루프 ----------
  G.canvas = function (cv, onResize) {
    const ctx = cv.getContext('2d'), V = { ctx, W: 0, H: 0 };
    function fit() {
      const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      V.W = r.width; V.H = r.height;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (onResize) onResize(V);
    }
    new ResizeObserver(fit).observe(cv); fit();
    return V;
  };
  G.safeTop = 0;
  (function () {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden';
    document.body.appendChild(d);
    const m = () => { G.safeTop = d.getBoundingClientRect().height || 0; };
    m(); window.addEventListener('resize', m);
  })();
  G.time = 0; G.paused = false; G.slow = 1;
  let stopUntil = 0;
  G.hitStop = (ms) => { stopUntil = performance.now() + ms; };
  G.loop = function (update, render) {
    const STEP = 1 / 120; let last = 0, acc = 0;
    function run(dt) {
      if (performance.now() < stopUntil) dt *= 0.05;
      const sdt = dt * G.slow;
      acc += sdt; let n = 0;
      while (acc >= STEP && n < 30) { update(STEP); acc -= STEP; G.time += STEP; n++; }
      if (n >= 30) acc = 0;
      G.fx.update(dt); render();
    }
    function frame(t) {
      t /= 1000; const dt = Math.min(t - last, 0.1); last = t;
      if (!G.paused) run(dt); else render();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame((t) => { last = t / 1000; requestAnimationFrame(frame); });
    G.tick = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) run(1 / 60); }; // 시험용
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.ui && G.ui.playing) G.ui.pause(); });

  // ---------- 흔들림 · 가루 · 글자 ----------
  const fx = (G.fx = { trauma: 0, t: 0, parts: [], texts: [], banner: null });
  fx.shake = (a) => { fx.trauma = Math.min(1, fx.trauma + a * (G.save.data.opt.calm ? 0.25 : 1)); };
  fx.offset = () => {
    const s = fx.trauma * fx.trauma, t = fx.t * 30;
    return { x: 11 * s * (0.6 * Math.sin(t * 1.7) + 0.4 * Math.sin(t * 3.1 + 1)), y: 8 * s * (0.6 * Math.sin(t * 2.3 + 2) + 0.4 * Math.sin(t * 3.7)) };
  };
  fx.burst = (x, y, n, col, o) => {
    o = o || {};
    for (let i = 0; i < n && fx.parts.length < 160; i++) {
      const a = (o.ang == null ? Math.random() * 6.283 : o.ang + (Math.random() - 0.5) * (o.spread || 1)), sp = G.rand(o.v0 || 30, o.v1 || 140);
      fx.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.g == null ? 260 : o.g, life: 0, max: G.rand(0.3, o.life || 0.7), r: G.rand(o.r0 || 2, o.r1 || 5), col });
    }
  };
  fx.text = (x, y, str, col, size) => fx.texts.push({ x, y, str, col: col || C.lime, size: size || 26, life: 0, drift: G.rand(-14, 14) });
  fx.say = (str, sub, col) => { fx.banner = { str, sub, col: col || C.lime, life: 0 }; };
  fx.update = (dt) => {
    fx.t += dt; fx.trauma = Math.max(0, fx.trauma - 1.3 * dt);
    for (let i = fx.parts.length - 1; i >= 0; i--) {
      const p = fx.parts[i]; p.life += dt;
      if (p.life >= p.max) { fx.parts[i] = fx.parts[fx.parts.length - 1]; fx.parts.pop(); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 1.5 * dt;
    }
    for (let i = fx.texts.length - 1; i >= 0; i--) { const t = fx.texts[i]; t.life += dt; if (t.life > 1.1) fx.texts.splice(i, 1); }
    if (fx.banner) { fx.banner.life += dt; if (fx.banner.life > 1.7) fx.banner = null; }
  };
  fx.draw = (c, W, H) => {
    for (const p of fx.parts) { c.globalAlpha = 1 - p.life / p.max; c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill(); }
    c.globalAlpha = 1; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (const t of fx.texts) {
      const k = Math.min(1, t.life / 0.16), s = t.size * (0.6 + 0.4 * G.ease.back(k));
      c.globalAlpha = t.life > 0.8 ? 1 - (t.life - 0.8) / 0.3 : 1;
      c.font = s + 'px "Do Hyeon"';
      const y = t.y - 46 * G.ease.out(Math.min(1, t.life)), x = t.x + t.drift * t.life;
      c.lineWidth = 5; c.strokeStyle = C.dark; c.strokeText(t.str, x, y); c.fillStyle = t.col; c.fillText(t.str, x, y);
    }
    c.globalAlpha = 1;
    const b = fx.banner;
    if (b) {
      const k = Math.min(1, b.life / 0.2), s = Math.min(W * 0.2, 86) * (0.5 + 0.5 * G.ease.back(k));
      c.globalAlpha = b.life > 1.35 ? Math.max(0, 1 - (b.life - 1.35) / 0.35) : 1;
      c.font = s + 'px "Do Hyeon"'; c.lineWidth = 9; c.strokeStyle = C.dark;
      c.strokeText(b.str, W / 2, H * 0.27); c.fillStyle = b.col; c.fillText(b.str, W / 2, H * 0.27);
      if (b.sub) { c.font = '17px "Gothic A1"'; c.lineWidth = 4; c.strokeText(b.sub, W / 2, H * 0.27 + s * 0.72); c.fillStyle = C.lime; c.fillText(b.sub, W / 2, H * 0.27 + s * 0.72); }
      c.globalAlpha = 1;
    }
  };

  // ---------- 그리기 도구 ----------
  G.rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  G.line = (c, x1, y1, x2, y2, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
  // 넘기는 숫자 점수판
  G.flip = (c, x, y, str, h, col) => {
    const w = h * 0.66; c.font = h * 0.84 + 'px "Do Hyeon"'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < str.length; i++) {
      const cx = x + i * (w + 3);
      c.fillStyle = C.dark; G.rr(c, cx, y, w, h, 3); c.fill();
      c.fillStyle = col || C.yellow; c.fillText(str[i], cx + w / 2, y + h * 0.56);
      c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(cx, y + h / 2 - 0.6, w, 1.2);
      c.fillStyle = '#9AA1A6'; c.fillRect(cx + w * 0.26 - 1.5, y - 3, 3, 6); c.fillRect(cx + w * 0.74 - 1.5, y - 3, 3, 6);
    }
    return str.length * (w + 3);
  };
  G.label = (c, x, y, str, col, size) => { c.font = '700 ' + (size || 12) + 'px "Gothic A1"'; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.lineWidth = 3; c.strokeStyle = 'rgba(32,38,43,.55)'; c.lineJoin = 'round'; c.strokeText(str, x, y); c.fillStyle = col || C.lime; c.fillText(str, x, y); };
  // 체육복 입은 아이. (x,y)는 발 위치, h는 키(px)
  G.kid = (c, x, y, h, o) => {
    o = o || {}; const u = h / 8;
    c.save(); c.translate(x, y);
    if (o.rot) { c.translate(0, -h * 0.5); c.rotate(o.rot); c.translate(0, h * 0.5); }
    if (o.sq) c.scale(1 + o.sq * 0.22, 1 - o.sq * 0.22);
    c.lineCap = 'round';
    const sp = (o.spread == null ? 0.25 : o.spread) * u;
    G.line(c, -0.55 * u, -3.2 * u, -0.6 * u - sp, -0.3 * u, 0.95 * u, o.pants || C.navy);
    G.line(c, 0.55 * u, -3.2 * u, 0.6 * u + sp, -0.3 * u, 0.95 * u, o.pants || C.navy);
    c.fillStyle = C.dark; c.fillRect(-0.6 * u - sp - 0.6 * u, -0.45 * u, 1.2 * u, 0.45 * u); c.fillRect(0.6 * u + sp - 0.6 * u, -0.45 * u, 1.2 * u, 0.45 * u);
    const aL = o.aL == null ? 0.2 : o.aL, aR = o.aR == null ? 0.2 : o.aR, al = 2.5 * u;
    const arm = (sx, a, sgn) => { const ex = sx + sgn * Math.sin(a) * al, ey = -5.7 * u + Math.cos(a) * al; G.line(c, sx, -5.7 * u, ex, ey, 0.72 * u, C.skin); G.line(c, sx, -5.7 * u, sx + (ex - sx) * 0.35, -5.7 * u + (ey + 5.7 * u) * 0.35, 0.8 * u, o.shirt || C.lime); };
    arm(-1.25 * u, aL, -1); arm(1.25 * u, aR, 1);
    c.fillStyle = o.shirt || C.lime; G.rr(c, -1.35 * u, -6.2 * u, 2.7 * u, 3.3 * u, 0.5 * u); c.fill();
    if (o.bib) { c.fillStyle = o.bib; G.rr(c, -1.1 * u, -6.0 * u, 2.2 * u, 2.5 * u, 0.3 * u); c.fill(); }
    if (o.num != null) { c.fillStyle = o.numCol || C.dark; c.font = 1.5 * u + 'px "Do Hyeon"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.num, 0, -4.7 * u); }
    c.fillStyle = C.skin; c.beginPath(); c.arc(0, -7.05 * u, 0.98 * u, 0, 6.283); c.fill();
    c.fillStyle = o.hair || C.hair; c.beginPath();
    if (o.back) c.arc(0, -7.05 * u, 1.02 * u, 0, 6.283); else c.arc(0, -7.15 * u, 1.02 * u, Math.PI * 1.02, Math.PI * 1.98);
    c.fill();
    if (o.cap) { c.fillStyle = o.cap; c.beginPath(); c.arc(0, -7.2 * u, 1.05 * u, Math.PI, 0); c.fill(); c.fillRect(-0.2 * u, -7.3 * u, 1.7 * u, 0.3 * u); }
    c.restore();
  };
  // 배경: 학교 건물과 울타리 (지평선 y, 가운데 x)
  G.school = (c, cx, hy, w, W) => {
    const bh = w * 0.2, x0 = cx - w / 2;
    c.fillStyle = C.treeD; for (let i = -1; i < 9; i++) { const tx = cx - w * 0.9 + i * w * 0.24; c.beginPath(); c.arc(tx, hy - bh * 0.34, bh * 0.42, 0, 6.283); c.fill(); }
    c.fillStyle = C.tree; for (let i = -1; i < 9; i++) { const tx = cx - w * 0.9 + i * w * 0.24; c.beginPath(); c.arc(tx - bh * 0.1, hy - bh * 0.42, bh * 0.3, 0, 6.283); c.fill(); }
    c.fillStyle = C.wall; c.fillRect(x0, hy - bh, w, bh);
    c.fillStyle = C.wallD; c.fillRect(x0, hy - bh, w, bh * 0.07); c.fillRect(cx - w * 0.07, hy - bh * 1.16, w * 0.14, bh * 1.16);
    c.fillStyle = C.glass;
    for (let r = 0; r < 3; r++) for (let i = 0; i < 16; i++) { if (i === 7 || i === 8) continue; c.fillRect(x0 + w * 0.02 + i * w * 0.06, hy - bh * 0.86 + r * bh * 0.27, w * 0.042, bh * 0.15); }
    c.fillStyle = C.lime; c.beginPath(); c.arc(cx, hy - bh * 0.92, bh * 0.11, 0, 6.283); c.fill();
    c.strokeStyle = C.dark; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx, hy - bh * 0.92); c.lineTo(cx, hy - bh * 1.0); c.moveTo(cx, hy - bh * 0.92); c.lineTo(cx + bh * 0.06, hy - bh * 0.9); c.stroke();
    c.fillStyle = C.dark; c.fillRect(cx - w * 0.035, hy - bh * 0.42, w * 0.07, bh * 0.42);
    c.fillStyle = C.fence; c.fillRect(0, hy - bh * 0.16, W, bh * 0.16);
    c.fillStyle = 'rgba(243,240,230,.25)'; for (let i = 0; i < W; i += 14) c.fillRect(i, hy - bh * 0.16, 1, bh * 0.16);
  };
  G.flag = (c, x, y, wind) => { // 바람 깃발. wind: -1..1
    G.line(c, x, y, x, y - 34, 2.5, C.dark);
    if (Math.abs(wind) < 0.02) { c.fillStyle = C.stamp; c.fillRect(x, y - 34, 4, 16); return; }
    const L = 10 + 20 * Math.abs(wind), s = Math.sign(wind), w = Math.sin(fx.t * (5 + 6 * Math.abs(wind))) * 3;
    c.fillStyle = C.stamp; c.beginPath(); c.moveTo(x, y - 34); c.quadraticCurveTo(x + s * L * 0.5, y - 36 + w, x + s * L, y - 31 - w); c.lineTo(x + s * L, y - 21 - w); c.quadraticCurveTo(x + s * L * 0.5, y - 24 + w, x, y - 22); c.closePath(); c.fill();
  };
  G.hint = (c, x1, y1, x2, y2, bend, str, W, H) => { // 손가락 길잡이
    const k = (fx.t % 1.6) / 1.1; if (k > 1.25) return;
    const kk = Math.min(1, k), e = G.ease.out(kk);
    const mx = (x1 + x2) / 2 + bend, my = (y1 + y2) / 2;
    const px = (1 - e) * (1 - e) * x1 + 2 * (1 - e) * e * mx + e * e * x2, py = (1 - e) * (1 - e) * y1 + 2 * (1 - e) * e * my + e * e * y2;
    c.globalAlpha = 0.75; c.strokeStyle = C.lime; c.lineWidth = 4; c.lineCap = 'round'; c.setLineDash([2, 10]);
    c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(mx, my, x2, y2); c.stroke(); c.setLineDash([]);
    c.fillStyle = C.lime; c.beginPath(); c.arc(px, py, 13, 0, 6.283); c.fill();
    c.globalAlpha = 1;
    if (str) { c.font = '700 16px "Gothic A1"'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = C.dark; c.lineJoin = 'round'; c.strokeText(str, W / 2, H * 0.92); c.fillStyle = C.lime; c.fillText(str, W / 2, H * 0.92); }
  };
  G.fonts = (cb) => {
    const f = document.fonts;
    if (!f || !f.load) return cb();
    let done = false; const go = () => { if (!done) { done = true; cb(); } };
    Promise.all([f.load('20px "Do Hyeon"', '운동장0'), f.load('700 16px "Gothic A1"', '운동장0')]).then(go, go);
    setTimeout(go, 2500);
  };

  // ---------- 메뉴 · 결과 쪽지 ----------
  const $ = (id) => document.getElementById(id);
  const ui = (G.ui = { playing: false });
  ui.init = function (cfg) {
    ui.cfg = cfg;
    $('ui').innerHTML =
      '<section class="screen menu" id="sMenu"><a class="back" href="./">‹ 운동장으로</a>' +
      '<h1>' + cfg.title + '</h1><p class="tag">' + cfg.tag + '</p>' +
      '<div class="sheet"><i class="mag m1"></i><i class="mag m2"></i><div class="sheet-head"><b>' + cfg.sheet + '</b><span id="stTotal"></span></div><div class="grid" id="grid"></div></div>' +
      '<button class="btn main" id="bEndless"><b>' + cfg.endless + '</b><span id="bestTxt"></span></button>' +
      '<div class="opts"><button class="opt" id="oSound">소리</button><button class="opt" id="oCalm">흔들림 줄이기</button></div></section>' +
      '<button id="bPause" aria-label="잠깐 멈춤"><i></i><i></i></button>' +
      '<section class="slipwrap" id="sSlip"><div class="slip" id="slip"></div></section>';
    $('grid').addEventListener('click', (e) => { const b = e.target.closest('.cell'); if (b && !b.classList.contains('lock')) ui.start(+b.dataset.i); });
    $('bEndless').onclick = () => ui.start(-1);
    $('bPause').onclick = () => ui.pause();
    const opt = G.save.data.opt;
    $('oSound').onclick = () => { opt.sound = !opt.sound; A.setOn(opt.sound); G.save.write(); ui.menu(); };
    $('oCalm').onclick = () => { opt.calm = !opt.calm; G.save.write(); ui.menu(); };
    ui.menu();
  };
  ui.start = (i) => { ui.last = i; ui.playing = true; G.paused = false; $('sMenu').classList.remove('on'); $('sSlip').classList.remove('on'); $('bPause').classList.add('on'); fx.banner = null; fx.texts.length = 0; ui.cfg.start(i); };
  ui.menu = function () {
    const cfg = ui.cfg, sv = G.save.data[cfg.key], opt = G.save.data.opt;
    ui.playing = false; G.paused = false;
    let html = '', total = 0;
    for (let i = 0; i < cfg.stages; i++) {
      const s = sv.st[i] || 0, open = i === 0 || (sv.st[i - 1] || 0) > 0; total += s;
      html += '<button class="cell' + (open ? '' : ' lock') + '" data-i="' + i + '"' + (open ? '' : ' disabled') + ' aria-label="' + (i + 1) + '번, 도장 ' + s + '개"><b>' + (i + 1) + '</b><span class="dots">' + [1, 2, 3].map((n) => '<i' + (s >= n ? ' class="on"' : '') + '></i>').join('') + '</span></button>';
    }
    $('grid').innerHTML = html;
    $('stTotal').textContent = '도장 ' + total + ' / ' + cfg.stages * 3;
    $('bestTxt').textContent = sv.best ? '최고 ' + sv.best + cfg.unit : cfg.endlessTag;
    $('oSound').classList.toggle('on', opt.sound); $('oCalm').classList.toggle('on', opt.calm);
    $('sMenu').classList.add('on'); $('sSlip').classList.remove('on'); $('bPause').classList.remove('on');
  };
  ui.slip = function (o) {
    let h = '<h2>' + o.title + (o.isNew ? '<span class="new">신기록</span>' : '') + '</h2>';
    if (o.sub) h += '<p>' + o.sub + '</p>';
    if (o.stamps != null) h += '<div class="stamps">' + [1, 2, 3].map((n) => '<i' + (o.stamps >= n ? ' class="on"' : '') + '></i>').join('') + '</div>';
    h += '<div class="row">' + o.buttons.map((b, i) => '<button class="btn ' + (b.kind || '') + '" data-b="' + i + '"><b>' + b.label + '</b></button>').join('') + '</div>';
    $('slip').innerHTML = h;
    $('slip').onclick = (e) => { const b = e.target.closest('[data-b]'); if (b) o.buttons[+b.dataset.b].fn(); };
    $('sSlip').classList.add('on'); $('bPause').classList.remove('on');
    if (o.stamps) for (let i = 0; i < o.stamps; i++) setTimeout(() => A.stamp(), 120 + i * 280);
  };
  ui.pause = function () {
    if (!ui.playing || G.paused) return;
    G.paused = true;
    ui.slip({ title: '잠깐 멈춤', buttons: [
      { label: '계속하기', kind: 'main', fn: () => { G.paused = false; $('sSlip').classList.remove('on'); $('bPause').classList.add('on'); } },
      { label: '처음부터 다시', fn: () => ui.start(ui.last) },
      { label: '목록으로', kind: 'plain', fn: () => ui.menu() }] });
  };
  // 스테이지 끝: 도장 0이면 실패
  ui.endStage = function (i, stamps, sub) {
    const cfg = ui.cfg, sv = G.save.data[cfg.key];
    ui.playing = false;
    if (stamps > (sv.st[i] || 0)) { sv.st[i] = stamps; G.save.write(); }
    const btn = [];
    if (stamps > 0 && i + 1 < cfg.stages) btn.push({ label: (i + 2) + '번으로', kind: 'main', fn: () => ui.start(i + 1) });
    btn.push({ label: '한 번 더', kind: stamps > 0 && i + 1 < cfg.stages ? '' : 'main', fn: () => ui.start(i) });
    btn.push({ label: '목록으로', kind: 'plain', fn: () => ui.menu() });
    ui.slip({ title: stamps > 0 ? cfg.win[stamps - 1] : cfg.lose, sub, stamps, buttons: btn });
  };
  ui.endEndless = function (score, sub) {
    const cfg = ui.cfg, sv = G.save.data[cfg.key], isNew = score > sv.best;
    ui.playing = false;
    if (isNew) { sv.best = score; G.save.write(); }
    ui.slip({ title: score + cfg.unit, sub: sub || (isNew ? '' : '최고 기록은 ' + sv.best + cfg.unit), isNew, buttons: [
      { label: '한 번 더', kind: 'main', fn: () => ui.start(-1) }, { label: '목록으로', kind: 'plain', fn: () => ui.menu() }] });
  };
})();
