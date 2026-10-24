"use strict";
/* =================================================================
   FINANCE RUN: canvas drawing. Everything is drawn in logical units
   (height >= 540) and scaled, so every screen size plays the same.
   ================================================================= */
const Render = (() => {
  const cv = $("stage"), cx = cv.getContext("2d");
  const INK = "#2b1d5c";
  const DISPLAY = "'Lilita One','Arial Rounded MT Bold','Trebuchet MS',sans-serif";
  const THEMES = [
    { sky: ["#5fcfff", "#d4f7ff"], far: "#a5e88f", mid: "#62c770", road: ["#ffd98a", "#ffcb66"], line: "#fff6db", edge: "#7b5cff", under: "#5a3fd1", decor: "houses", sun: "#fff27a" },
    { sky: ["#ff8a5c", "#ffd770"], far: "#ff9e8a", mid: "#2fb3d6", road: ["#d39463", "#c07f4c"], line: "#f7d9b5", edge: "#5a2d82", under: "#43206a", decor: "harbor", sun: "#fff1a8" },
    { sky: ["#2fdcc4", "#d2fff4"], far: "#27b49f", mid: "#1f9c86", road: ["#ffe7a3", "#ffd97f"], line: "#fffae6", edge: "#ff5c93", under: "#d13d72", decor: "palms", sun: "#fffbd0" },
    { sky: ["#140c3a", "#5a2aa8"], far: "#2a1a66", mid: "#3d2785", road: ["#2b2452", "#352c63"], line: "#7df9ff", edge: "#ff4fd8", under: "#a3289a", decor: "city", sun: "#f3f0ff" }
  ];
  let fx = [];
  const hash = n => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

  function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    G.dpr = Math.min(window.devicePixelRatio || 1, 2);
    G.W = Math.max(1, r.width); G.H = Math.max(1, r.height);
    cv.width = Math.round(G.W * G.dpr); cv.height = Math.round(G.H * G.dpr);
    let scale = G.H / 540, lw = G.W / scale;
    if (lw < 600) { scale = G.W / 600; lw = 600; }
    G.speedScale = clamp(lw / 900, 0.66, 1);
    G.scale = scale; G.LW = lw; G.LH = G.H / scale;
    G.PX = Math.min(200, Math.max(150, lw * 0.16));
    if (S.mode && S.mode !== "title") S.py = laneY(S.lane);
  }

  function rr(x, y, w, h, r) {
    cx.beginPath(); cx.moveTo(x + r, y);
    cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r);
    cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
  }
  const outline = (w = 4) => { cx.lineWidth = w; cx.strokeStyle = INK; cx.lineJoin = "round"; cx.stroke(); };
  function text(t, x, y, size, color, stroke = 0, align = "center") {
    cx.font = `${size}px ${DISPLAY}`; cx.textAlign = align; cx.textBaseline = "middle";
    if (stroke) { cx.lineWidth = stroke; cx.strokeStyle = INK; cx.lineJoin = "round"; cx.strokeText(t, x, y); }
    cx.fillStyle = color; cx.fillText(t, x, y);
  }
  function fitText(t, x, y, maxW, size, color, stroke) {
    cx.font = `${size}px ${DISPLAY}`;
    while (size > 11 && cx.measureText(t).width > maxW) { size -= 1; cx.font = `${size}px ${DISPLAY}`; }
    text(t, x, y, size, color, stroke);
  }

  /* ---------- background ---------- */
  function drawWorld(th, dist, t) {
    const { LW, LH } = G, top = trackTop();
    const sky = cx.createLinearGradient(0, 0, 0, top);
    sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
    cx.fillStyle = sky; cx.fillRect(0, 0, LW, top + 2);

    // sun or moon
    cx.fillStyle = th.sun; cx.globalAlpha = 0.9;
    cx.beginPath(); cx.arc(LW * 0.78, top * 0.32, 46, 0, 7); cx.fill();
    cx.globalAlpha = 0.25; cx.beginPath(); cx.arc(LW * 0.78, top * 0.32, 70, 0, 7); cx.fill();
    cx.globalAlpha = 1;

    if (th.decor === "city") {
      for (let i = 0; i < 60; i++) {
        const sx = (hash(i) * LW * 1.3 - dist * 0.02) % LW, sy = hash(i + 99) * top * 0.7;
        cx.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * Math.abs(Math.sin(t * 2 + i))})`;
        cx.fillRect((sx + LW) % LW, sy, 2.5, 2.5);
      }
    } else {
      cx.fillStyle = "rgba(255,255,255,.9)";
      for (let i = 0; i < 5; i++) {
        const span = LW + 300, x = ((hash(i + 3) * span - dist * (0.05 + i * 0.01)) % span + span) % span - 150;
        const y = 40 + hash(i + 11) * top * 0.35;
        cx.beginPath(); cx.arc(x, y, 26, 0, 7); cx.arc(x + 30, y - 12, 32, 0, 7); cx.arc(x + 64, y, 24, 0, 7); cx.fill();
      }
    }

    // far silhouettes
    const tile = 140, off = (dist * 0.18) % tile, base = Math.floor(dist * 0.18 / tile);
    cx.fillStyle = th.far;
    for (let i = -1; i * tile - off < LW + tile; i++) {
      const h = 50 + hash(base + i) * 80, x = i * tile - off;
      if (th.decor === "city") { cx.fillRect(x, top - h - 40, 90, h + 40); cx.fillRect(x + 96, top - h * 0.6, 40, h * 0.6); }
      else { cx.beginPath(); cx.ellipse(x + 70, top + 8, 110, h, 0, Math.PI, 0); cx.fill(); }
    }
    if (th.decor === "harbor") { cx.fillStyle = th.mid; cx.fillRect(0, top - 34, LW, 34); }

    // mid decor
    const mt = 260, moff = (dist * 0.45) % mt, mb = Math.floor(dist * 0.45 / mt);
    for (let i = -1; i * mt - moff < LW + mt; i++) decor(th, i * mt - moff + 60, top, mb + i, t);

    // track
    const lanesTop = laneY(0) - 42, laneH = 84;
    cx.fillStyle = th.edge; cx.fillRect(0, top - 6, LW, 10);
    for (let l = 0; l < 3; l++) { cx.fillStyle = th.road[l % 2]; cx.fillRect(0, lanesTop + l * laneH, LW, laneH); }
    cx.fillStyle = th.road[1]; cx.fillRect(0, top + 4, LW, lanesTop - top - 4);
    cx.strokeStyle = th.line; cx.lineWidth = 4; cx.setLineDash([34, 30]); cx.lineDashOffset = dist % 64;
    for (let l = 1; l < 3; l++) { const y = lanesTop + l * laneH; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(LW, y); cx.stroke(); }
    cx.setLineDash([]);
    const bot = lanesTop + 3 * laneH;
    cx.fillStyle = th.edge; cx.fillRect(0, bot, LW, 12);
    cx.fillStyle = th.under; cx.fillRect(0, bot + 12, LW, LH - bot);
    cx.fillStyle = "rgba(255,255,255,.18)";
    for (let x = -(dist % 48); x < LW; x += 48) cx.fillRect(x, bot + 24, 22, 6);
  }

  function decor(th, x, top, seed, t) {
    const v = hash(seed * 3.7);
    if (th.decor === "houses") {
      const colors = ["#ff8fb8", "#ffd84d", "#7ee0ff", "#b59cff"];
      const w = 74, h = 54 + v * 20, c = colors[(seed % 4 + 4) % 4];
      cx.fillStyle = c; rr(x, top - h, w, h, 4); cx.fill(); outline(3);
      cx.beginPath(); cx.moveTo(x - 8, top - h + 2); cx.lineTo(x + w / 2, top - h - 34); cx.lineTo(x + w + 8, top - h + 2); cx.closePath();
      cx.fillStyle = "#ff5a5f"; cx.fill(); outline(3);
      cx.fillStyle = "#fff6db"; rr(x + 12, top - h + 14, 18, 16, 3); cx.fill(); outline(2);
      cx.fillStyle = "#7b4a2a"; rr(x + 44, top - 30, 16, 30, 3); cx.fill(); outline(2);
    } else if (th.decor === "harbor") {
      const bob = Math.sin(t * 2 + seed) * 3;
      cx.fillStyle = v > 0.5 ? "#ff5a5f" : "#fff6db";
      cx.beginPath(); cx.moveTo(x, top - 30 + bob); cx.lineTo(x + 90, top - 30 + bob); cx.lineTo(x + 74, top - 10 + bob); cx.lineTo(x + 16, top - 10 + bob); cx.closePath(); cx.fill(); outline(3);
      cx.fillStyle = INK; cx.fillRect(x + 43, top - 92 + bob, 4, 62);
      cx.fillStyle = "#fff"; cx.beginPath(); cx.moveTo(x + 47, top - 90 + bob); cx.lineTo(x + 84, top - 40 + bob); cx.lineTo(x + 47, top - 40 + bob); cx.closePath(); cx.fill(); outline(3);
    } else if (th.decor === "palms") {
      cx.strokeStyle = "#8a5a2b"; cx.lineWidth = 10; cx.lineCap = "round";
      cx.beginPath(); cx.moveTo(x + 30, top); cx.quadraticCurveTo(x + 18, top - 50, x + 36, top - 96); cx.stroke();
      cx.fillStyle = "#2ecc71";
      for (let i = 0; i < 5; i++) { const a = -2.6 + i * 0.6 + Math.sin(t * 1.5 + seed) * 0.05; cx.beginPath(); cx.ellipse(x + 36 + Math.cos(a) * 30, top - 96 + Math.sin(a) * 18, 34, 10, a, 0, 7); cx.fill(); }
      text("$", x + 30, top - 82, 18, "#ffd84d", 4); text("$", x + 46, top - 88, 16, "#ffd84d", 4);
    } else {
      const h = 70 + v * 60, w = 70;
      cx.fillStyle = th.mid; cx.fillRect(x, top - h, w, h);
      for (let wy = top - h + 10; wy < top - 12; wy += 16) for (let wx = x + 8; wx < x + w - 10; wx += 16) {
        cx.fillStyle = hash(wx * 7 + wy + seed) > 0.45 ? "#ffe066" : "#251a58"; cx.fillRect(wx, wy, 8, 9);
      }
      cx.fillStyle = ["#ff4fd8", "#7df9ff", "#ffe066"][(seed % 3 + 3) % 3];
      cx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4 + seed); cx.fillRect(x + 10, top - h - 8, w - 20, 5); cx.globalAlpha = 1;
    }
  }

  /* ---------- entities ---------- */
  function coin(x, y, t, phase, gold) {
    const r = gold ? 19 : 15, sq = Math.abs(Math.cos(t * 5 + phase)) * 0.75 + 0.25;
    if (gold) { cx.fillStyle = "rgba(255,216,77,.4)"; cx.beginPath(); cx.arc(x, y, r + 9 + Math.sin(t * 8 + phase) * 3, 0, 7); cx.fill(); }
    cx.save(); cx.translate(x, y); cx.scale(sq, 1);
    cx.fillStyle = gold ? "#ffe680" : "#ffd84d"; cx.beginPath(); cx.arc(0, 0, r, 0, 7); cx.fill(); outline(4);
    cx.fillStyle = gold ? "#ff9f1c" : "#ffb703"; cx.beginPath(); cx.arc(0, 0, r - 6, 0, 7); cx.fill();
    cx.restore();
    if (sq > 0.6) text("$", x, y + 1, 16, "#fff6db", 0);
  }
  function drawEnt(e, sx, t) {
    const y = laneY(e.lane), bob = reducedMotion ? 0 : Math.sin(t * 4 + e.wx * 0.01) * 4;
    if (e.k === "coin") {
      // air coins float above a cart's sale sign so the sign stays readable
      if (e.air) { cx.fillStyle = "rgba(255,255,255,.45)"; cx.beginPath(); cx.arc(sx, y - 78 + bob, 22, 0, 7); cx.fill(); }
      return coin(sx, y - (e.air ? 78 : 6) + bob, t, e.wx * 0.03, e.gold);
    }
    if (e.k === "cash") {
      cx.save(); cx.translate(sx, y - 8 + bob); cx.rotate(Math.sin(t * 3 + e.wx) * 0.15);
      cx.fillStyle = "#2ee59d"; rr(-26, -15, 52, 30, 5); cx.fill(); outline(4);
      cx.strokeStyle = "#16a874"; cx.lineWidth = 2; rr(-20, -10, 40, 20, 4); cx.stroke();
      cx.restore(); text("$1", sx, y - 7 + bob, 18, "#fff", 4); return;
    }
    if (e.k === "power") {
      const pulse = 1 + Math.sin(t * 6) * 0.06;
      cx.save(); cx.translate(sx, y - 10 + bob); cx.scale(pulse, pulse);
      cx.fillStyle = e.p === "shield" ? "#4cc9ff" : e.p === "x2" ? "#ffd84d" : "#b59cff";
      cx.beginPath(); cx.arc(0, 0, 24, 0, 7); cx.fill(); outline(4);
      cx.restore();
      if (e.p === "x2") text("x2", sx, y - 9 + bob, 20, "#fff", 5);
      else { cx.font = "24px serif"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText(e.p === "shield" ? "🛡️" : "🧲", sx, y - 9 + bob); }
      return;
    }
    if (e.k === "cart") {
      cx.save(); cx.translate(sx, y);
      cx.fillStyle = INK; cx.beginPath(); cx.arc(-14, 22, 7, 0, 7); cx.arc(16, 22, 7, 0, 7); cx.fill();
      cx.fillStyle = "#ff5a5f"; cx.beginPath(); cx.moveTo(-30, -18); cx.lineTo(30, -18); cx.lineTo(22, 14); cx.lineTo(-22, 14); cx.closePath(); cx.fill(); outline(4);
      cx.strokeStyle = "#ffd0d1"; cx.lineWidth = 3; for (let i = -16; i <= 16; i += 11) { cx.beginPath(); cx.moveTo(i, -14); cx.lineTo(i * 0.8, 10); cx.stroke(); }
      cx.fillStyle = INK; cx.fillRect(28, -40, 4, 26);
      cx.rotate(-0.08); cx.fillStyle = "#ffd84d"; rr(-36, -62, 74, 24, 6); cx.fill(); outline(3);
      cx.restore(); fitText(e.label, sx, y - 50, 64, 14, "#d62839", 0); return;
    }
    if (e.k === "scam") {
      const blink = Math.sin(t * 10) > 0;
      cx.save(); cx.translate(sx, y - 18 + bob);
      cx.shadowColor = "#ff2e63"; cx.shadowBlur = 18;
      cx.fillStyle = "#fff"; rr(-40, -34, 80, 70, 8); cx.fill(); cx.shadowBlur = 0; outline(4);
      cx.fillStyle = "#ff2e63"; rr(-40, -34, 80, 18, 8); cx.fill(); cx.fillRect(-40, -24, 80, 8); outline(0.01);
      cx.restore();
      text("✕", sx + 30, y - 43 + bob, 12, "#fff", 0);
      fitText(e.label, sx, y - 10 + bob, 70, 15, blink ? "#ff2e63" : "#7b5cff", 0);
      cx.font = "18px serif"; cx.textAlign = "center"; cx.fillText("👾", sx, y + 8 + bob);
      return;
    }
    if (e.k === "gate") {
      const cols = ["#ff8fd8", "#4cc9ff", "#ffd84d"];
      cx.fillStyle = INK; cx.fillRect(sx - 3, trackTop() - 70, 6, laneY(2) + 30 - trackTop() + 70);
      cx.fillStyle = "#7b5cff"; rr(sx - 70, trackTop() - 92, 140, 30, 10); cx.fill(); outline(3);
      text("QUIZ GATE", sx, trackTop() - 77, 16, "#fff", 0);
      for (let l = 0; l < 3; l++) {
        const ly = laneY(l) - 18, good = e.done && l === e.okLane, bad = e.done && l !== e.okLane;
        cx.globalAlpha = bad ? 0.35 : 1;
        cx.fillStyle = good ? "#2ee59d" : cols[l]; rr(sx - 66, ly - 22, 132, 44, 10); cx.fill(); outline(4);
        fitText(e.answers[l], sx, ly, 118, 19, INK, 0);
        cx.globalAlpha = 1;
      }
    }
  }

  /* ---------- the runner ---------- */
  function drawPlayer(t) {
    const rn = S.runner, h = jumpH(), x = G.PX, ground = S.py + 30, y = S.py - h;
    const run = reducedMotion || S.mode !== "run" ? 0 : t * 14;
    cx.fillStyle = "rgba(43,29,92,.28)";
    cx.beginPath(); cx.ellipse(x, ground, 26 * (1 - h / 220), 7, 0, 0, 7); cx.fill();
    // streak flames grow with each compounding tier
    const tier = S.mode === "run" ? streakTier() : 0;
    if (tier >= 2 && !reducedMotion) {
      const cols = ["#ffd84d", "#ff9f1c", "#ff5a5f"];
      for (let i = 0; i < 3; i++) {
        cx.globalAlpha = 0.6 - i * 0.15; cx.fillStyle = cols[i];
        cx.beginPath(); cx.ellipse(x - 36 - i * 16, y - 14 + Math.sin(t * 20 + i * 2) * 3, 12 + tier * 2 - i * 3, 9 - i * 2, 0, 0, 7); cx.fill();
      }
      cx.globalAlpha = 1;
    }
    if (S.invuln > 0 && !reducedMotion && Math.sin(t * 40) > 0) return;
    cx.save(); cx.translate(x, y);
    cx.lineCap = "round"; cx.strokeStyle = INK; cx.lineWidth = 9;
    const lg = Math.sin(run) * 10;
    cx.beginPath(); cx.moveTo(-6, 10); cx.lineTo(-8 - lg, 28); cx.stroke();
    cx.beginPath(); cx.moveTo(6, 10); cx.lineTo(8 + lg, 28); cx.stroke();
    cx.strokeStyle = "#fff"; cx.lineWidth = 5;
    cx.beginPath(); cx.moveTo(-8 - lg - 1, 28); cx.lineTo(-8 - lg + 5, 28); cx.stroke();
    cx.beginPath(); cx.moveTo(8 + lg - 1, 28); cx.lineTo(8 + lg + 5, 28); cx.stroke();
    // piggy-bank backpack
    cx.fillStyle = "#ff9ecf"; cx.beginPath(); cx.ellipse(-22, -8, 13, 15, 0, 0, 7); cx.fill(); outline(3);
    cx.fillStyle = INK; cx.beginPath(); cx.arc(-30, -10, 1.8, 0, 7); cx.fill();
    // body
    cx.fillStyle = rn.body; rr(-17, -24, 34, 38, 12); cx.fill(); outline(4);
    cx.fillStyle = rn.trim; rr(-6, -6, 14, 10, 3); cx.fill();
    // arm swing
    cx.strokeStyle = INK; cx.lineWidth = 8; const arm = Math.sin(run + Math.PI) * 9;
    cx.beginPath(); cx.moveTo(6, -14); cx.lineTo(16 + arm * 0.3, 0 + arm * 0.4); cx.stroke();
    cx.strokeStyle = rn.body; cx.lineWidth = 4; cx.stroke();
    // head
    cx.fillStyle = rn.skin; cx.beginPath(); cx.arc(2, -42, 20, 0, 7); cx.fill(); outline(4);
    cx.fillStyle = rn.hair; cx.beginPath(); cx.arc(2, -46, 20, Math.PI * 1.02, Math.PI * 1.98); cx.closePath(); cx.fill();
    cx.fillStyle = "#fff"; cx.beginPath(); cx.ellipse(10, -41, 6, 7, 0, 0, 7); cx.fill();
    cx.fillStyle = INK; cx.beginPath(); cx.arc(12, -40, 3.4, 0, 7); cx.fill();
    cx.fillStyle = "#fff"; cx.beginPath(); cx.arc(13, -42, 1.3, 0, 7); cx.fill();
    cx.fillStyle = "#ff7aa8"; cx.globalAlpha = 0.5; cx.beginPath(); cx.arc(6, -31, 4, 0, 7); cx.fill(); cx.globalAlpha = 1;
    cx.strokeStyle = INK; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(13, -33, 5, 0.2, 1.8); cx.stroke();
    if (S.hat === "shades") { cx.fillStyle = INK; rr(2, -46, 20, 9, 3); cx.fill(); cx.fillRect(-12, -44, 16, 3); }
    if (S.hat === "crown") {
      cx.fillStyle = "#ffd84d"; cx.beginPath(); cx.moveTo(-14, -60); cx.lineTo(-10, -76); cx.lineTo(-2, -66); cx.lineTo(4, -80); cx.lineTo(10, -66); cx.lineTo(18, -76); cx.lineTo(18, -60); cx.closePath(); cx.fill(); outline(3);
    }
    cx.restore();
    if (S.shield > 0) {
      cx.strokeStyle = "#4cc9ff"; cx.lineWidth = 4; cx.globalAlpha = 0.55 + Math.sin(t * 5) * 0.2;
      cx.beginPath(); cx.arc(x, y - 18, 50, 0, 7); cx.stroke(); cx.globalAlpha = 1;
      if (S.shield > 1) { cx.beginPath(); cx.arc(x, y - 18, 57, 0, 7); cx.stroke(); }
    }
    if (S.magnet > 0) {
      cx.strokeStyle = "#b59cff"; cx.lineWidth = 3; cx.setLineDash([10, 8]); cx.lineDashOffset = -t * 60;
      cx.beginPath(); cx.arc(x, y - 18, 64, 0, 7); cx.stroke(); cx.setLineDash([]);
    }
  }

  /* final rush start arch and checkered finish line */
  function rushMarks(R) {
    const top = trackTop(), bot = laneY(2) + 42;
    const a = G.PX + (R.start - 260 - S.dist);
    if (a > -100 && a < G.LW + 120) {
      cx.fillStyle = INK; cx.fillRect(a - 3, top - 70, 6, bot - top + 70);
      cx.fillStyle = "#ffd84d"; rr(a - 86, top - 98, 172, 36, 10); cx.fill(); outline(3);
      text("⚡ FINAL RUSH", a, top - 80, 19, INK, 0);
    }
    const f = G.PX + (R.end - S.dist), sq = 14;
    if (f > -60 && f < G.LW + 120) {
      for (let yy = top + 4, r = 0; yy < bot; yy += sq, r++) for (let c = 0; c < 2; c++) { cx.fillStyle = (r + c) % 2 ? INK : "#fff"; cx.fillRect(f - sq + c * sq, yy, sq, Math.min(sq, bot - yy)); }
      cx.fillStyle = INK; cx.fillRect(f - 3, top - 70, 6, 70);
      cx.fillStyle = "#2ee59d"; rr(f - 58, top - 98, 116, 36, 10); cx.fill(); outline(3);
      text("FINISH", f, top - 80, 19, INK, 0);
    }
  }

  /* ---------- effects ---------- */
  function stepFx(dt) {
    for (const f of fx) {
      f.life -= dt;
      if (f.kind === "txt") f.y -= 60 * dt;
      else { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.kind === "conf" ? 420 : 700) * dt; f.rot = (f.rot || 0) + dt * 8; }
    }
    fx = fx.filter(f => f.life > 0);
  }
  function drawFx() {
    for (const f of fx) {
      cx.globalAlpha = clamp(f.life / 0.4, 0, 1);
      if (f.kind === "txt") text(f.txt, f.x, f.y, 24, f.color, 6);
      else if (f.kind === "conf") { cx.save(); cx.translate(f.x, f.y); cx.rotate(f.rot); cx.fillStyle = f.color; cx.fillRect(-5, -3, 10, 6); cx.restore(); }
      else { cx.fillStyle = f.color; cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, 7); cx.fill(); }
    }
    cx.globalAlpha = 1;
  }

  function draw(dt) {
    const live = S.mode === "run";
    const t = S.t || 0;
    if (live || S.mode === "countdown") stepFx(dt);
    cx.setTransform(G.dpr * G.scale, 0, 0, G.dpr * G.scale, 0, 0);
    cx.save();
    if (S.shake > 0) {
      cx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
      S.shake = live ? S.shake * Math.pow(0.02, dt) : S.shake; if (S.shake < 0.4) S.shake = 0;
    }
    drawWorld(THEMES[S.world] || THEMES[0], S.dist || 0, t);
    if (S.rush) rushMarks(S.rush);
    const rushing = rushLive();
    if ((S.x2 > 0 || rushing) && !reducedMotion) {
      cx.strokeStyle = rushing ? "rgba(255,216,77,.75)" : "rgba(255,255,255,.55)"; cx.lineWidth = rushing ? 4 : 3;
      for (let i = 0; i < (rushing ? 14 : 9); i++) { const yy = hash(i + Math.floor(t * 12)) * G.LH, xx = hash(i * 3 + Math.floor(t * 12)) * G.LW; cx.beginPath(); cx.moveTo(xx, yy); cx.lineTo(xx + 70, yy); cx.stroke(); }
    }
    const ents = S.ents || [];
    for (let lane = 0; lane < 3; lane++) {
      for (const e of ents) if (e.k !== "gate" && e.lane === lane) drawEnt(e, G.PX + (e.wx - S.dist), t);
      if (S.runner && lane === S.lane) drawPlayer(t);
    }
    for (const e of ents) if (e.k === "gate") { const sx = G.PX + (e.wx - S.dist); if (sx < G.LW + 80) drawEnt(e, sx, t); }
    drawFx();
    cx.restore();
  }

  return {
    resize, draw,
    float(x, y, txt, color) { if (!reducedMotion) fx.push({ kind: "txt", x, y, txt, color, life: 0.9 }); },
    burst(x, y, color, n) {
      if (reducedMotion) return;
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = rand(120, 320); fx.push({ kind: "dot", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, color, r: rand(3, 6), life: rand(0.35, 0.7) }); }
    },
    confetti(x, y) {
      if (reducedMotion) return;
      const cols = ["#ff8fd8", "#4cc9ff", "#ffd84d", "#2ee59d", "#7b5cff"];
      for (let i = 0; i < 40; i++) fx.push({ kind: "conf", x: x + rand(-30, 30), y: y - 40, vx: rand(-160, 360), vy: rand(-520, -220), color: pickOne(cols), life: rand(0.9, 1.5) });
    },
    clearFx() { fx = []; }
  };
})();
