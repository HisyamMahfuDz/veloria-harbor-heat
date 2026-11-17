// Boot and the one loop: fixed 1/60 s simulation steps, the renderer, the
// screens (title, play, paused, busted/wasted) and the staged screenshot
// mode (?shot=cover|street|mission|title&seed=N sets window.__shotReady).
import { STEP, GAME_TITLE } from './config.js';
import { createRandom } from './random.js';
import { createRenderer } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, defaultSave } from './save.js';
import { createWorld, updateWorld, respawnPlayer } from './world.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';
import { syncPlayerMesh } from './player.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const view = createRenderer(canvas);
const hud = createHud();
const audio = createAudio();
const rng = createRandom(seed);
let save = loadSave();
const state = createWorld(view.scene, rng, save, audio);
state.hud = hud;

function startGame(fresh) {
  if (fresh) {
    save = defaultSave();
    state.save = save;
    state.stats = save.stats;
    state.cash = save.cash;
    state.player.health = 100;
    state.player.armor = 0;
    state.player.ammo = { pistol: 96, smg: 0, shotgun: 0 };
    state.player.mag = { pistol: 12, smg: 32, shotgun: 6 };
    state.player.weapon = 'pistol';
    writeSave(save);
  }
  audio.unlock();
  audio.setMusicOn(save.musicOn);
  state.screen = 'play';
  hud.showGame();
  hud.announce(`${GAME_TITLE}. Drive to Ivy's Garage and press Q to start the story.`);
}

function showTitle() {
  state.screen = 'title';
  const continued = save.missionIndex > 0 || save.cash !== 250 || save.missionsDone.length > 0;
  hud.showMenu(continued);
}

function pauseGame() {
  if (state.screen !== 'play') return;
  state.screen = 'pause';
  const s = state.stats;
  hud.showPause(
    `Cash $${Math.floor(state.cash).toLocaleString('en-US')} · Missions ${save.missionsDone.length}/6 · ` +
    `Packages ${save.packages.length}/10 · Cars stolen ${s.carsStolen} · Fares ${s.faresDone} · ` +
    `Distance ${s.distanceKm.toFixed(1)} km · Cops evaded ${s.copsEvaded}`,
  );
}

function resumeGame() {
  if (state.screen !== 'pause') return;
  state.screen = 'play';
  hud.hidePause();
}

document.getElementById('btn-start').addEventListener('click', () => startGame(true));
document.getElementById('btn-continue').addEventListener('click', () => startGame(false));
document.getElementById('btn-help').addEventListener('click', () => hud.showHelp());
document.getElementById('btn-help2').addEventListener('click', () => hud.showHelp());
document.getElementById('btn-help-close').addEventListener('click', () => hud.hideHelp());
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-quit').addEventListener('click', () => {
  save.cash = Math.floor(state.cash);
  writeSave(save);
  hud.hidePause();
  showTitle();
});
document.getElementById('btn-end').addEventListener('click', () => {
  hud.hideEnd();
  respawnPlayer(state);
  hud.showGame();
});
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });

function runShot(name) {
  hud.showGame();
  const framing = stageShot(name, state, view);
  // Debug overrides for framing checks: ?campitch=0.6&camdist=20
  const pitchOverride = Number.parseFloat(params.get('campitch') ?? '');
  const distOverride = Number.parseFloat(params.get('camdist') ?? '');
  if (name === 'title') {
    hud.showMenu(false);
    document.getElementById('btn-continue').classList.add('hidden');
  }
  let painted = 0;
  function paint() {
    const p = state.player;
    if (name === 'title') {
      view.updateCamera(state, -40, 6, 60, 1 / 60, { yaw: Math.PI * 0.82, pitch: 0.42, dist: 170, snap: true, ignoreCollision: true });
    } else if (framing) {
      view.updateCamera(state, p.x, p.y, p.z, 1 / 60, {
        yaw: framing.yaw,
        pitch: Number.isFinite(pitchOverride) ? pitchOverride : framing.pitch,
        dist: Number.isFinite(distOverride) ? distOverride : framing.dist,
        snap: true,
      });
    }
    if (p.aiming) syncPlayerMesh(p);
    view.render();
    hud.update(state, 1 / 60, state.promptText ?? null);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  showTitle();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE) {
      if (state.screen === 'play') pauseGame();
      else if (state.screen === 'pause') resumeGame();
    }
    if (state.screen === 'play' || state.screen === 'title') {
      let first = true;
      while (accumulator >= STEP) {
        const stepActions = first ? actions : 0;
        first = false;
        if (state.screen === 'play') updateWorld(state, STEP, input, view.camera, stepActions);
        else updateWorld(state, STEP, { axis: () => ({ x: 0, z: 0 }), takeLook: () => ({ x: 0, y: 0 }), takeActions: () => 0, isFiring: () => false, sprint: () => false, jump: () => false, weaponSlot: () => -1, clear: () => {} }, view.camera, 0);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const p = state.player;
    if (state.screen === 'title') {
      const t = state.time * 0.03;
      view.updateCamera(state, 0, 8, 20, 1 / 60, { yaw: Math.PI * 0.8 + t * 0.15, pitch: 0.45, dist: 165, ignoreCollision: true });
    } else {
      view.updateCamera(state, p.x, p.y, p.z, 1 / 60);
    }
    view.render();
    if (state.screen === 'play') hud.update(state, 1 / 60, state.promptText ?? null);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') pauseGame();
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
