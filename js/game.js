"use strict";
/* =================================================================
   FINANCE RUN: game state, rules, and the run loop.
   All money is stored in whole cents so interest never drifts.
   ================================================================= */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cents = d => Math.round(d * 100);
const fmt = c => {
  const neg = c < 0; c = Math.abs(Math.round(c));
  const d = Math.floor(c / 100), r = c % 100;
  return (neg ? "-" : "") + "$" + d.toLocaleString("en-US") + (r ? "." + String(r).padStart(2, "0") : "");
};
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const rand = (a, b) => a + Math.random() * (b - a);
const pickOne = arr => arr[(Math.random() * arr.length) | 0];

/* storage can throw (private mode, blocked cookies), so it never may crash the game;
   a copy in memory keeps badges, best score, and the seen how-to for the rest of the visit */
const memStore = {};
const store = {
  get(k, d) { try { const v = localStorage.getItem("fr2-" + k); return v == null ? d : JSON.parse(v); } catch (_) { return k in memStore ? memStore[k] : d; } },
  set(k, v) { memStore[k] = v; try { localStorage.setItem("fr2-" + k, JSON.stringify(v)); } catch (_) { /* storage blocked */ } }
};

const STRETCHES = 5;          // paydays per world
const STRETCH_LEN = 3800;     // logical px of road between paydays
const JUMP_DUR = 0.56, JUMP_H = 84;
const GATE_WARN = 1500;       // logical px before a quiz gate when the question appears
const DEBT_RATE = 0.10;       // per payday, deliberately harsh so the lesson shows
const RUSH_LEN = 2000;        // extra road on each world's last stretch for the final rush
const RUSH_BONUS = 500;       // cents for a rush with no hits
const RUSH_WAVE = 330;        // road length of one rush wave
const STREAK_STEP = 5, STREAK_GROWTH = 0.1, STREAK_TIERS = 8;
const POWERS = ["shield", "x2", "magnet"];
const CART_LABELS = ["SALE!", "BUY NOW", "50% OFF", "LIMITED!", "NEW!"];
const SCAM_LABELS = ["FREE GEMZ", "YOU WON!", "2X MONEY", "CLICK ME", "FREE $$$"];
const SCAM_LESSONS = [
  "Scam! FREE stuff that wants your info is fake.",
  "Scam! 'You won' pop-ups are tricks.",
  "Scam! Nobody can double your money for free.",
  "Scam! Never click pop-ups that rush you."
];

/* ---------- geometry (logical units, scaled to the canvas) ---------- */
const G = { scale: 1, LW: 960, LH: 540, PX: 170, W: 0, H: 0, dpr: 1, speedScale: 1 };
const laneY = i => G.LH - 238 + i * 84;
const trackTop = () => G.LH - 292;

/* ---------- run state ---------- */
const S = { mode: "title" };

function newRun(goal, runner) {
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, {
    mode: "plan", goal, runner,
    world: 0, stretch: 0,
    wallet: cents(5), savings: 0, invest: 0, risk: "low", debt: 0,
    rate: 0, incomeBonus: 0, saveRate: 0.25,
    joy: 60, hearts: 3, shield: 0, hat: null,
    gave: 0, interestEarned: 0, coinsTotal: 0, stretchCoins: 0,
    quizRight: 0, quizTotal: 0, worldQuizRight: 0, scamsDodged: 0, trapsHit: 0,
    combo: 0, bestCombo: 0, rebound: false, tags: [], worldStars: [], worldSavingsStart: 0,
    rushesRun: 0, perfectRushes: 0, streakTold: false,
    dist: 0, stretchStart: 0, stretchLen: STRETCH_LEN, cursor: 0, speed: 330, rush: null,
    lane: 1, py: 0, jumpT: 0, invuln: 0, x2: 0, magnet: 0,
    ents: [], gate: null, countdown: 0, t: 0, shake: 0, hudDirty: true
  });
  S.py = laneY(1);
  Sfx.setRush(false);
}

const income = () => cents(WORLDS[S.world].income) + S.incomeBonus;
const netWorth = () => S.wallet + S.savings + S.invest - S.debt;
const goalFund = () => S.savings + S.invest;
/* a coin streak compounds: every 5 coins in a row, coins are worth 10% more until a trap resets it */
const streakTier = () => Math.min(STREAK_TIERS, Math.floor(S.combo / STREAK_STEP));
const streakMult = () => Math.pow(1 + STREAK_GROWTH, streakTier());
const rushLive = () => !!(S.rush && S.rush.announced && !S.rush.done);
const jumpH = () => S.jumpT > 0 ? Math.sin(Math.PI * (1 - S.jumpT / JUMP_DUR)) * JUMP_H : 0;
const dirty = () => { S.hudDirty = true; };

/* ---------- world + stretch flow ---------- */
function beginWorld(saveRate) {
  S.saveRate = saveRate;
  S.worldQuizRight = 0;
  S.worldSavingsStart = goalFund();
  S.stretch = 0;
  beginStretch(3);
  Sfx.setRoot(S.world);
}

function beginStretch(count) {
  const finale = S.stretch === STRETCHES - 1;
  S.stretchStart = S.dist;
  S.stretchLen = STRETCH_LEN + (finale ? RUSH_LEN : 0);
  S.cursor = S.dist + 520;
  S.ents = [];
  S.stretchCoins = 0;
  S.speed = 330 + S.world * 38 + S.stretch * 11;
  const deck = WORLDS[S.world].quiz;
  const used = S.usedQuiz || (S.usedQuiz = new Set());
  const fresh = deck.map((_, i) => i).filter(i => !used.has(S.world + ":" + i));
  const qi = pickOne(fresh.length ? fresh : deck.map((_, i) => i));
  used.add(S.world + ":" + qi);
  const q = deck[qi];
  const order = [0, 1, 2].sort(() => Math.random() - 0.5);
  S.gate = {
    k: "gate", wx: S.stretchStart + STRETCH_LEN * 0.56,
    q: q.q, why: q.why, answers: order.map(i => q.a[i]), okLane: order.indexOf(0),
    done: false, shown: false
  };
  S.ents.push(S.gate);
  S.rush = finale ? Object.assign({}, WORLDS[S.world].rush, {
    start: S.gate.wx + 900, end: S.stretchStart + S.stretchLen - 420,
    waves: 0, hits: 0, gold: 0, safe: 1, announced: false, done: false
  }) : null;
  Sfx.setRush(false);
  S.countdown = count;
  S.mode = "countdown";
  UI.banner(null);
  dirty();
}

/* ---------- spawning: patterns laid out in road distance ---------- */
function spawnAhead() {
  const stretchEnd = S.stretchStart + S.stretchLen, R = S.rush;
  while (S.cursor < S.dist + G.LW + 140) {
    const gx = S.gate ? S.gate.wx : -1e9;
    if (S.cursor > gx - 560 && S.cursor < gx + 280) { S.cursor = gx + 280; continue; }
    if (S.cursor > stretchEnd - 380) { S.cursor = Infinity; break; }
    // regular patterns stop early enough that none overlap the first rush wave,
    // and a wave only starts if all of it fits before the finish line
    if (R && S.cursor >= R.start - 520) {
      S.cursor = Math.max(S.cursor, R.start);
      S.cursor = S.cursor + RUSH_WAVE <= R.end ? S.cursor + layRushWave(S.cursor) : Infinity;
      continue;
    }
    S.cursor += layPattern(S.cursor) + rand(150, 300) - Math.min(90, (S.world * 5 + S.stretch) * 5);
  }
}

function add(k, wx, lane, extra) { S.ents.push(Object.assign({ k, wx, lane, done: false }, extra)); }
function otherLanes(l) { return [0, 1, 2].filter(i => i !== l); }

function layPattern(x) {
  const d = S.world * STRETCHES + S.stretch;            // difficulty 0..19
  const L = (Math.random() * 3) | 0;
  const weights = [
    ["line", 3], ["zigzag", 2], ["cartJump", 1.6 + d * 0.08],
    ["cartWall", d >= 2 ? 1 + d * 0.1 : 0], ["scam", d >= 1 ? 1 + d * 0.1 : 0],
    ["combo", d >= 7 ? 0.8 + d * 0.06 : 0], ["cash", 0.7], ["power", 0.55]
  ];
  let r = Math.random() * weights.reduce((s, w) => s + w[1], 0), kind = "line";
  for (const [k, w] of weights) { if ((r -= w) < 0) { kind = k; break; } }
  const coins = (lane, n, from, air) => { for (let i = 0; i < n; i++) add("coin", from + i * 56, lane, { air: !!air }); return n * 56; };
  switch (kind) {
    case "line": return coins(L, 5 + ((Math.random() * 4) | 0), x);
    case "zigzag": {
      const L2 = pickOne(otherLanes(L));
      coins(L, 3, x); return 3 * 56 + 90 + coins(L2, 4, x + 3 * 56 + 90);
    }
    case "cartJump":
      add("cart", x + 112, L, { label: pickOne(CART_LABELS) });
      coins(L, 2, x); coins(L, 3, x + 56, true);
      return 280;
    case "cartWall": {
      const free = L; otherLanes(free).forEach(l => add("cart", x + 60, l, { label: pickOne(CART_LABELS) }));
      return coins(free, 5, x);
    }
    case "scam": {
      add("scam", x + 80, L, { label: pickOne(SCAM_LABELS) });
      coins(pickOne(otherLanes(L)), 5, x);
      return 300;
    }
    case "combo": {
      const [a, b] = otherLanes(L).sort(() => Math.random() - 0.5);
      add("scam", x + 60, a, { label: pickOne(SCAM_LABELS) });
      add("cart", x + 60, b, { label: pickOne(CART_LABELS) });
      add("coin", x + 60, b, { air: true });
      return coins(L, 4, x - 40) + 40;
    }
    case "cash":
      add("cash", x + 60, L);
      if (d >= 3) add("cart", x + 60, pickOne(otherLanes(L)), { label: pickOne(CART_LABELS) });
      return 180;
    case "power":
      add("power", x + 40, L, { p: S.shield >= 2 ? pickOne(["x2", "magnet"]) : pickOne(POWERS) });
      return coins(L, 3, x + 120) + 120;
  }
  return 200;
}

/* final rush: the world's traps block two lanes, gold coins fill the third.
   The safe lane moves at most one lane per wave so it is always reachable.
   Rush traps cost money but never hearts, so a run can't be lost at the finish. */
function layRushWave(x) {
  const R = S.rush;
  if (R.waves > 0) R.safe = clamp(R.safe + pickOne([-1, 0, 1]), 0, 2);
  otherLanes(R.safe).forEach((l, i) => {
    const k = R.threats[i % R.threats.length];
    add(k, x + 60, l, { label: pickOne(k === "cart" ? CART_LABELS : SCAM_LABELS), rush: true });
  });
  for (let i = 0; i < 3; i++) add("coin", x + i * 56, R.safe, { gold: true });
  R.waves++;
  return RUSH_WAVE;
}

/* ---------- per-frame update ---------- */
function update(dt) {
  if (S.mode === "countdown") {
    const before = Math.ceil(S.countdown);
    S.countdown -= dt;
    const now = Math.ceil(S.countdown);
    if (now !== before && now > 0) Sfx.play("tick");
    UI.countdown(S.countdown > 0 ? String(now) : "");
    if (S.countdown <= 0) { S.mode = "run"; Sfx.play("go"); UI.countdown("GO!", true); }
    return;
  }
  if (S.mode !== "run") return;
  S.t += dt;

  const g = S.gate, gateSx = g && !g.done ? G.PX + (g.wx - S.dist) : Infinity;
  const nearGate = gateSx - G.PX < GATE_WARN && gateSx > G.PX - 40;
  if (nearGate && !g.shown) { g.shown = true; UI.banner(g); Sfx.play("power"); }
  const R = S.rush;
  if (R && !R.announced && S.dist >= R.start - 700) {
    R.announced = true; S.rushesRun++;
    Sfx.play("rush"); Sfx.setRush(true); UI.rush(R);
  }
  const v = S.speed * G.speedScale * (nearGate ? 0.7 : rushLive() ? 1.15 : 1);
  S.dist += v * dt;

  const ty = laneY(S.lane);
  S.py = reducedMotion ? ty : S.py + (ty - S.py) * Math.min(1, dt * 16);
  if (S.jumpT > 0) S.jumpT = Math.max(0, S.jumpT - dt);
  if (S.invuln > 0) S.invuln -= dt;
  if (S.x2 > 0) { S.x2 -= dt; if (S.x2 <= 0) dirty(); }
  if (S.magnet > 0) { S.magnet -= dt; if (S.magnet <= 0) dirty(); }

  spawnAhead();
  collide();
  // answered gates stay on screen so the player sees which sign was right
  S.ents = S.ents.filter(e => (e.k === "gate" || !e.done) && G.PX + (e.wx - S.dist) > -120);

  if (S.mode === "run" && rushLive() && S.dist >= R.end) finishRush();
  if (S.mode === "run" && S.dist >= S.stretchStart + S.stretchLen) payday();
}

function collide() {
  const h = jumpH();
  for (const e of S.ents) {
    if (S.mode !== "run") return;   // a scam may have just ended the run
    if (e.done) continue;
    const sx = G.PX + (e.wx - S.dist), dx = Math.abs(sx - G.PX);
    if (e.k === "gate") { if (sx <= G.PX) resolveGate(e); continue; }
    if (e.k === "coin" || e.k === "cash") {
      if (S.magnet > 0 && sx > G.PX - 10 && sx < G.PX + 320) { grab(e, sx, true); continue; }
      const heightOk = e.air ? h > 34 : h < 52;
      if (e.lane === S.lane && dx < 30 && heightOk) grab(e, sx, false);
      // running past a coin in your own lane breaks the streak; coins in other lanes don't count
      else if (!e.missed && e.lane === S.lane && sx < G.PX - 32) { e.missed = true; breakStreak(); }
      continue;
    }
    if (e.k === "power") { if (e.lane === S.lane && dx < 34) power(e, sx); continue; }
    if (e.k === "cart" && e.lane === S.lane && dx < 32 && h < 30 && S.invuln <= 0) { hit(e, sx); continue; }
    if (e.k === "scam") {
      if (e.lane === S.lane && dx < 32 && S.invuln <= 0) { hit(e, sx); continue; }
      if (!e.counted && sx < G.PX - 40) { e.counted = true; S.scamsDodged++; }
    }
  }
}

function grab(e, sx, magnet) {
  e.done = true;
  const y = laneY(e.lane) - (e.air ? 78 : 0);
  // quarters and $1 bills: allowance is the main income, like real life. Rush gold is 50 cents.
  let val = e.k === "cash" ? 100 : e.gold ? 50 : 25;
  if (S.x2 > 0) val *= 2;
  const tierBefore = streakTier();
  S.combo++; S.bestCombo = Math.max(S.bestCombo, S.combo);
  val = Math.round(val * streakMult());
  S.wallet += val; S.stretchCoins += val; S.coinsTotal += val;
  if (e.gold && S.rush) S.rush.gold += val;
  const col = e.k === "cash" ? "#2ee59d" : "#ffd84d";
  Render.float(sx, y - 20, val < 100 ? `+${val}¢` : "+" + fmt(val), col);
  Render.burst(sx, y, col, magnet ? 4 : e.gold ? 10 : 7);
  Sfx.play(e.k === "cash" ? "cash" : "coin", S.combo);
  if (streakTier() > tierBefore) UI.streakUp(streakTier());
  dirty();
}

function breakStreak() {
  if (S.combo >= STREAK_STEP && !reducedMotion) Render.float(G.PX, S.py - 70, "streak lost", "#ff9f1c");
  S.combo = 0;
  dirty();
}

function power(e, sx) {
  e.done = true;
  const y = laneY(e.lane);
  Render.burst(sx, y, "#7b5cff", 14);
  Sfx.play("power");
  if (e.p === "shield") { S.shield = Math.min(2, S.shield + 1); UI.toast("🛡️ Emergency fund! Blocks one trap", "good"); }
  if (e.p === "x2") { S.x2 = 7; UI.toast("✖️2 Compound boost! Coins count double", "good"); }
  if (e.p === "magnet") { S.magnet = 7; UI.toast("🧲 Auto-saver magnet! Coins come to you", "good"); }
  dirty();
}

function hit(e, sx) {
  e.done = true;
  const y = laneY(e.lane);
  S.combo = 0;
  if (S.shield > 0) {
    S.shield--; S.invuln = 0.9;
    Sfx.play("shield");
    Render.burst(sx, y, "#4cc9ff", 16);
    UI.toast("🛡️ Your emergency fund covered it!", "good");
    dirty(); return;
  }
  S.trapsHit++; S.invuln = 1.1;
  if (rushLive()) S.rush.hits++;
  S.shake = reducedMotion ? 0 : (e.k === "scam" ? 14 : 9);
  if (e.k === "cart") {
    const cost = Math.min(S.wallet, Math.max(cents(2 + S.world * 0.5), Math.round(S.wallet * 0.12)));
    S.wallet -= cost;
    Sfx.play("hit");
    Render.float(sx, y - 30, cost ? "-" + fmt(cost) : "$0 left!", "#ff5a5f");
    UI.toast(!cost ? "🛒 Impulse cart! Lucky your wallet was empty"
      : S.trapsHit <= 2 ? `🛒 Impulse buy! -${fmt(cost)}. Money in savings is safe from carts!`
      : `🛒 Impulse buy! -${fmt(cost)}`, "bad");
  } else {
    const cost = Math.min(S.wallet, Math.max(cents(4 + S.world), Math.round(S.wallet * 0.2)));
    S.wallet -= cost;
    if (!e.rush) S.hearts--;
    Sfx.play("scam");
    Render.float(sx, y - 30, (e.rush ? "" : "-❤️ ") + (cost ? "-" + fmt(cost) : "$0 left!"), "#ff5a5f");
    UI.toast(pickOne(SCAM_LESSONS), "bad");
    if (S.hearts <= 0) { dirty(); endRun("hearts"); return; }
  }
  Render.burst(sx, y, "#ff5a5f", 12);
  dirty();
}

function resolveGate(g) {
  g.done = true;
  S.quizTotal++;
  const right = S.lane === g.okLane;
  if (right) {
    S.quizRight++; S.worldQuizRight++;
    S.wallet += 200; S.stretchCoins += 200; S.coinsTotal += 200;
    Sfx.play("right");
    Render.confetti(G.PX, S.py);
    UI.banner(g, true, `✅ Correct! +$2. ${g.why}`);
  } else {
    S.combo = 0;
    Sfx.play("wrong");
    UI.banner(g, false, `❌ It was "${g.answers[g.okLane]}". ${g.why}`);
  }
  dirty();
}

function finishRush() {
  const R = S.rush;
  R.done = true;
  Sfx.setRush(false);
  if (R.hits === 0) {
    S.perfectRushes++;
    S.wallet += RUSH_BONUS; S.stretchCoins += RUSH_BONUS; S.coinsTotal += RUSH_BONUS;
    Sfx.play("right"); Render.confetti(G.PX, S.py);
    UI.toast(`🏆 PERFECT RUSH! +${fmt(RUSH_BONUS)} bonus`, "good", 2600);
  } else {
    Sfx.play("payday");
    UI.toast(R.gold ? `⚡ Rush done! +${fmt(R.gold)} in gold` : "⚡ Rush done! Next time, grab the gold in the safe lane", "good", 2600);
  }
  dirty();
}

/* ---------- payday: interest, income, auto-save, investments, debt ---------- */
function payday() {
  S.mode = "payday";
  const sum = {};
  sum.interest = Math.round(S.savings * S.rate);
  S.savings += sum.interest; S.interestEarned += sum.interest;
  sum.coins = S.stretchCoins;
  sum.income = income();
  S.wallet += sum.income;
  sum.saved = Math.min(S.wallet, Math.round((S.stretchCoins + sum.income) * S.saveRate));
  S.wallet -= sum.saved; S.savings += sum.saved;
  sum.invest = 0;
  if (S.invest > 0) {
    const pct = S.rebound ? 0.3 : (S.risk === "high" ? rand(-0.3, 0.36) : rand(-0.04, 0.12));
    sum.invest = Math.round(S.invest * pct);
    S.invest = Math.max(0, S.invest + sum.invest);
    sum.rebound = S.rebound;
  }
  S.rebound = false;
  sum.debt = Math.round(S.debt * DEBT_RATE);
  S.debt += sum.debt;
  // fun fades unless you budget for it, so saving every cent has a cost too
  sum.joy = S.joy > 0 ? -Math.min(S.joy, 2) : 0;
  S.joy += sum.joy;
  S.stretchCoins = 0;
  UI.banner(null);
  Sfx.play("payday");
  dirty();
  UI.showPayday(sum, WORLDS[S.world].cards[S.stretch]);
}

/* what a choice needs before it can be picked */
function costOf(e) {
  const w = Math.max(0, -(e.wallet || 0) - (e.saveOut || 0)) + (e.toSave || 0) + (e.invest || 0);
  return { wallet: cents(w), savings: cents(e.saveOut || 0) };
}
function canAfford(e) {
  const c = costOf(e);
  return S.wallet >= c.wallet && S.savings >= c.savings;
}

function applyChoice(e) {
  const b = { wallet: S.wallet, savings: S.savings, invest: S.invest, debt: S.debt, joy: S.joy,
              hearts: S.hearts, income: S.incomeBonus, rate: S.rate, shield: S.shield };
  if (e.saveOut) { const m = Math.min(S.savings, cents(e.saveOut)); S.savings -= m; S.wallet += m; }
  if (e.wallet) S.wallet += cents(e.wallet);
  if (e.toSave) { S.wallet -= cents(e.toSave); S.savings += cents(e.toSave); }
  if (e.saveIn) S.savings += cents(e.saveIn);
  if (e.saveHalf) { const h = Math.floor(S.wallet / 2); S.wallet -= h; S.savings += h; }
  if (e.investPct) S.invest = Math.max(0, S.invest + Math.round(S.invest * e.investPct));
  if (e.sellAll) { S.savings += S.invest; S.invest = 0; }
  if (e.invest) { if (S.invest === 0 && e.risk) S.risk = e.risk; S.wallet -= cents(e.invest); S.invest += cents(e.invest); }
  if (e.rebound && S.invest > 0) S.rebound = true;
  if (e.debt) S.debt += cents(e.debt);
  if (e.payDebt) {
    const want = e.payDebt === "max" ? S.debt : cents(e.payDebt);
    const pay = Math.min(want, S.debt, S.wallet);
    S.wallet -= pay; S.debt -= pay;
  }
  if (e.rate) S.rate = Math.max(S.rate, e.rate);
  if (e.income) S.incomeBonus += cents(e.income);
  if (e.joy) S.joy = clamp(S.joy + e.joy, 0, 100);
  if (e.gave) S.gave += cents(e.gave);
  if (e.shield) S.shield = Math.min(2, S.shield + e.shield);
  if (e.hearts) S.hearts = clamp(S.hearts + e.hearts, 0, 3);
  S.wallet = Math.max(0, S.wallet);
  dirty();
  return [
    ["💵 Wallet", S.wallet - b.wallet, true], ["🐷 Savings", S.savings - b.savings, true],
    ["📈 Invested", S.invest - b.invest, true], ["🧾 Owed", S.debt - b.debt, true, true],
    ["💼 Income/payday", S.incomeBonus - b.income, true], ["😊 Joy", S.joy - b.joy],
    ["❤️ Hearts", S.hearts - b.hearts], ["🛡️ Shield", S.shield - b.shield],
    ["🏦 Interest", Math.round((S.rate - b.rate) * 100), false, false, "%"]
  ].filter(d => d[1] !== 0);
}

function afterLesson() {
  if (S.hearts <= 0) { endRun("hearts"); return; }
  S.stretch++;
  if (S.stretch >= STRETCHES) worldClear();
  else beginStretch(1.2);
}

function worldClear() {
  S.mode = "clear";
  const grew = goalFund() - S.worldSavingsStart;
  const stars = [true, S.worldQuizRight >= 4, grew >= cents(20)];
  S.worldStars[S.world] = stars.filter(Boolean).length;
  const healed = S.hearts < 3;
  S.hearts = Math.min(3, S.hearts + 1);
  S.joy = clamp(S.joy + 3, 0, 100);
  Sfx.play("clear");
  dirty();
  UI.showClear({ stars, grew, healed, last: S.world >= WORLDS.length - 1 });
}

function nextWorld() {
  S.world++;
  S.mode = "plan";
  UI.showPlan();
}

function buy(item) {
  const price = cents(item.price);
  if (S.wallet < price) return false;
  if (item.id === "heart" && S.hearts >= 3) return false;
  if (item.id === "shield" && S.shield >= 2) return false;
  if (item.hat && S.hat === item.hat) return false;
  S.wallet -= price;
  if (item.id === "shield") S.shield++;
  if (item.id === "heart") S.hearts++;
  if (item.id === "shades") { S.hat = "shades"; S.joy = clamp(S.joy + 3, 0, 100); }
  if (item.id === "crown") { S.hat = "crown"; S.joy = clamp(S.joy + 6, 0, 100); }
  if (item.id === "donate") { S.gave += price; S.joy = clamp(S.joy + 3, 0, 100); }
  dirty();
  return true;
}

/* paydays left after the current world, for opportunity-cost math in the shop */
const paydaysLeft = () => (WORLDS.length - 1 - S.world) * STRETCHES;

/* ---------- ending, grade, badges ---------- */
function gradeRun(finished) {
  const goalPart = clamp(goalFund() / cents(S.goal.price), 0, 1) * 40;
  const joyPart = S.joy / 100 * 20;
  const quizPart = S.quizTotal ? S.quizRight / S.quizTotal * 20 : 0;
  const heartPart = S.hearts / 3 * 10;
  const debtPart = S.debt === 0 ? 10 : 0;
  let pts = goalPart + joyPart + quizPart + heartPart + debtPart;
  if (!finished) pts = Math.min(pts, 54);
  const g = pts >= 92 ? "A+" : pts >= 84 ? "A" : pts >= 70 ? "B" : pts >= 55 ? "C" : "D";
  return { g, pts: Math.round(pts) };
}

function earnedBadges(finished) {
  const out = [];
  const reached = goalFund() >= cents(S.goal.price);
  if (S.scamsDodged >= 15) out.push("spotter");
  if (S.savings >= cents(S.goal.price)) out.push("saver");
  if (S.quizRight >= 18) out.push("whiz");
  if (S.interestEarned >= cents(15)) out.push("compound");
  if (S.gave >= cents(10)) out.push("heart");
  if (S.bestCombo >= 40) out.push("streak");
  if (S.perfectRushes > 0) out.push("rush");
  if (finished && S.debt === 0) out.push("debtfree");
  if (income() >= cents(16)) out.push("boss");
  if (S.invest > 0) out.push("investor");
  if (finished && S.hearts === 3) out.push("untouch");
  if (reached) out.push("goal");
  if (reached && S.joy >= 70) out.push("balance");
  return out;
}

function endRun(reason) {
  if (S.mode === "end") return;
  const finished = reason === "done";
  S.mode = "end";
  Sfx.setRush(false);
  UI.banner(null);
  const grade = gradeRun(finished);
  const badges = earnedBadges(finished);
  const owned = new Set(store.get("badges", []));
  const fresh = badges.filter(b => !owned.has(b));
  badges.forEach(b => owned.add(b));
  store.set("badges", [...owned]);
  const nw = netWorth();
  const best = store.get("best", null);
  const isBest = !best || nw > best;
  if (isBest) store.set("best", nw);
  Sfx.play(finished ? "clear" : "lose");
  UI.showEnd({ finished, grade, badges, fresh, nw, isBest });
}

/* ---------- input ---------- */
function laneMove(dir) {
  if (S.mode !== "run" && S.mode !== "countdown") return;
  const n = clamp(S.lane + dir, 0, 2);
  if (n !== S.lane) { S.lane = n; Sfx.play("lane"); }
}
function jump() {
  if (S.mode !== "run" || S.jumpT > 0) return;
  S.jumpT = JUMP_DUR;
  Sfx.play("jump");
}
function togglePause(force) {
  if (S.mode === "run" || S.mode === "countdown") {
    if (force === false) return;
    S.pausedFrom = S.mode; S.mode = "paused"; UI.showPause(true);
  } else if (S.mode === "paused" && force !== true) {
    S.mode = S.pausedFrom === "run" ? "countdown" : S.pausedFrom;
    S.countdown = Math.max(S.countdown, 1.2);
    UI.showPause(false);
  }
}
