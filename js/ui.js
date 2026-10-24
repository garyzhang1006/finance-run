"use strict";
/* =================================================================
   FINANCE RUN: screens, HUD, panels, input, and the main loop.
   DOM text always goes through textContent (no innerHTML).
   ================================================================= */
function el(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}
/* "text with *emphasis*": starred words become <strong> */
function rich(tag, cls, str) {
  const n = el(tag, cls);
  str.split("*").forEach((part, i) => {
    if (!part) return;
    if (i % 2) n.appendChild(el("strong", null, part)); else n.appendChild(document.createTextNode(part));
  });
  return n;
}
function btn(cls, txt, onClick) { const b = el("button", cls, txt); b.type = "button"; b.addEventListener("click", onClick); return b; }

const UI = (() => {
  let toastTimer = null, bannerTimer = null, prev = {};
  const pref = { runner: store.get("runner", "penny"), goal: store.get("goal", "bike"), sound: store.get("sound", true), music: store.get("music", true) };
  Sfx.setSfx(pref.sound); Sfx.setMusic(false); // music starts on the first click
  let musicWanted = pref.music;

  function show(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === id));
  }

  /* ---------- title screen ---------- */
  function drawMini(c, rn) {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    c.width = 54 * d; c.height = 64 * d;
    const g = c.getContext("2d"); g.scale(d, d);
    const ink = "#2b1d5c";
    g.lineWidth = 3; g.strokeStyle = ink;
    g.fillStyle = rn.body; g.beginPath();
    if (g.roundRect) g.roundRect(13, 34, 28, 26, 9); else g.rect(13, 34, 28, 26);
    g.fill(); g.stroke();
    g.fillStyle = rn.skin; g.beginPath(); g.arc(27, 22, 15, 0, 7); g.fill(); g.stroke();
    g.fillStyle = rn.hair; g.beginPath(); g.arc(27, 19, 15, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.fill();
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(33, 23, 4.5, 5.5, 0, 0, 7); g.fill();
    g.fillStyle = ink; g.beginPath(); g.arc(34, 24, 2.6, 0, 7); g.fill();
    g.lineWidth = 2; g.beginPath(); g.arc(33, 29, 4, 0.3, 1.8); g.stroke();
  }
  function buildPicker(boxId, items, key, render) {
    const box = $(boxId); box.replaceChildren();
    items.forEach(it => {
      const b = el("button", "pick"); b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(pref[key] === it.id));
      render(b, it);
      b.addEventListener("click", () => {
        pref[key] = it.id; store.set(key, it.id); Sfx.unlock(); Sfx.play("click");
        box.querySelectorAll(".pick").forEach(p => p.setAttribute("aria-checked", String(p === b)));
      });
      box.appendChild(b);
    });
  }
  function buildTitle() {
    buildPicker("pick-runner", RUNNERS, "runner", (b, rn) => {
      const c = el("canvas"); drawMini(c, rn); b.appendChild(c); b.appendChild(el("span", "nm", rn.name));
    });
    buildPicker("pick-goal", GOALS, "goal", (b, g) => {
      b.appendChild(el("span", "big", g.emoji)); b.appendChild(el("span", "nm", fmt(cents(g.price))));
      b.appendChild(el("span", "sub", g.name));
      b.title = g.blurb;
    });
    const owned = store.get("badges", []).length;
    $("badge-count").textContent = `${owned}/${BADGES.length}`;
    const best = store.get("best", null);
    $("best").textContent = best != null ? `🏆 Best net worth: ${fmt(best)}` : "";
    syncSoundBtn();
  }
  function syncSoundBtn() {
    const b = $("btn-sound");
    b.textContent = pref.sound ? "🔊 Sound" : "🔇 Sound";
    b.setAttribute("aria-pressed", String(pref.sound));
  }

  /* ---------- HUD ---------- */
  function bump(id, now) {
    const was = prev[id];
    prev[id] = now;
    if (was == null || was === now) return;
    const chip = $(id).closest(".chip");
    if (!chip) return;
    chip.classList.remove("pop", "drop"); void chip.offsetWidth;
    chip.classList.add(now > was ? "pop" : "drop");
  }
  function hud() {
    $("h-wallet").textContent = fmt(S.wallet); bump("h-wallet", S.wallet);
    $("h-savings").textContent = fmt(S.savings); bump("h-savings", S.savings);
    $("h-rate").textContent = S.rate ? `+${Math.round(S.rate * 100)}%` : "";
    $("c-invest").hidden = !(S.invest > 0); $("h-invest").textContent = fmt(S.invest);
    $("c-debt").hidden = !(S.debt > 0); $("h-debt").textContent = fmt(S.debt);
    $("h-goal-emoji").textContent = S.goal.emoji;
    const gp = cents(S.goal.price), have = goalFund();
    $("h-goal-fill").style.width = clamp(have / gp * 100, 0, 100) + "%";
    $("h-goal-text").textContent = `${fmt(have)} / ${fmt(gp)}`;
    $("h-hearts").textContent = "❤️".repeat(S.hearts) + "🤍".repeat(Math.max(0, 3 - S.hearts));
    $("h-hearts").setAttribute("aria-label", `${S.hearts} hearts`);
    $("h-joy").textContent = String(Math.round(S.joy));
    $("c-streak").hidden = S.combo < 2;
    $("h-streak").textContent = String(S.combo);
    $("h-mult").textContent = streakTier() ? "×" + streakMult().toFixed(2) : "";
    $("h-joy-ic").textContent = S.joy >= 70 ? "😄" : S.joy >= 40 ? "🙂" : "😕";
    const w = WORLDS[S.world];
    $("trip-label").textContent = `${w.emoji} ${w.name} · Payday ${Math.min(S.stretch + 1, STRETCHES)} of ${STRETCHES}`;
  }
  let lastPowers = "", lastTrip = null;
  function tick() {
    const p = S.stretchStart != null ? clamp((S.dist - S.stretchStart) / S.stretchLen, 0, 1) : 0;
    $("trip-fill").style.width = (p * 100).toFixed(1) + "%";
    if (lastTrip !== S.stretchStart && S.gate) {
      lastTrip = S.stretchStart;
      const at = wx => ((wx - S.stretchStart) / S.stretchLen * 100).toFixed(1) + "%";
      $("gate-mark").style.left = at(S.gate.wx);
      $("rush-mark").hidden = !S.rush;
      if (S.rush) $("rush-mark").style.left = at(S.rush.start);
    }
    const parts = [];
    if (S.shield > 0) parts.push(`🛡️ Shield x${S.shield}`);
    if (S.x2 > 0) parts.push(`✖️2 Double coins ${Math.ceil(S.x2)}s`);
    if (S.magnet > 0) parts.push(`🧲 Magnet ${Math.ceil(S.magnet)}s`);
    const key = parts.join("|");
    if (key !== lastPowers) {
      lastPowers = key;
      const box = $("powers"); box.replaceChildren();
      parts.forEach(t => box.appendChild(el("div", "power", t)));
    }
  }

  /* toasts sit under the quiz banner (or in its slot) so they never cover a lane */
  function toast(msg, kind, ms = 1900) {
    const t = $("toast"), bn = $("banner");
    t.style.top = bn.classList.contains("on") ? (bn.offsetTop + bn.offsetHeight + 8) + "px" : "";
    t.textContent = msg;
    t.className = "toast show" + (kind ? " " + kind : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), ms);
  }

  /* the first tier-up explains the compounding rule; later ones only celebrate milestones */
  function streakUp(tier) {
    Sfx.play("power");
    const c = $("c-streak"); c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop");
    const mult = "×" + streakMult().toFixed(2);
    if (!S.streakTold) { S.streakTold = true; toast(`🔥 Streak! Coins grow 10% for every ${STREAK_STEP} in a row. That's compounding!`, "good", 3200); }
    else if (tier === 4 || tier === STREAK_TIERS) toast(`🔥 ${S.combo} in a row! Every coin is worth ${mult}`, "good");
  }

  function rush(R) {
    const c = $("countdown");
    // the GO! animation already ran on this element, so reset the class before replaying it
    c.textContent = "FINAL RUSH!"; c.className = "countdown"; void c.offsetWidth; c.className = "countdown go rush";
    setTimeout(() => { if (c.textContent === "FINAL RUSH!") c.textContent = ""; }, 900);
    toast(`⚡ ${R.name}: ${R.tip}`, "good", 3000);
  }

  function banner(g, ok, msg) {
    const b = $("banner");
    clearTimeout(bannerTimer);
    if (!g) { b.className = "banner"; return; }
    b.replaceChildren();
    if (ok === undefined) {
      b.className = "banner on";
      b.appendChild(el("span", "bq-tag", "❓ QUIZ GATE AHEAD"));
      b.appendChild(el("div", "bq", g.q));
      const opts = el("div", "bq-opts");
      ["⬆ Top", "➡ Middle", "⬇ Bottom"].forEach((lane, i) => {
        const o = el("span", "bq-opt"); o.appendChild(el("small", null, lane)); o.appendChild(el("b", null, g.answers[i])); opts.appendChild(o);
      });
      b.appendChild(opts);
      b.appendChild(el("div", "bq-hint", "Run through the right answer for +$2!"));
    } else {
      b.className = "banner on " + (ok ? "good" : "bad");
      b.appendChild(el("div", "bq-why", msg));
      bannerTimer = setTimeout(() => { b.className = "banner"; }, 3600);
    }
  }

  function countdown(txt, go) {
    const c = $("countdown");
    if (c.textContent === txt && !go) return;
    c.textContent = txt;
    c.className = "countdown" + (go ? " go" : "");
    if (go) { void c.offsetWidth; setTimeout(() => { if (c.textContent === "GO!") c.textContent = ""; }, 650); }
  }

  /* ---------- overlay panels ---------- */
  let keyChoices = null;
  function openPanel(build, wide) {
    const p = $("panel");
    p.replaceChildren();
    p.className = "panel" + (wide ? " wide" : "");
    p.style.animation = "none"; void p.offsetWidth; p.style.animation = "";
    keyChoices = null;
    build(p);
    $("overlay").classList.add("on");
    $("overlay").scrollTop = 0;
    const f = p.querySelector("[data-focus]") || p.querySelector("button:not(:disabled)");
    if (f) f.focus({ preventScroll: true });
  }
  function closePanel() {
    $("overlay").classList.remove("on"); keyChoices = null;
    // a still-focused hidden button would eat the Space key meant for jumping
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }
  const tag = (t) => el("span", "p-tag", t);
  const title = (t) => { const h = el("h2", null, t); h.id = "panel-title"; return h; };

  function showPlan() {
    const w = WORLDS[S.world];
    Sfx.setRoot(S.world);
    openPanel(p => {
      p.classList.add("center");
      p.appendChild(tag(`WORLD ${S.world + 1} OF ${WORLDS.length}`));
      p.appendChild(el("span", "p-emoji", w.emoji));
      p.appendChild(title(w.name));
      p.appendChild(el("p", "p-body", w.intro));
      p.appendChild(el("div", "p-rule", `Money rule: ${w.rule}`));
      p.appendChild(el("p", "p-body", "Pick your saving plan. This much of everything you earn moves into savings at each payday, before you can spend it."));
      const box = el("div", "plan-opts");
      const opts = [
        [0.1, "Chill", "10%", "More to spend, slower goal"],
        [0.25, "Balanced", "25%", "A good mix"],
        [0.5, "Super Saver", "50%", "Goal fast, less fun money"]
      ];
      keyChoices = opts.map(([rate, nm, pct, sub], i) => {
        const b = el("button", "plan-opt" + (i === 1 ? " rec" : "")); b.type = "button";
        b.appendChild(el("span", "pct", pct)); b.appendChild(el("span", "nm", `${i + 1} · ${nm}`)); b.appendChild(el("span", "sub", sub));
        if (Math.abs(rate - S.saveRate) < 0.01) b.dataset.focus = "1";
        const go = () => { Sfx.play("pick"); closePanel(); beginWorld(rate); };
        b.addEventListener("click", go);
        box.appendChild(b);
        return go;
      });
      p.appendChild(box);
    });
  }

  function showPayday(sum, card) {
    openPanel(p => {
      p.appendChild(tag(`💰 PAYDAY ${S.stretch + 1} OF ${STRETCHES}`));
      // the payday math counts in one line at a time, each with its own sound
      const led = el("div", "tally"), lines = [];
      const line = (ic, label, amt, cls, sfx) => {
        const d = el("div", "tline " + cls);
        d.appendChild(el("span", "ti", ic)); d.appendChild(el("span", "tl", label)); d.appendChild(el("b", null, amt));
        d.style.animationDelay = (lines.length * 0.22) + "s";
        lines.push(sfx); led.appendChild(d);
      };
      line("🪙", "Coins you grabbed", "+" + fmt(sum.coins), "up", "coin");
      line("💼", S.incomeBonus ? "Allowance + your jobs" : "Allowance", "+" + fmt(sum.income), "up", "coin");
      if (sum.interest) line("✨", "Interest: the bank paid you for saving!", "+" + fmt(sum.interest), "up star", "star");
      if (sum.saved) line("🐷", `Moved to savings (your ${Math.round(S.saveRate * 100)}% plan)`, fmt(sum.saved), "save", "cash");
      if (sum.invest) line("📈", sum.rebound ? "Investments bounced back!" : `Investments went ${sum.invest > 0 ? "up" : "down"}`,
        (sum.invest > 0 ? "+" : "") + fmt(sum.invest), sum.invest > 0 ? "up" : "down", sum.invest > 0 ? "coin" : "wrong");
      if (sum.debt) line("🧾", "Debt grew (10% interest)", "+" + fmt(sum.debt), "down", "wrong");
      if (sum.joy) line("🙂", "Fun fades a little", `${sum.joy} joy`, "down", "tick");
      p.appendChild(led);
      lines.forEach((name, i) => setTimeout(() => { if (S.mode === "payday") Sfx.play(name, i * 4); }, 350 + i * 220));
      p.appendChild(el("span", "p-emoji", card.emoji));
      p.appendChild(title(card.t));
      p.appendChild(el("p", "p-body", card.b));
      const box = el("div", "choices");
      const buttons = [];
      keyChoices = card.c.map((c, i) => {
        const b = el("button", "choice"); b.type = "button";
        b.appendChild(el("span", "key", String(i + 1)));
        b.appendChild(el("span", "ctext", c.l));
        const cost = costOf(c.e), ok = canAfford(c.e);
        if (!ok) {
          const need = S.savings < cost.savings ? `Need ${fmt(cost.savings)} saved` : `Need ${fmt(cost.wallet)}`;
          b.appendChild(el("span", "cost", need));
          b.classList.add("locked"); b.setAttribute("aria-disabled", "true");
        } else if (cost.wallet) b.appendChild(el("span", "cost", `${fmt(cost.wallet)} from wallet`));
        const go = () => {
          if (b.disabled) return;
          if (!canAfford(c.e)) { Sfx.play("wrong"); toast("Not enough money for that one. Pick another!", "bad"); return; }
          choose(card, c, b, buttons, p);
        };
        b.addEventListener("click", go);
        buttons.push(b); box.appendChild(b);
        return go;
      });
      p.appendChild(box);
      const firstOk = buttons.find(b => !b.classList.contains("locked"));
      if (firstOk) firstOk.dataset.focus = "1";
    });
  }

  function choose(card, c, b, buttons, p) {
    const noDebt = S.debt === 0;
    const deltas = applyChoice(c.e);
    if (c.tag && !S.tags.includes(c.tag)) S.tags.push(c.tag);
    keyChoices = null;
    Sfx.play("pick");
    buttons.forEach(x => { x.disabled = true; x.classList.toggle("picked", x === b); x.classList.toggle("faded", x !== b); });
    const box = el("div", "lesson");
    box.appendChild(el("div", "ltag", `💡 ${c.tag || "Money lesson"}`));
    box.appendChild(rich("p", null, noDebt && c.x0 ? c.x0 : c.x));
    if (deltas.length) {
      const d = el("div", "deltas");
      for (const [label, v, money, invert, unit] of deltas) {
        const good = invert ? v < 0 : v > 0;
        const txt = money ? `${label} ${v > 0 ? "+" : "-"}${fmt(Math.abs(v))}` : `${label} ${v > 0 ? "+" : ""}${v}${unit || ""}`;
        d.appendChild(el("span", "delta " + (good ? "up" : "down"), txt));
      }
      box.appendChild(d);
    }
    const acts = el("div", "p-actions");
    const cont = btn("btn btn-primary", S.hearts <= 0 ? "See results" : "Keep running ▶", () => { Sfx.play("click"); closePanel(); afterLesson(); });
    acts.appendChild(cont); box.appendChild(acts);
    p.appendChild(box);
    cont.focus({ preventScroll: true });
    box.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  }

  function showClear(r) {
    const w = WORLDS[S.world];
    openPanel(p => {
      p.classList.add("center");
      p.appendChild(tag(`WORLD ${S.world + 1} CLEAR!`));
      p.appendChild(title(`${w.emoji} ${w.name} done!`));
      const st = el("div", "stars");
      r.stars.forEach((on, i) => {
        st.appendChild(el("span", on ? "" : "off", "⭐"));
        setTimeout(() => { if (S.mode === "clear") Sfx.play(on ? "star" : "tick"); }, 250 + i * 200);
      });
      p.appendChild(st);
      const ul = el("ul", "checks");
      ul.appendChild(el("li", null, "✅ Finished all 5 paydays"));
      ul.appendChild(el("li", null, `${r.stars[1] ? "✅" : "⬜"} Quiz gates: ${S.worldQuizRight} of 5 right (need 4)`));
      ul.appendChild(el("li", null, `${r.stars[2] ? "✅" : "⬜"} Goal money grew ${fmt(r.grew)} this world (need $20)`));
      if (r.healed) ul.appendChild(el("li", null, "❤️ Rested up: +1 heart"));
      p.appendChild(ul);
      p.appendChild(el("div", "p-rule", `You learned: ${w.rule}`));
      const acts = el("div", "p-actions");
      if (r.last) acts.appendChild(btn("btn btn-primary", "See my report card 🏆", () => { closePanel(); endRun("done"); }));
      else acts.appendChild(btn("btn btn-primary", "Visit the shop 🛍️", () => { Sfx.play("click"); showShop(); }));
      p.appendChild(acts);
    });
    confetti(60);
  }

  function showShop() {
    openPanel(p => {
      p.appendChild(tag("🛍️ THE SHOP"));
      p.appendChild(title("Spend, save, or give?"));
      p.appendChild(el("p", "p-body", "Everything here costs money from your wallet. Some things are needs, some are wants. Every dollar you skip stays saved instead."));
      p.appendChild(el("p", "wallet-line", `💵 Wallet: ${fmt(S.wallet)}   ·   🐷 Savings: ${fmt(S.savings)}`));
      const grid = el("div", "shop");
      for (const it of SHOP) {
        const b = el("button", "item"); b.type = "button";
        const full = it.hat && S.hat === it.hat ? "Wearing it ✓" : it.id === "heart" && S.hearts >= 3 ? "Hearts full ✓"
          : it.id === "shield" && S.shield >= 2 ? "Shields full ✓" : "";
        const owned = !!full;
        b.appendChild(el("span", "ie", it.emoji));
        b.appendChild(el("span", "ik", it.kind));
        b.appendChild(el("span", "in", it.name));
        b.appendChild(el("span", "inote", it.note));
        const short = cents(it.price) - S.wallet;
        b.appendChild(el("span", "iprice", full || fmt(cents(it.price)) + (short > 0 ? ` · need ${fmt(short)} more` : "")));
        const later = S.rate > 0 ? Math.round(cents(it.price) * Math.pow(1 + S.rate, paydaysLeft())) : 0;
        b.appendChild(el("span", "iopp", later ? `Opportunity cost: saved instead, this grows to about ${fmt(later)} by the end.` : `Opportunity cost: ${fmt(cents(it.price))} less for spending later.`));
        if (owned) b.classList.add("bought");
        b.disabled = owned || S.wallet < cents(it.price);
        b.addEventListener("click", () => {
          if (buy(it)) { Sfx.play("cash"); toast(`${it.emoji} Bought: ${it.name}`, "good"); showShop(); }
        });
        grid.appendChild(b);
      }
      p.appendChild(grid);
      const acts = el("div", "p-actions");
      const done = btn("btn btn-primary", "Done! Next world ▶", () => { Sfx.play("click"); nextWorld(); });
      done.dataset.focus = "1";
      acts.appendChild(done);
      p.appendChild(acts);
    }, true);
  }

  function showPause(on) {
    if (!on) { closePanel(); return; }
    openPanel(p => {
      p.classList.add("center");
      p.appendChild(tag("PAUSED"));
      p.appendChild(title("Take a breather"));
      p.appendChild(el("p", "p-body", `💡 ${pickOne(TIPS)}`));
      const acts = el("div", "p-actions");
      const resume = btn("btn btn-primary", "Resume ▶", () => togglePause());
      resume.dataset.focus = "1";
      acts.appendChild(resume);
      const snd = btn("btn btn-small", pref.sound ? "🔊 Sound on" : "🔇 Sound off", () => { setSound(!pref.sound); snd.textContent = pref.sound ? "🔊 Sound on" : "🔇 Sound off"; });
      const mus = btn("btn btn-small", musicWanted ? "🎵 Music on" : "🎵 Music off", () => { setMusic(!musicWanted); mus.textContent = musicWanted ? "🎵 Music on" : "🎵 Music off"; });
      acts.appendChild(snd); acts.appendChild(mus);
      acts.appendChild(btn("btn btn-small", "🏠 Quit to menu", () => { quitToMenu(); }));
      p.appendChild(acts);
    });
  }

  /* ---------- report card ---------- */
  function showEnd(r) {
    const gp = cents(S.goal.price), have = goalFund(), reached = have >= gp;
    const medalColor = { "A+": "#ffb703", A: "#ffd84d", B: "#4cc9ff", C: "#ff9f1c", D: "#ff8fd8" }[r.grade.g];
    openPanel(p => {
      p.appendChild(tag(r.finished ? "🏁 RUN COMPLETE" : "💔 OUT OF HEARTS"));
      p.appendChild(title(r.finished ? "Your money report card" : "Scams got your last heart!"));
      const top = el("div", "report-top");
      const m = el("div", "medal", r.grade.g); m.style.background = medalColor;
      top.appendChild(m);
      const gr = el("p", "goal-result");
      gr.textContent = reached
        ? `🎉 You saved enough for your ${S.goal.emoji} ${S.goal.name}! (${fmt(have)} of ${fmt(gp)})`
        : `${S.goal.emoji} ${S.goal.name}: ${fmt(have)} of ${fmt(gp)} saved. Only ${fmt(gp - have)} to go!`;
      top.appendChild(gr);
      p.appendChild(top);
      if (!r.finished) p.appendChild(el("p", "p-body center", "Scam pop-ups cost a heart. Switch lanes to dodge them, and grab 🛡️ emergency funds for protection."));

      const led = el("div", "ledger");
      const row = (k, v, cls) => { const d = el("div", "lrow" + (cls ? " " + cls : "")); d.appendChild(el("span", null, k)); d.appendChild(el("span", null, v)); led.appendChild(d); };
      row("💵 Wallet", fmt(S.wallet));
      row("🐷 Savings", fmt(S.savings));
      if (S.invest) row("📈 Investments", fmt(S.invest));
      if (S.debt) row("🧾 Debt (you owe)", "-" + fmt(S.debt));
      row("✨ Interest you earned", fmt(S.interestEarned));
      row("💝 Given to others", fmt(S.gave));
      row("❓ Quiz gates right", `${S.quizRight} of ${S.quizTotal}`);
      row("🕵️ Scams dodged", String(S.scamsDodged));
      row("🔥 Best coin streak", String(S.bestCombo));
      if (S.rushesRun) row("⚡ Perfect final rushes", `${S.perfectRushes} of ${S.rushesRun}`);
      row("Net worth (what you own minus what you owe)", fmt(r.nw) + (r.isBest ? "  🏆 NEW BEST" : ""), "total");
      p.appendChild(led);
      if (S.wallet >= cents(20)) p.appendChild(rich("p", "p-body", `💡 You ended with *${fmt(S.wallet)} in your wallet* and no job for it. Next time, give every dollar a job: save it, invest it, give it, or plan something fun.`));

      p.appendChild(el("h3", "sec-hd", `🏅 Badges this run (${r.badges.length} of ${BADGES.length})`));
      const bg = el("div", "badges");
      for (const b of BADGES) {
        const got = r.badges.includes(b.id), isNew = r.fresh.includes(b.id);
        const d = el("div", "badge" + (got ? (isNew ? " new" : "") : " lockedb"));
        d.title = b.how;
        d.appendChild(el("span", "be", b.emoji));
        d.appendChild(document.createTextNode(isNew ? `NEW! ${b.name}` : b.name));
        bg.appendChild(d);
      }
      p.appendChild(bg);

      p.appendChild(el("h3", "sec-hd", "🧠 Money rules you practiced"));
      const ul = el("ul", "rules");
      WORLDS.slice(0, S.world + 1).forEach(w => ul.appendChild(el("li", null, `${w.emoji} ${w.rule}`)));
      if (S.tags.length) ul.appendChild(el("li", null, "Topics: " + S.tags.join(", ")));
      p.appendChild(ul);

      const acts = el("div", "p-actions");
      const again = btn("btn btn-primary", "Play again ▶", () => { Sfx.play("click"); startGame(); });
      again.dataset.focus = "1";
      acts.appendChild(again);
      acts.appendChild(btn("btn btn-small", "🏠 Menu", () => quitToMenu()));
      p.appendChild(acts);
    }, true);
    if (r.finished && reached) confetti(120);
  }

  /* ---------- title modals ---------- */
  function showHowTo(then) {
    openPanel(p => {
      p.appendChild(tag("HOW TO PLAY"));
      p.appendChild(title("Run, grab, dodge, decide!"));
      const grid = el("div", "howto-grid");
      const how = (e, t) => { const d = el("div", "how"); d.appendChild(el("span", "he", e)); d.appendChild(rich("span", null, t)); grid.appendChild(d); };
      how("🪙", "*Coins (25¢) and $1 bills* go in your wallet. Every 5 in a row, coins grow 10%. Miss one or hit a trap and the streak resets.");
      how("🛒", "*BUY NOW carts* are impulse buys. Jump over them or they take money from your wallet.");
      how("👾", "*Scam pop-ups* cost money AND a heart. You can't jump them, so switch lanes!");
      how("❓", "*Quiz gates*: read the question, then run through the lane with the right answer.");
      how("🛡️", "*Emergency fund* blocks one trap. *x2* doubles coins. *Magnet* pulls coins in.");
      how("💰", "*Payday* comes 5 times per world: your allowance, interest, and a big money choice.");
      how("⚡", "*Final rush* ends every world: gold coins in one lane, traps in the others. No hits = +$5!");
      p.appendChild(grid);
      p.appendChild(rich("p", "keys", "Keys: *▲ ▼* or *W S* switch lanes · *Space* jumps · *P* pauses · *1 2 3* pick choices · *M* mutes. On a phone or tablet: swipe up or down, tap to jump."));
      const acts = el("div", "p-actions");
      const go = btn("btn btn-primary", then ? "Got it, let's go! ▶" : "Got it!", () => { store.set("seenHow", true); closePanel(); if (then) then(); });
      go.dataset.focus = "1";
      acts.appendChild(go);
      p.appendChild(acts);
    }, true);
  }
  function showBadges() {
    const owned = new Set(store.get("badges", []));
    openPanel(p => {
      p.appendChild(tag("🏅 BADGE COLLECTION"));
      p.appendChild(title(`${owned.size} of ${BADGES.length} collected`));
      p.appendChild(el("p", "p-body", "Badges stay unlocked between runs. Hover or tap one to see how to earn it."));
      const bg = el("div", "badges");
      for (const b of BADGES) {
        const d = el("div", "badge" + (owned.has(b.id) ? "" : " lockedb"));
        d.title = b.how; d.tabIndex = 0;
        d.appendChild(el("span", "be", b.emoji));
        d.appendChild(document.createTextNode(b.name));
        d.appendChild(el("div", null, b.how)).style.cssText = "font-size:11px;font-weight:500;margin-top:2px";
        bg.appendChild(d);
      }
      p.appendChild(bg);
      const acts = el("div", "p-actions");
      const c = btn("btn btn-primary", "Back", () => { closePanel(); $("btn-badges").focus(); });
      c.dataset.focus = "1"; acts.appendChild(c); p.appendChild(acts);
    }, true);
  }

  function confetti(n) {
    if (reducedMotion) return;
    const cols = ["#ff8fd8", "#4cc9ff", "#ffd84d", "#2ee59d", "#7b5cff", "#ff5a5f"];
    for (let i = 0; i < n; i++) {
      const b = el("i", "confetti-bit");
      b.style.left = Math.random() * 100 + "vw";
      b.style.background = pickOne(cols);
      b.style.animationDuration = rand(1.8, 3.4) + "s";
      b.style.animationDelay = rand(0, 0.8) + "s";
      document.body.appendChild(b);
      setTimeout(() => b.remove(), 4400);
    }
  }

  /* ---------- sound prefs ---------- */
  function setSound(on) { pref.sound = on; store.set("sound", on); Sfx.setSfx(on); syncSoundBtn(); if (on) Sfx.play("click"); }
  function setMusic(on) { musicWanted = on; store.set("music", on); Sfx.setMusic(on, S.world || 0); }

  /* ---------- flow ---------- */
  function startGame() {
    Sfx.unlock();
    const goal = GOALS.find(g => g.id === pref.goal) || GOALS[0];
    const runner = RUNNERS.find(r => r.id === pref.runner) || RUNNERS[0];
    newRun(goal, runner);
    Render.clearFx();
    show("screen-game");
    Render.resize();
    S.py = laneY(1);
    prev = {}; lastPowers = ""; lastTrip = null;
    banner(null); countdown("");
    hud();
    if (musicWanted) Sfx.setMusic(true, 0);
    showPlan();
  }
  function quitToMenu() {
    closePanel(); banner(null); countdown("");
    Sfx.stopMusic();
    S.mode = "title";
    buildTitle();
    show("screen-title");
    $("btn-play").focus();
  }

  return { hud, tick, toast, streakUp, rush, banner, countdown, showPlan, showPayday, showClear, showShop, showPause, showEnd,
           showHowTo, showBadges, startGame, setSound, buildTitle, get keyChoices() { return keyChoices; },
           get musicWanted() { return musicWanted; }, setMusic, prefs: pref };
})();

/* ---------- input ---------- */
const overlayOpen = () => $("overlay").classList.contains("on");
addEventListener("keydown", ev => {
  const k = ev.key;
  if ((k === "m" || k === "M") && !ev.metaKey && !ev.ctrlKey) { UI.setSound(!UI.prefs.sound); return; }
  if (S.mode === "run" || S.mode === "countdown") {
    if (k === "ArrowUp" || k === "w" || k === "W") { laneMove(-1); ev.preventDefault(); }
    else if (k === "ArrowDown" || k === "s" || k === "S") { laneMove(1); ev.preventDefault(); }
    else if (k === " " || k === "Spacebar") { jump(); ev.preventDefault(); }
    else if (k === "p" || k === "P" || k === "Escape") { togglePause(); ev.preventDefault(); }
    return;
  }
  if (S.mode === "paused" && (k === "p" || k === "P" || k === "Escape")) { togglePause(); ev.preventDefault(); return; }
  if (overlayOpen() && UI.keyChoices && /^[1-9]$/.test(k)) {
    const fn = UI.keyChoices[+k - 1];
    if (fn) { fn(); ev.preventDefault(); }
  }
});

(() => {
  const cv = $("stage");
  let start = null;
  cv.addEventListener("pointerdown", ev => { start = { x: ev.clientX, y: ev.clientY, t: performance.now() }; });
  cv.addEventListener("pointerup", ev => {
    if (!start) return;
    const dx = ev.clientX - start.x, dy = ev.clientY - start.y, quick = performance.now() - start.t < 350;
    start = null;
    if (Math.abs(dy) > 28 && Math.abs(dy) > Math.abs(dx)) laneMove(dy < 0 ? -1 : 1);
    else if (quick && Math.abs(dx) < 20 && Math.abs(dy) < 20) jump();
  });
  cv.addEventListener("pointercancel", () => { start = null; });
  const hold = (id, fn) => $(id).addEventListener("pointerdown", ev => { ev.preventDefault(); fn(); });
  hold("t-up", () => laneMove(-1));
  hold("t-down", () => laneMove(1));
  hold("t-jump", () => jump());
})();

$("btn-pause").addEventListener("click", () => { togglePause(); });
$("btn-play").addEventListener("click", () => {
  Sfx.unlock(); Sfx.play("go");
  if (!store.get("seenHow", false)) UI.showHowTo(UI.startGame); else UI.startGame();
});
$("btn-howto").addEventListener("click", () => { Sfx.unlock(); Sfx.play("click"); UI.showHowTo(null); });
$("btn-badges").addEventListener("click", () => { Sfx.unlock(); Sfx.play("click"); UI.showBadges(); });
$("btn-sound").addEventListener("click", () => { Sfx.unlock(); UI.setSound(!UI.prefs.sound); });

/* leaving the tab or window pauses the run instead of letting traps hit */
document.addEventListener("visibilitychange", () => { if (document.hidden) togglePause(true); });
addEventListener("blur", () => togglePause(true));
addEventListener("resize", () => Render.resize());

/* ---------- main loop: one loop for the whole app ---------- */
let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (S.mode !== "title" && S.goal) {
    update(dt);
    if (S.hudDirty) { S.hudDirty = false; UI.hud(); }
    UI.tick();
    Render.draw(dt);
  }
  requestAnimationFrame(frame);
}
UI.buildTitle();
requestAnimationFrame(frame);
