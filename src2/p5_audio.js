/* ===================== SON : musique de taverne et bruitages ===================== */
/* Tout est synthétisé avec WebAudio (aucun fichier) : luth (corde pincée), flûte, bodhrán, tambourin, vielle. */
const SND = (() => {
  let ctx = null, master = null, musBus = null, sfxBus = null, rev = null, noise = null, unlocked = false;
  const S = Object.assign({ music: true, sfx: true, mv: 0.4, sv: 0.8 }, (() => { try { return JSON.parse(localStorage.getItem('mk.sound')) || {}; } catch (e) { return {}; } })());
  const save = () => { try { localStorage.setItem('mk.sound', JSON.stringify(S)); } catch (e) { /* réglage non mémorisé */ } };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = s => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(s); return m ? 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) : null; };

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return false; } }
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ctx.destination);
    musBus = ctx.createGain(); musBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    rev = ctx.createConvolver(); rev.buffer = impulse(1.8, 3);
    const rg = ctx.createGain(); rg.gain.value = 0.28; rev.connect(rg); rg.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    return true;
  }
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    musBus.gain.setTargetAtTime(S.music ? S.mv * 1.0 : 0, t, 0.15);
    sfxBus.gain.setTargetAtTime(S.sfx ? S.sv : 0, t, 0.05);
  }
  /* Le navigateur n'autorise le son qu'après un premier geste du joueur. */
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!unlocked) { unlocked = true; setTimeout(switchTheme, 50); }
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !unlocked) return;
    if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
  });

  /* ---------- briques sonores ---------- */
  function nsrc(t, dur) { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.05); return s; }
  function filt(type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
  function gainEnv(t, a, peak, d, hold) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (hold) g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + (hold || 0) + d);
    return g;
  }
  function out(node, dest, pan) {
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); p.connect(dest); }
    else node.connect(dest);
  }
  function tone(dest, type, f0, f1, t, a, peak, d, pan) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    const g = gainEnv(t, a, peak, d); o.connect(g); out(g, dest, pan);
    o.start(t); o.stop(t + a + d + 0.05);
    return o;
  }
  function hiss(dest, type, f, q, t, a, peak, d, pan, f2) {
    const s = nsrc(t, a + d), b = filt(type, f, q);
    if (f2) { b.frequency.setValueAtTime(f, t); b.frequency.exponentialRampToValueAtTime(f2, t + a + d); }
    const g = gainEnv(t, a, peak, d); s.connect(b); b.connect(g); out(g, dest, pan);
  }
  /* Luth : corde pincée (algorithme de Karplus-Strong), calculée une fois par note. */
  const plucks = {};
  function pluckBuf(m) {
    if (plucks[m]) return plucks[m];
    const sr = 22050, N = Math.max(2, Math.round(sr / mtof(m))), len = Math.floor(sr * (m < 52 ? 2.4 : 1.7));
    const b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0), ring = new Float32Array(N);
    let last = 0; for (let i = 0; i < N; i++) { last = last * 0.45 + (Math.random() * 2 - 1) * 0.55; ring[i] = last; }
    const damp = 0.9965 - Math.max(0, m - 62) * 0.0005;
    let k = 0, mx = 0;
    for (let i = 0; i < len; i++) { const a = ring[k], c = ring[(k + 1) % N], v = (a + c) * 0.5 * damp; ring[k] = v; d[i] = a; k = (k + 1) % N; mx = Math.max(mx, Math.abs(a)); }
    const g = mx ? 0.8 / mx : 1, fade = Math.floor(len * 0.25);
    for (let i = 0; i < len; i++) d[i] *= g * (i > len - fade ? (len - i) / fade : 1);
    return (plucks[m] = b);
  }
  function lute(dest, m, t, vel, pan) {
    if (m == null) return;
    const s = ctx.createBufferSource(); s.buffer = pluckBuf(m);
    const g = ctx.createGain(); g.gain.value = vel;
    s.connect(g); out(g, dest, pan); s.start(t); s.stop(t + s.buffer.duration);
  }
  function flute(dest, m, t, dur, vel) {
    if (m == null) return;
    const f = mtof(m), o = ctx.createOscillator(), o2 = ctx.createOscillator();
    o.type = 'sine'; o2.type = 'triangle';
    o.frequency.setValueAtTime(f, t); o2.frequency.setValueAtTime(f * 2, t);
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 5.3; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(0.35, dur * 0.7));
    lfo.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain(), end = t + dur;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.045); g.gain.setValueAtTime(vel * 0.85, Math.max(t + 0.05, end - 0.04)); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.07);
    const g2 = ctx.createGain(); g2.gain.value = 0.1;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(dest);
    hiss(dest, 'bandpass', 2400, 1.2, t, 0.02, vel * 0.22, 0.09);
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(end + 0.1); }
  }
  function drum(dest, t, vel, kind) {
    const f0 = kind === 'tom' ? 125 : kind === 'low' ? 92 : 190;
    tone(dest, 'sine', f0, f0 * 0.5, t, 0.004, vel, kind === 'tom' ? 0.34 : 0.2);
    hiss(dest, 'lowpass', kind === 'tap' ? 2600 : 900, 0.7, t, 0.002, vel * 0.45, 0.05);
  }
  function tamb(dest, t, vel) {
    hiss(dest, 'highpass', 6800, 0.7, t, 0.002, vel, 0.07);
    hiss(dest, 'bandpass', 9500, 2, t + 0.014, 0.002, vel * 0.6, 0.05);
  }
  function drone(dest, notes, vol) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 2.5);
    const lp = filt('lowpass', 750, 0.6), lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.13; lg.gain.value = 220; lfo.connect(lg); lg.connect(lp.frequency);
    lp.connect(g); g.connect(dest);
    const os = [lfo];
    for (const n of notes) for (const det of [-4, 5]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = det; o.connect(lp); os.push(o); }
    os.forEach(o => o.start());
    return { stop() { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + 1.2); os.forEach(o => o.stop(t + 1.3)); } };
  }

  /* ---------- airs ---------- */
  function parse(str) {           // « A4 D5 D5:2 . » -> une case par croche ; :n = durée en croches ; . = silence
    const steps = [];
    for (const tok of str.split(/\s+/).filter(x => x && x !== '|')) {
      const [n, l] = tok.split(':'), len = +(l || 1);
      steps.push(n === '.' ? null : { m: midi(n), len });
      for (let i = 1; i < len; i++) steps.push(undefined);
    }
    return steps;
  }
  const CH = { D: ['D3', 'A3', 'D4', 'F#4'], G: ['G2', 'D3', 'G3', 'B3'], C: ['C3', 'G3', 'C4', 'E4'], Dm: ['D3', 'A3', 'D4', 'F4'], Bb: ['Bb2', 'F3', 'Bb3', 'D4'], A: ['A2', 'E3', 'A3', 'C#4'],
    F: ['F2', 'C3', 'F3', 'A3'], Am: ['A2', 'E3', 'A3', 'C4'], Em: ['E2', 'B2', 'E3', 'G3'], Eb: ['Eb3', 'Bb3', 'Eb4', 'G4'] };
  const chordOf = n => CH[n].map(midi);
  /* Village 1 : une gigue en ré, joyeuse (6/8). */
  const JIG_A = parse('A4 D5 D5 F#5 D5 D5 | A4 D5 F#5 E5 D5 B4 | A4 D5 D5 F#5 E5 F#5 | G5 F#5 E5 D5 B4 G4 | A4 D5 D5 F#5 D5 D5 | A4 D5 F#5 A5 F#5 D5 | G5 E5 C5 E5 F#5 E5 | D5:3 D5 A4 F#4');
  const JIG_B = parse('A5 F#5 D5 A5 F#5 D5 | G5 E5 C5 G5 E5 C5 | A5 F#5 D5 F#5 E5 D5 | C5 E5 G5 E5 D5 C5 | A5 F#5 D5 A5 F#5 D5 | G5 E5 C5 E5 F#5 G5 | A5 G5 F#5 E5 D5 C5 | D5:3 D5:3');
  const JIG_CH = ['D', 'D', 'D', 'G', 'D', 'D', 'C', 'D', 'D', 'C', 'D', 'C', 'D', 'C', 'D', 'D'];
  /* Village 2 : un air lent des mines (3/4). */
  const AIR = parse('D5:4 E5:2 | F5:4 E5:2 | D5:2 C5:2 A4:2 | D5:6 | F5:4 G5:2 | A5:4 G5:2 | F5:2 E5:2 C5:2 | D5:6 | A5:4 C6:2 | B5:4 A5:2 | G5:2 F5:2 E5:2 | F5:4 E5:2 | D5:4 E5:2 | F5:2 E5:2 C5:2 | D5:4 A4:2 | D5:6');
  const AIR_CH = ['Dm', 'F', 'C', 'Dm', 'F', 'Am', 'C', 'Dm', 'Am', 'G', 'C', 'F', 'Dm', 'C', 'Am', 'Dm'];
  /* Village 3 : la ritournelle de la halle, au luth seul (6/8 lent). */
  const HALL = parse('D5 F#5 A5 F#5 D5 F#5 | E5 G5 B5 G5 E5 G5 | F#5 A5 D6 A5 F#5 A5 | E5:3 A4:3 | D5 F#5 A5 F#5 D5 F#5 | G5 B5 D6 B5 G5 B5 | A5 F#5 E5 D5 C#5 E5 | D5:6');
  const HALL_CH = ['D', 'Em', 'D', 'A', 'D', 'G', 'A', 'D'];
  /* Raid 1 : un air tendu en ré mineur (4/4). */
  const WAR_1 = parse('D5:4 F5:2 E5:2 | D5:6 A4:2 | Bb4:4 D5:2 F5:2 | E5:6 C5:2 | D5:2 E5:2 F5:2 G5:2 | A5:6 G5:2 | F5:4 D5:2 Bb4:2 | C#5:6 E5:2');
  const WAR_2 = parse('A5:4 G5:2 F5:2 | E5:2 F5:2 D5:4 | F5:4 D5:2 Bb4:2 | C5:2 E5:2 G5:4 | F5:2 E5:2 D5:2 E5:2 | F5:2 G5:2 A5:4 | Bb5:4 A5:2 F5:2 | E5:4 C#5:2 A4:2');
  const WAR_CH = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A'];
  /* Raid 2 : les tambours du Nord (ostinato grave, cor lointain). */
  const NORTH = parse('D4:8 | Eb4:8 | D4:6 C4:2 | D4:8 | F4:8 | Eb4:6 D4:2 | C4:4 Eb4:4 | D4:8');
  const PIECES = {
    village: [
      { name: 'gigue', dt: 60 / 96 / 3, len: 192, drone: ['D3', 'A3'], droneVol: 0.012,
        play(th, s, t, V) {
          const half = s < 96 ? 0 : 1, ps = s % 96, bar = Math.floor(ps / 6), b = ps % 6, dest = th.g;
          const mel = (half ? JIG_B : JIG_A)[ps % 48], chord = chordOf(JIG_CH[(half * 8 + bar % 8) % 16]);
          const fluteLead = V.flute ? (half === 0 || V.both) : (half === 1 && V.both);
          if (mel) { if (fluteLead) flute(dest, mel.m + V.tr, t, mel.len * this.dt * 0.95, 0.05); else lute(dest, mel.m + V.tr, t, 0.2, 0.15); }
          if (b === 0) lute(dest, chord[0] + V.tr, t, 0.17, -0.2);
          if (b === 3) lute(dest, chord[1] + V.tr, t, 0.1, -0.2);
          if ((b === 2 || b === 5) && bar % 2 === 0) lute(dest, chord[3] + V.tr, t, 0.07, 0.05);
          if (V.drum && b === 0) drum(dest, t, 0.12, 'low');
          if (V.drum && b === 3 && bar % 2 === 1) drum(dest, t, 0.07, 'low');
        } },
      { name: 'air', dt: 60 / 80 / 2, len: 96,
        play(th, s, t, V) {
          const bar = Math.floor(s / 6), b = s % 6, dest = th.g, chord = chordOf(AIR_CH[bar]), mel = AIR[s];
          if (mel) { if (V.flute && bar >= 4) flute(dest, mel.m + V.tr, t, mel.len * this.dt * 0.97, 0.045); else lute(dest, mel.m + V.tr, t, 0.18, 0.1); }
          if (b === 0) lute(dest, chord[0] + V.tr, t, 0.15, -0.25);
          if (b === 2) lute(dest, chord[2] + V.tr, t, 0.07, -0.1);
          if (b === 4) lute(dest, chord[3] + V.tr, t, 0.06, 0);
        } },
      { name: 'halle', dt: 60 / 70 / 3, len: 96,
        play(th, s, t, V) {
          const ps = s % 48, bar = Math.floor(ps / 6), b = ps % 6, dest = th.g, chord = chordOf(HALL_CH[bar]), mel = HALL[ps];
          if (mel) lute(dest, mel.m + V.tr - (s >= 48 && V.low ? 12 : 0), t, 0.16, 0.12);
          if (b === 0) lute(dest, chord[0] + V.tr, t, 0.15, -0.2);
          if (b === 3) lute(dest, chord[1] + V.tr, t, 0.08, -0.2);
        } },
    ],
    battle: [
      { name: 'guerre', dt: 60 / 128 / 2, len: 128, drone: ['D2', 'A2'], droneVol: 0.018,
        play(th, s, t, V) {
          const bar = Math.floor(s / 8) % 8, b = s % 8, dest = th.g, I = th.intensity;
          const ch = chordOf(WAR_CH[bar]), root = ch[0], fifth = ch[1], third = ch[3] - 12;
          const pat = [root, root, fifth, root, third, root, fifth, root];
          lute(dest, pat[b] + 12, t, b === 0 ? 0.17 : 0.1, -0.15);
          if (I > 0.6 && (s >= 64 || V.flute)) { const mel = (s < 64 ? WAR_1 : WAR_2)[s % 64]; if (mel) flute(dest, mel.m, t, mel.len * this.dt * 0.95, 0.045); }
          if (b === 0 || b === 3 || b === 6) drum(dest, t, (b === 0 ? 0.2 : 0.12) * (0.5 + 0.5 * I), 'tom');
          if (I > 0.6 && b === 4) drum(dest, t, 0.09, 'low');
          if (I > 0.6 && bar % 4 === 3 && b >= 4) drum(dest, t + this.dt / 2, 0.07, 'tom');
        } },
      { name: 'nord', dt: 60 / 112 / 2, len: 128,
        play(th, s, t, V) {
          const ps = s % 64, bar = Math.floor(ps / 8), b = ps % 8, dest = th.g, I = th.intensity, mel = NORTH[ps];
          const os = [50, 50, 51, 50, 53, 50, 51, 48][(bar + b) % 8];
          if (b % 2 === 0) lute(dest, os, t, 0.12, -0.2);
          if (mel && s >= 64 && I > 0.6) horn(dest, [mel.m - 12], t, mel.len * this.dt * 0.6, 0.035);
          if (b === 0 || b === 5) drum(dest, t, 0.18 * (0.5 + 0.5 * I), 'tom');
          if (I > 0.6 && (b === 2 || b === 7)) drum(dest, t, 0.08, 'low');
        } },
    ],
  };
  /* Ambiance entre les morceaux : vent, oiseaux, forge au village ; vent, tambours et cor lointains en raid. */
  function windNode(dest, vol, dark) {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const lp = filt('lowpass', dark ? 380 : 620, 0.4), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    g.gain.value = vol; lfo.frequency.value = 0.07; lg.gain.value = vol * 0.6; lfo.connect(lg); lg.connect(g.gain);
    s.connect(lp); lp.connect(g); g.connect(dest); s.start(); lfo.start();
    return { stop() { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + 1.5); s.stop(t + 1.6); lfo.stop(t + 1.6); } };
  }
  function bird(dest, t) {
    const base = 2600 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 3), pan = Math.random() * 1.6 - 0.8;
    for (let i = 0; i < n; i++) tone(dest, 'sine', base * (1 + Math.random() * 0.2), base * (1.15 + Math.random() * 0.3), t + i * 0.11, 0.01, 0.012, 0.07, pan);
  }
  function ambience(th, ahead) {
    if (th.nextAmb > ahead) return;
    const t = Math.max(th.nextAmb, ctx.currentTime + 0.05);
    if (th.name === 'village') {
      const r = Math.random();
      if (r < 0.75) bird(th.g, t);
      else { for (let i = 0; i < 3; i++) for (const f of [1420, 2880]) tone(th.g, 'sine', f, null, t + i * 0.5, 0.001, 0.008 / (f / 1420), 0.25, 0.6); }
      th.nextAmb = t + 2 + Math.random() * 5;
    } else {
      if (Math.random() < 0.6) { for (let i = 0; i < 3; i++) drum(th.g, t + i * 0.45, 0.06, 'tom'); }
      else horn(th.g, [45, 45], t, 0.9, 0.02);
      th.nextAmb = t + 7 + Math.random() * 9;
    }
  }
  let theme = null, want = null, wantI = 1, timer = null;
  const lastPiece = {};
  function music(name, intensity) {
    want = name || null; if (intensity != null) wantI = intensity;
    if (theme && theme.name === want) theme.intensity = wantI;
    if (ctx && unlocked) switchTheme();
  }
  function startPiece(th, t) {
    const pool = PIECES[th.name];
    let i = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && i === lastPiece[th.name]) i = (i + 1) % pool.length;
    lastPiece[th.name] = i;
    const def = pool[i];
    th.piece = { def, step: 0, V: { flute: Math.random() < 0.6, both: Math.random() < 0.4, drum: Math.random() < 0.5, low: Math.random() < 0.5, tr: [0, 0, -2, 2][Math.floor(Math.random() * 4)] }, drone: def.drone ? drone(th.g, def.drone.map(midi), def.droneVol) : null };
    th.t = t;
  }
  function switchTheme() {
    if (!ctx || !unlocked) return;
    const target = S.music ? want : null;
    if (theme && theme.name === target) return;
    stopTheme();
    if (!target) return;
    const g = ctx.createGain(), t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(1, t0 + 2);
    g.connect(musBus);
    const send = ctx.createGain(); send.gain.value = 0.55; g.connect(send); send.connect(rev);
    theme = { name: target, g, piece: null, gapEnd: t0 + (target === 'battle' ? 0.3 : 3 + Math.random() * 4), t: t0, intensity: wantI, nextAmb: t0 + 1, wind: windNode(g, target === 'battle' ? 0.02 : 0.012, target === 'battle') };
    if (!timer) timer = setInterval(tick, 40);
  }
  function stopTheme() {
    if (!theme) return;
    const th = theme, t = ctx.currentTime; theme = null;
    th.g.gain.cancelScheduledValues(t); th.g.gain.setValueAtTime(th.g.gain.value, t); th.g.gain.linearRampToValueAtTime(0.0001, t + 1.2);
    if (th.piece && th.piece.drone) th.piece.drone.stop();
    th.wind.stop();
    setTimeout(() => th.g.disconnect(), 2800);
  }
  function tick() {
    if (!theme || !ctx || ctx.state !== 'running') return;
    const th = theme, now = ctx.currentTime, ahead = now + 0.3;
    if (th.t < now - 1) th.t = now + 0.05; // retour après une pause
    if (!th.piece && now >= th.gapEnd - 0.35) startPiece(th, Math.max(now + 0.05, th.gapEnd));
    while (th.piece && th.t < ahead) {
      const P = th.piece;
      if (P.step >= P.def.len) {
        if (P.drone) P.drone.stop();
        th.piece = null;
        th.gapEnd = th.t + (th.name === 'battle' ? 4 + Math.random() * 8 : 14 + Math.random() * 26);
        break;
      }
      P.def.play(th, P.step, th.t, P.V); th.t += P.def.dt; P.step++;
    }
    ambience(th, ahead);
  }

  /* ---------- bruitages ---------- */
  const last = {}, GAP = { chop: 0.07, wallhit: 0.08, shoot: 0.05, bolt: 0.06, boom: 0.06, death: 0.07, click: 0.03, collapse: 0.12, wallbreak: 0.08 };
  const chime = (dest, freqs, t, step, vol) => freqs.forEach((f, i) => { tone(dest, 'sine', f, f, t + i * step, 0.004, vol, 0.5); tone(dest, 'sine', f * 2.76, f * 2.76, t + i * step, 0.002, vol * 0.25, 0.18); });
  function knock(dest, t, f, vol, pan) { tone(dest, 'sine', f, f * 0.6, t, 0.002, vol, 0.09, pan); hiss(dest, 'bandpass', 700, 2, t, 0.001, vol * 0.7, 0.05, pan); }
  function clink(dest, t, vol, pan) { for (const f of [1420, 2880, 4310]) tone(dest, 'sine', f * (0.97 + Math.random() * 0.06), null, t, 0.001, vol / (f / 1420), 0.16, pan); }
  function horn(dest, notes, t, len, vol) {
    notes.forEach((n, i) => {
      const f = mtof(n), st = t + i * len, o = ctx.createOscillator(), o2 = ctx.createOscillator();
      o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.setValueAtTime(f * 0.97, st); o.frequency.linearRampToValueAtTime(f, st + 0.06); o2.frequency.value = f * 1.005;
      const lp = filt('lowpass', 500, 1.2); lp.frequency.setValueAtTime(400, st); lp.frequency.linearRampToValueAtTime(1500, st + 0.08); lp.frequency.linearRampToValueAtTime(900, st + len);
      const g = gainEnv(st, 0.06, vol, i === notes.length - 1 ? 0.7 : len * 0.6, i === notes.length - 1 ? 0.25 : len * 0.3);
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest);
      o.start(st); o2.start(st); o.stop(st + len + 1.2); o2.stop(st + len + 1.2);
    });
  }
  const FX = {
    click: (d, t) => { tone(d, 'sine', 1300, 760, t, 0.002, 0.05, 0.05); hiss(d, 'bandpass', 3000, 3, t, 0.001, 0.025, 0.02); },
    place: (d, t) => { knock(d, t, 210, 0.3); knock(d, t + 0.12, 175, 0.26); },
    upgrade: (d, t) => { clink(d, t, 0.14); knock(d, t, 180, 0.2); clink(d, t + 0.22, 0.12); knock(d, t + 0.22, 170, 0.18); },
    built: (d, t) => { clink(d, t, 0.1); chime(d, [1046, 1318, 1568, 2093], t + 0.08, 0.08, 0.07); },
    coin: (d, t) => chime(d, [1568, 2093, 2637], t, 0.06, 0.06),
    train: (d, t) => { drum(d, t, 0.18, 'tap'); clink(d, t + 0.05, 0.05); },
    deploy: (d, t, p) => { drum(d, t, 0.22, 'low'); hiss(d, 'bandpass', 900, 1, t, 0.01, 0.06, 0.18, p, 300); },
    hero: (d, t) => { drum(d, t, 0.3, 'tom'); horn(d, [50, 57, 62], t + 0.05, 0.16, 0.09); },
    power: (d, t, p) => { hiss(d, 'bandpass', 400, 2, t, 0.35, 0.18, 0.4, p, 3200); chime(d, [880, 1318, 1760], t + 0.3, 0.05, 0.08); tone(d, 'sine', 90, 40, t + 0.32, 0.005, 0.4, 0.5); },
    chop: (d, t, p) => { hiss(d, 'lowpass', 500 + Math.random() * 300, 0.8, t, 0.002, 0.3, 0.08, p); hiss(d, 'bandpass', 1600 + Math.random() * 800, 2, t, 0.001, 0.13, 0.04, p); },
    wallhit: (d, t, p) => { hiss(d, 'bandpass', 950, 3, t, 0.001, 0.14, 0.06, p); tone(d, 'sine', 95, 60, t, 0.002, 0.16, 0.09, p); },
    shoot: (d, t, p) => hiss(d, 'bandpass', 4200, 2.5, t, 0.004, 0.15, 0.09, p, 1500),
    bolt: (d, t, p) => { tone(d, 'triangle', 170, 90, t, 0.002, 0.13, 0.24, p); hiss(d, 'bandpass', 2400, 2, t, 0.002, 0.06, 0.12, p, 900); },
    catapult: (d, t, p) => { knock(d, t, 120, 0.2, p); hiss(d, 'lowpass', 300, 1, t + 0.05, 0.1, 0.08, 0.35, p, 1400); },
    boom: (d, t, p) => { tone(d, 'sine', 85, 34, t, 0.004, 0.45, 0.55, p); hiss(d, 'lowpass', 420, 0.7, t, 0.003, 0.32, 0.42, p); },
    collapse: (d, t, p) => {
      hiss(d, 'lowpass', 320, 0.7, t, 0.03, 0.42, 1.25, p); tone(d, 'sine', 55, 32, t, 0.01, 0.34, 1.0, p);
      for (let i = 0; i < 7; i++) hiss(d, 'bandpass', 1200 + Math.random() * 1600, 3, t + 0.05 + Math.random() * 0.8, 0.001, 0.09, 0.05, p);
    },
    wallbreak: (d, t, p) => { hiss(d, 'bandpass', 1250, 2, t, 0.001, 0.25, 0.12, p); hiss(d, 'lowpass', 260, 0.7, t, 0.01, 0.22, 0.4, p); tone(d, 'sine', 72, 40, t, 0.003, 0.25, 0.3, p); },
    death: (d, t, p) => { tone(d, 'sine', 150, 60, t, 0.003, 0.1, 0.14, p); hiss(d, 'lowpass', 320, 0.7, t, 0.002, 0.08, 0.1, p); },
    star: (d, t, p, i) => chime(d, [1046 * Math.pow(1.26, i || 0)], t, 0, 0.12),
    invite: (d, t) => { horn(d, [57, 62], t, 0.2, 0.08); horn(d, [57, 62], t + 0.55, 0.2, 0.07); },
    tip: (d, t) => chime(d, [1318, 1760], t, 0.1, 0.045),
    whoosh: (d, t, p) => { hiss(d, 'bandpass', 500, 1.4, t, 0.03, 0.14, 0.24, p, 2200); },
    recruit: (d, t) => { drum(d, t, 0.26, 'tom'); drum(d, t + 0.18, 0.2, 'tap'); horn(d, [55, 62], t + 0.3, 0.18, 0.08); },
    promote: (d, t) => { horn(d, [57, 61, 64], t, 0.12, 0.09); chime(d, [1318, 1760], t + 0.36, 0.06, 0.07); },
    combo: (d, t, p) => { clink(d, t, 0.12, p); tone(d, 'triangle', 392, 784, t, 0.003, 0.07, 0.12, p); chime(d, [1568, 2349], t + 0.05, 0.05, 0.05); },
    storm: (d, t, p) => { tone(d, 'sine', 62, 36, t, 0.04, 0.3, 0.8, p); hiss(d, 'bandpass', 520, 1.3, t, 0.12, 0.2, 0.9, p, 2400); for (let i = 0; i < 5; i++) knock(d, t + 0.1 + i * 0.11, 260 + i * 70, 0.1, p); },
    alarm: (d, t) => horn(d, [50, 50, 46], t, 0.22, 0.08),
    error: (d, t) => { const o = tone(d, 'square', 170, 150, t, 0.004, 0.035, 0.12); o.detune.value = -10; },
    victory: (d, t) => {
      [62, 66, 69, 74].forEach((n, i) => flute(d, n, t + i * 0.13, i === 3 ? 0.9 : 0.12, 0.09));
      [50, 57, 62, 66].forEach((n, i) => lute(d, n, t + 0.52 + i * 0.015, 0.26));
      for (let i = 0; i < 6; i++) drum(d, t + i * 0.07, 0.08 + i * 0.03, 'tap');
      drum(d, t + 0.52, 0.4, 'tom');
    },
    defeat: (d, t) => { [57, 53, 50].forEach((n, i) => lute(d, n, t + i * 0.42, 0.34)); horn(d, [45, 41], t + 0.1, 0.5, 0.05); drum(d, t + 1.3, 0.25, 'low'); },
  };
  function sfx(name, opts) {
    if (!ctx || !unlocked || !S.sfx || ctx.state !== 'running' || !FX[name]) return;
    const t = ctx.currentTime, g = GAP[name] || 0;
    if (g && last[name] && t - last[name] < g) return;
    last[name] = t;
    try { FX[name](sfxBus, t + 0.01, opts && opts.pan, opts && opts.i); } catch (e) { /* son ignoré */ }
  }
  /* Petit air joué par-dessus la musique (victoire, défaite) : la musique se tait un instant. */
  function jingle(name) {
    if (!ctx || !unlocked || ctx.state !== 'running') return;
    if (theme) { const g = theme.g, t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.15, t + 0.3); g.gain.linearRampToValueAtTime(1, t + 4.5); }
    if (S.sfx || S.music) FX[name] && FX[name](S.sfx ? sfxBus : musBus, ctx.currentTime + 0.05);
  }
  /* Essais : rend quelques secondes d'un air ou d'un bruitage hors ligne et renvoie les niveaux (crête, moyenne). */
  async function _render(kind, name, sec) {
    const save = { ctx, master, musBus, sfxBus, rev, noise, plucks: Object.assign({}, plucks) };
    const off = new OfflineAudioContext(2, Math.floor(44100 * sec), 44100);
    ctx = off; for (const k in plucks) delete plucks[k];
    master = ctx.createGain(); master.connect(ctx.destination);
    musBus = ctx.createGain(); musBus.gain.value = S.mv * 1.0; musBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = S.sv; sfxBus.connect(master);
    rev = ctx.createConvolver(); rev.buffer = impulse(1.8, 3); const rg = ctx.createGain(); rg.gain.value = 0.28; rev.connect(rg); rg.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    try {
      if (kind === 'music') {
        const def = PIECES.village.concat(PIECES.battle).find(p => p.name === name), g = ctx.createGain(); g.connect(musBus);
        const th = { g, intensity: 1, name }, V = { flute: true, both: true, drum: true, low: false, tr: 0 };
        if (def.drone) drone(g, def.drone.map(midi), def.droneVol);
        for (let st = 0, t = 0.05; t < sec - 0.3 && st < def.len; st++, t += def.dt) def.play(th, st, t, V);
      } else FX[name](sfxBus, 0.05);
      const buf = await off.startRendering(), d = buf.getChannelData(0);
      let peak = 0, sum = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; }
      return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4), nan: d.some(x => Number.isNaN(x)) };
    } finally { ctx = save.ctx; master = save.master; musBus = save.musBus; sfxBus = save.sfxBus; rev = save.rev; noise = save.noise; for (const k in plucks) delete plucks[k]; Object.assign(plucks, save.plucks); }
  }
  return {
    unlock, music, sfx, jingle, _render,
    get: () => Object.assign({}, S),
    set(o) { Object.assign(S, o); save(); applyVolumes(); if ('music' in o) switchTheme(); },
  };
})();
