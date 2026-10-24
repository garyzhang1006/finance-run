"use strict";
/* =================================================================
   Sound: every effect is synthesized with WebAudio, so the game ships
   no audio files. The context is created on the first click because
   browsers block audio until the player interacts.
   ================================================================= */
const Sfx = (() => {
  let ac = null, master = null, musicGain = null;
  let sfxOn = true, musicOn = true;
  let musicTimer = null, nextNoteT = 0, step = 0, root = 0, rush = false;

  function ensure() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
    return true;
  }

  function tone(freq, dur, { type = "square", vol = 0.18, at = 0, slide = 0, out = null } = {}) {
    if (!ac) return;
    const t = ac.currentTime + at;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.2) {
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource(), g = ac.createGain();
    g.gain.value = vol; src.buffer = buf; src.connect(g); g.connect(master); src.start();
  }
  const seq = (notes, gap, opts) => notes.forEach((f, i) => tone(f, gap * 1.6, { ...opts, at: i * gap }));

  const FX = {
    coin: (combo = 0) => { const f = 880 * Math.pow(2, Math.min(combo, 24) / 24); tone(f, 0.07, { vol: 0.12 }); tone(f * 1.5, 0.1, { vol: 0.1, at: 0.05 }); },
    cash: () => seq([660, 880, 1320], 0.05, { vol: 0.12 }),
    jump: () => tone(300, 0.18, { type: "triangle", vol: 0.2, slide: 2.4 }),
    lane: () => tone(520, 0.05, { type: "triangle", vol: 0.08 }),
    hit:  () => { noise(0.18, 0.25); tone(220, 0.25, { type: "sawtooth", vol: 0.14, slide: 0.4 }); },
    scam: () => { tone(160, 0.35, { type: "sawtooth", vol: 0.16, slide: 0.5 }); tone(120, 0.35, { type: "square", vol: 0.1, at: 0.05, slide: 0.5 }); },
    shield: () => seq([440, 330, 660], 0.06, { type: "triangle", vol: 0.16 }),
    power: () => seq([523, 659, 784, 1047], 0.06, { vol: 0.12 }),
    right: () => seq([523, 659, 784, 1047, 1319], 0.07, { type: "triangle", vol: 0.2 }),
    wrong: () => seq([392, 330, 262], 0.11, { type: "triangle", vol: 0.18 }),
    payday: () => seq([392, 523, 659, 784, 659, 784, 1047], 0.08, { vol: 0.13 }),
    click: () => tone(700, 0.04, { type: "triangle", vol: 0.12 }),
    pick:  () => seq([600, 900], 0.05, { type: "triangle", vol: 0.14 }),
    clear: () => seq([523, 523, 784, 784, 880, 1047, 1319, 1568], 0.09, { vol: 0.13 }),
    lose:  () => seq([392, 370, 349, 330, 262], 0.16, { type: "triangle", vol: 0.2 }),
    tick:  () => tone(1000, 0.05, { vol: 0.1 }),
    star:  () => seq([988, 1319, 1976], 0.05, { type: "triangle", vol: 0.18 }),
    rush:  () => { seq([392, 523, 659, 784, 1047, 1319, 1568], 0.045, { vol: 0.13 }); noise(0.4, 0.08); },
    go:    () => seq([784, 1568], 0.08, { vol: 0.14 })
  };

  /* tiny 16-step chiptune loop; root shifts per world, tempo and lead pick up during a final rush */
  const LEAD = [0, null, 7, null, 12, null, 7, 9, 0, null, 7, null, 14, 12, 9, 7];
  const BASS = [0, 0, null, 0, -5, null, -5, null, -3, -3, null, -3, -5, null, -7, null];
  const hz = semi => 261.63 * Math.pow(2, semi / 12);
  function schedule() {
    if (!ac || !musicOn) return;
    const spb = 60 / (rush ? 168 : 132) / 2; // eighth notes
    while (nextNoteT < ac.currentTime + 0.15) {
      const at = nextNoteT - ac.currentTime;
      const l = LEAD[step % 16], b = BASS[step % 16];
      if (l != null && (rush || (step >> 4) % 2 === 1)) tone(hz(root + l + 12), spb * 0.9, { vol: 0.5, at: Math.max(0, at), out: musicGain });
      if (b != null) tone(hz(root + b - 12), spb * 0.95, { type: "triangle", vol: 0.9, at: Math.max(0, at), out: musicGain });
      nextNoteT += spb; step++;
    }
  }

  return {
    unlock: ensure,
    play(name, arg) { if (sfxOn && ensure() && FX[name]) FX[name](arg); },
    startMusic(world = 0) {
      root = [0, 2, 5, -3][world] || 0;
      if (!musicOn || !ensure() || musicTimer) return;
      nextNoteT = ac.currentTime + 0.05; step = 0;
      musicTimer = setInterval(schedule, 50);
    },
    setRoot(world) { root = [0, 2, 5, -3][world] || 0; },
    setRush(on) { rush = !!on; },
    stopMusic() { clearInterval(musicTimer); musicTimer = null; },
    get sfxOn() { return sfxOn; },
    get musicOn() { return musicOn; },
    setSfx(v) { sfxOn = !!v; },
    setMusic(v, world) { musicOn = !!v; if (!musicOn) this.stopMusic(); else this.startMusic(world); }
  };
})();
