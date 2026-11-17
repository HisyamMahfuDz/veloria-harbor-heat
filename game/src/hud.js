// The HUD: DOM overlays (wanted stars, cash, health, objective, dialogue,
// prompts, banners) and the circular canvas minimap with live blips.
import { WORLD, PLACES, RANKS, WEAPONS, CONTROLS_TEXT, PLAYER } from './config.js';
import { currentObjective } from './missions.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  const els = {
    hud: $('hud'), wanted: $('wanted'), cash: $('cash'), rank: $('rank'), clock: $('clock'),
    objective: $('objective'), objMission: $('obj-mission'), objText: $('obj-text'),
    subtitle: $('subtitle'), prompt: $('prompt'), health: $('health-bar'), armor: $('armor-bar'),
    speed: $('speed'), weapon: $('weapon'), toast: $('toast'),
    banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
    vignette: $('vignette'), hint: $('hint'), minimap: $('minimap'),
    menu: $('menu'), pause: $('pause'), help: $('help'), endscreen: $('endscreen'),
    endTitle: $('end-title'), endSub: $('end-sub'), pauseStats: $('pause-stats'),
    status: $('status'),
  };
  const mctx = els.minimap.getContext('2d');
  const cache = {};
  let bannerTimer = 0;
  let subtitleTimer = 0;
  let hintTimer = 14;
  const toasts = [];

  // Controls table on the help panel.
  const table = $('controls-table');
  for (const [k, v] of CONTROLS_TEXT) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${k}</td><td>${v}</td>`;
    table.appendChild(tr);
  }

  function setText(el, key, value) {
    if (cache[key] !== value) { cache[key] = value; el.textContent = value; }
  }
  function setHtml(el, key, value) {
    if (cache[key] !== value) { cache[key] = value; el.innerHTML = value; }
  }

  function drawMinimap(state) {
    const S = 216;
    const ctx = mctx;
    const p = state.player;
    const scale = S / 190; // ~190 world units across the disc
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#3f4a3a';
    ctx.fillRect(0, 0, S, S);
    const toMap = (x, z) => [S / 2 + (x - p.x) * scale, S / 2 + (z - p.z) * scale];
    // Water south.
    const [, wy] = toMap(0, WORLD.waterZ);
    ctx.fillStyle = '#1d7fa8';
    ctx.fillRect(0, wy, S, S - wy);
    const [, by] = toMap(0, WORLD.beachZ);
    ctx.fillStyle = '#e8cf9a';
    ctx.fillRect(0, by, S, wy - by);
    // Blocks.
    ctx.fillStyle = '#565e66';
    for (let i = 0; i < 7; i += 1) for (let j = 0; j < 7; j += 1) {
      const [x, z] = toMap(-252 + i * 72 + 36 - 28, -252 + j * 72 + 36 - 28);
      ctx.fillRect(x, z, 56 * scale, 56 * scale);
    }
    // Roads.
    ctx.strokeStyle = '#22262b';
    ctx.lineWidth = 16 * scale;
    for (let i = 0; i < 8; i += 1) {
      const l = -252 + i * 72;
      const [x] = toMap(l, 0);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
      const [, z] = toMap(0, l);
      ctx.beginPath(); ctx.moveTo(0, z); ctx.lineTo(S, z); ctx.stroke();
    }
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i += 1) {
      const l = -252 + i * 72;
      const [x] = toMap(l, 0);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
      const [, z] = toMap(0, l);
      ctx.beginPath(); ctx.moveTo(0, z); ctx.lineTo(S, z); ctx.stroke();
    }
    // Blips.
    const blip = (x, z, color, r = 5, shape = 'dot') => {
      const [mx, mz] = toMap(x, z);
      if (mx < -10 || mx > S + 10 || mz < -10 || mz > S + 10) return;
      ctx.fillStyle = color;
      if (shape === 'diamond') {
        ctx.beginPath(); ctx.moveTo(mx, mz - r); ctx.lineTo(mx + r, mz); ctx.lineTo(mx, mz + r); ctx.lineTo(mx - r, mz); ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(mx, mz, r, 0, Math.PI * 2); ctx.fill();
      }
    };
    for (const pkg of state.packages) if (!pkg.taken) blip(pkg.x, pkg.z, '#7ae582', 4, 'diamond');
    for (const car of state.cars) if (car.role === 'police') blip(car.x, car.z, '#3a6fd8', 5);
    for (const goon of state.enemies) if (!goon.dead) blip(goon.x, goon.z, '#ff4d4d', 4);
    const obj = currentObjective(state);
    if (obj) blip(obj.x, obj.z, '#ffb02e', 8, 'diamond');
    else blip(PLACES.garage.x, PLACES.garage.z, '#ffb02e', 6, 'diamond');
    if (state.taxiFare) blip(state.taxiFare.destX, state.taxiFare.destZ, '#f2c21d', 7, 'diamond');
    // Player arrow.
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)));
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', S / 2, 16);
  }

  return {
    els,
    showGame() { els.hud.classList.remove('hidden'); els.menu.classList.add('hidden'); },
    showMenu(continued) {
      els.menu.classList.remove('hidden');
      els.hud.classList.add('hidden');
      $('btn-continue').classList.toggle('hidden', !continued);
    },
    showPause(stats) {
      els.pause.classList.remove('hidden');
      setText(els.pauseStats, 'pauseStats', stats);
    },
    hidePause() { els.pause.classList.add('hidden'); },
    showHelp() { els.help.classList.remove('hidden'); },
    hideHelp() { els.help.classList.add('hidden'); },
    showEnd(title, sub, color) {
      els.endscreen.classList.remove('hidden');
      setText(els.endTitle, 'endTitle', title);
      setText(els.endSub, 'endSub', sub);
      els.endTitle.style.color = color;
    },
    hideEnd() { els.endscreen.classList.add('hidden'); },
    banner(title, sub, dur = 3.2) {
      setText(els.bannerTitle, 'bannerTitle', title);
      setText(els.bannerSub, 'bannerSub', sub);
      els.banner.classList.remove('hidden');
      bannerTimer = dur;
    },
    toast(text, dur = 4) {
      const div = document.createElement('div');
      div.textContent = text;
      els.toast.appendChild(div);
      toasts.push({ div, t: dur });
    },
    announce(msg) { els.status.textContent = msg; },
    update(state, dt, promptText) {
      const p = state.player;
      // Wanted stars.
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '<span class="dim">★</span>';
      setHtml(els.wanted, 'wanted', stars);
      setText(els.cash, 'cash', `$${Math.floor(state.cash).toLocaleString('en-US')}`);
      const rank = [...RANKS].reverse().find((r) => state.cash >= r.cash) ?? RANKS[0];
      setText(els.rank, 'rank', `${rank.name} · ${state.save.missionsDone.length}/6 missions`);
      const mins = Math.floor(state.time / 60);
      const secs = Math.floor(state.time % 60);
      setText(els.clock, 'clock', `17:${String(38 + Math.floor(mins / 6)).padStart(2, '0')} · ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      // Objective.
      const obj = currentObjective(state);
      if (obj) {
        els.objective.classList.remove('hidden');
        setText(els.objMission, 'objMission', state.mission.def.title.toUpperCase());
        setText(els.objText, 'objText', obj.text);
      } else if (state.taxiFare) {
        els.objective.classList.remove('hidden');
        setText(els.objMission, 'objMission', 'TAXI FARE');
        setText(els.objText, 'objText', state.taxiFare.pickedUp ? 'Drop the passenger off' : 'Pick up the passenger');
      } else {
        els.objective.classList.add('hidden');
      }
      // Vitals.
      els.health.style.width = `${Math.max(0, (p.health / PLAYER.maxHealth) * 100)}%`;
      els.armor.style.width = `${Math.max(0, (p.armor / PLAYER.maxArmor) * 100)}%`;
      els.vignette.style.boxShadow = p.health < 30
        ? 'inset 0 0 120px 40px rgba(200,0,0,0.55)'
        : p.hurtTimer > 0 ? 'inset 0 0 120px 40px rgba(200,0,0,0.35)' : 'inset 0 0 120px 40px rgba(200,0,0,0)';
      // Drive / weapon.
      if (p.car) {
        els.speed.classList.remove('hidden');
        setHtml(els.speed, 'speed', `${Math.round(Math.abs(p.car.speed) * 2.2)}<small> mph</small>`);
      } else {
        els.speed.classList.add('hidden');
      }
      const w = WEAPONS[p.weapon];
      const ammoText = p.weapon === 'fists' ? `${w.name}` : `${w.name}  <b>${p.mag[p.weapon] ?? '—'}</b> / ${p.ammo[p.weapon] ?? 0}`;
      setHtml(els.weapon, 'weapon', ammoText);
      // Prompt.
      if (promptText) {
        els.prompt.classList.remove('hidden');
        setHtml(els.prompt, 'prompt', promptText);
      } else els.prompt.classList.add('hidden');
      // Subtitle dialogue.
      if (state.dialogue.length > 0) {
        const line = state.dialogue[0];
        els.subtitle.classList.remove('hidden');
        setHtml(els.subtitle, 'subtitle', `<b>${line.who}:</b> ${line.line}`);
        subtitleTimer += dt;
        if (subtitleTimer > 3.6) { state.dialogue.shift(); subtitleTimer = 0; }
      } else {
        els.subtitle.classList.add('hidden');
        subtitleTimer = 0;
      }
      // Banner + toasts + hint.
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) els.banner.classList.add('hidden');
      }
      for (let i = toasts.length - 1; i >= 0; i -= 1) {
        toasts[i].t -= dt;
        if (toasts[i].t <= 0) { toasts[i].div.remove(); toasts.splice(i, 1); }
      }
      if (hintTimer > 0) {
        hintTimer -= dt;
        if (hintTimer <= 0) els.hint.classList.add('hidden');
      }
      drawMinimap(state);
    },
  };
}
