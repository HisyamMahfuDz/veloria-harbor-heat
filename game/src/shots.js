// Deterministic staged frames for screenshots (?shot=cover|street|mission|
// title&seed=N). Each scene sets the real game state, plays the real rules
// forward for a fixed number of steps, and leaves the camera framed — the
// frame is what the game really looks like, never a mock-up.
import { PLACES } from './config.js';
import { spawnCar } from './vehicles.js';
import { spawnGoon } from './enemies.js';
import { spawnPed, scarePeds } from './pedestrians.js';
import { startMission } from './missions.js';
import { addHeat, spawnPoliceCar } from './police.js';
import { updateWorld } from './world.js';

const STEPS = 100;

function stubInput(drive) {
  return {
    axis: () => ({ x: 0, z: drive ? -1 : 0 }),
    takeLook: () => ({ x: 0, y: 0 }),
    takeActions: () => 0,
    isFiring: () => false,
    sprint: () => false,
    jump: () => false,
    weaponSlot: () => -1,
    clear: () => {},
  };
}

function runSteps(state, view, n, drive) {
  const input = stubInput(drive);
  for (let i = 0; i < n; i += 1) {
    updateWorld(state, 1 / 60, input, view.camera);
  }
}

function putPlayerInCar(state, model, x, z, heading) {
  const car = spawnCar(state.scene, model, x, z, heading, 'player', state.rng);
  state.cars.push(car);
  const p = state.player;
  p.car = car;
  p.onFoot = false;
  p.mesh.visible = false;
  p.x = x; p.z = z; p.heading = heading;
  car.speed = 18;
  return car;
}

function stageCover(state, view) {
  // A police chase down the main avenue: the cover shot.
  state.screen = 'play';
  state.cash = 2450;
  // Clear ambient traffic near the staging point so the chase reads clean.
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    const c = state.cars[i];
    if (c.role === 'traffic' && Math.hypot(c.x + 36, c.z - 36) < 110) {
      state.scene.remove(c.mesh);
      state.cars.splice(i, 1);
    }
  }
  const car = putPlayerInCar(state, 'muscle', -36, 36, Math.PI / 2);
  car.damage = 18;
  car.speed = 30;
  state.player.weapon = 'pistol';
  // Two interceptors flanking, staged in frame (role 'mission': they hold
  // their line while the chase plays out around them).
  for (const [dx, dz] of [[16, 7], [44, -5]]) {
    const pc = spawnCar(state.scene, 'police', car.x + dx, car.z + dz, Math.PI / 2, 'mission', state.rng);
    pc.speed = 24;
    state.cars.push(pc);
  }
  // Oncoming traffic in the far lane, well ahead.
  for (let i = 0; i < 3; i += 1) {
    const t = spawnCar(state.scene, ['sedan', 'taxi', 'van'][i], car.x + 100 + i * 30, 28, -Math.PI / 2, 'traffic', state.rng);
    t.speed = 11;
    state.cars.push(t);
  }
  addHeat(state, 3, 'bank robbery');
  startMission(state, 2); // The Getaway
  state.mission.stageIndex = 2; // escape stage
  state.dialogue = [{ who: 'Crew', line: 'Go go go! Drive!', t: 0 }];
  state.cameraYaw = Math.PI / 2 + Math.PI;
  state.cameraPitch = 0.12;
  runSteps(state, view, 22, true);
  return { yaw: state.cameraYaw, pitch: 0.12, dist: 12 };
}

function stageStreet(state, view) {
  // On foot among pedestrians and traffic, outside Rosa's Diner.
  state.screen = 'play';
  state.cash = 620;
  const p = state.player;
  p.x = PLACES.diner.x + 2;
  p.z = PLACES.diner.z - 6;
  p.heading = Math.PI * 0.9;
  p.mesh.position.set(p.x, 0.3, p.z);
  p.weapon = 'pistol';
  for (let i = 0; i < 6; i += 1) {
    const ped = spawnPed(state.scene, p.x + state.rng.range(-16, 16), p.z + state.rng.range(-10, 14), state.rng);
    state.peds.push(ped);
  }
  const taxi = spawnCar(state.scene, 'taxi', p.x + 18, PLACES.diner.z - 36 + 4, -Math.PI / 2, 'traffic', state.rng);
  taxi.speed = 10;
  state.cars.push(taxi);
  state.dialogue = [{ who: 'Ivy', line: 'Mara! The cab is outside. A client waits at the Marlin Hotel.', t: 0 }];
  state.promptText = '<b>Q</b> Start mission: First Fare — Ivy Chen';
  state.cameraYaw = Math.PI * 0.15;
  state.cameraPitch = 0.3;
  runSteps(state, view, 60, false);
  return { yaw: state.cameraYaw, pitch: 0.3, dist: 8 };
}

function stageMission(state, view) {
  // The Exchange: a shootout at the docks, briefcase beacon, wanted level.
  state.screen = 'play';
  state.cash = 1980;
  const p = state.player;
  p.x = PLACES.docks.x - 26;
  p.z = PLACES.docks.z - 4;
  p.heading = Math.PI / 2;
  p.mesh.position.set(p.x, 0.3, p.z);
  p.weapon = 'smg';
  p.mag.smg = 32;
  p.ammo.smg = 128;
  state.save.ownedWeapons.push('smg');
  startMission(state, 4); // The Exchange
  state.mission.stageIndex = 1; // kill stage
  state.missionData.killTarget = 6;
  state.missionData.killed = 2;
  for (let i = 0; i < 4; i += 1) {
    spawnGoon(state, state.scene, state.rng,
      PLACES.docks.x + state.rng.range(-8, 20),
      PLACES.docks.z + state.rng.range(-12, 10),
      { aggressive: true });
  }
  addHeat(state, 2, 'shootout');
  state.dialogue = [{ who: 'Goon', line: 'She is here! Take her down!', t: 0 }];
  p.aiming = true;
  p.aimHeading = Math.PI / 2;
  state.cameraYaw = -Math.PI / 2;
  state.cameraPitch = 0.22;
  scarePeds(state.peds, p.x, p.z, 20);
  runSteps(state, view, 40, false);
  p.aiming = true;
  return { yaw: -Math.PI / 2, pitch: 0.22, dist: 7 };
}

function stageTitle(state, view) {
  // The title screen over a high vista of the city and the pier.
  state.screen = 'title';
  state.cameraYaw = Math.PI * 0.9;
  runSteps(state, view, 30, false);
  return { vista: true };
}

export function stageShot(name, state, view) {
  if (name === 'street') return stageStreet(state, view);
  if (name === 'mission') return stageMission(state, view);
  if (name === 'title') return stageTitle(state, view);
  return stageCover(state, view);
}
