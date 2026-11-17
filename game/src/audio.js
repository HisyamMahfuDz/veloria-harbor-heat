// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, sirens, gunfire, pickups and a small procedural music loop.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenOn = false;
  let musicOn = true;
  let musicTimer = 0;
  let nextNote = 0;
  let step = 0;

  // A lazy bass + pad loop in A minor, original and written for this game.
  const BASS = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41];
  const CHORDS = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 196, 246.94]];

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 40;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch { return false; }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }

  function playStep() {
    const bar = Math.floor(step / 8) % CHORDS.length;
    const bass = BASS[step % 8];
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = bass;
    g.gain.setValueAtTime(0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.02, ctx.currentTime + 0.22);
    o.connect(g); g.connect(musicGain); o.start(); o.stop(ctx.currentTime + 0.24);
    if (step % 8 === 0) {
      for (const f of CHORDS[bar]) {
        const p = ctx.createOscillator(); const pg = ctx.createGain();
        p.type = 'sine'; p.frequency.value = f;
        pg.gain.setValueAtTime(0.0001, ctx.currentTime);
        pg.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.4);
        pg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.9);
        p.connect(pg); pg.connect(musicGain); p.start(); p.stop(ctx.currentTime + 2);
      }
    }
    if (step % 2 === 0) {
      const h = ctx.createOscillator(); const hg = ctx.createGain();
      h.type = 'square'; h.frequency.value = 6000;
      hg.gain.setValueAtTime(0.03, ctx.currentTime);
      hg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      h.connect(hg); hg.connect(musicGain); h.start(); h.stop(ctx.currentTime + 0.04);
    }
    step += 1;
  }

  return {
    unlock() { ensure(); },
    setMusicOn(on) { musicOn = on; if (musicGain) musicGain.gain.value = on ? 0.16 : 0; },
    update(dt, driving, speedNorm, wanted) {
      if (!ctx) return;
      if (engineGain) {
        engineGain.gain.value += ((driving ? 0.05 + speedNorm * 0.1 : 0) - engineGain.gain.value) * Math.min(1, dt * 6);
        engineOsc.frequency.value = 40 + speedNorm * 130;
      }
      const wantSiren = wanted > 0;
      if (wantSiren !== sirenOn) { sirenOn = wantSiren; if (sirenGain) sirenGain.gain.value = wantSiren ? 0.045 : 0; }
      if (sirenOn) sirenOsc.frequency.value = 650 + 250 * Math.sin(performance.now() / 280);
      if (musicOn) {
        musicTimer += dt;
        if (musicTimer >= nextNote) { playStep(); nextNote = musicTimer + 0.24; }
      }
    },
    shot() { noise(0.14, 0.5, 2600); blip(160, 0.08, 'square', 0.25, 60); },
    boom() { noise(0.5, 0.7, 700); blip(90, 0.4, 'sine', 0.5, 30); },
    punch() { noise(0.08, 0.4, 900); },
    crash() { noise(0.25, 0.45, 1200); },
    pickup() { blip(880, 0.09, 'sine', 0.3); setTimeout(() => blip(1320, 0.12, 'sine', 0.3), 70); },
    cash() { blip(1046, 0.07, 'triangle', 0.3); setTimeout(() => blip(1568, 0.1, 'triangle', 0.3), 60); },
    missionPass() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.32), i * 110)); },
    missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.3), i * 140)); },
    busted() { [440, 415, 392, 370].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'sawtooth', 0.16), i * 130)); },
    horn() { blip(370, 0.25, 'square', 0.18); blip(466, 0.25, 'square', 0.14); },
    skid() { noise(0.18, 0.12, 3200); },
  };
}
