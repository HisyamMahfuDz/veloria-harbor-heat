// The world: owns every entity, runs the fixed-step simulation, resolves
// combat, crimes, side activities and events. Rendering only reads this state.
import * as THREE from 'three';
import { STEP, WORLD, PLACES, PLAYER, WEAPONS, WANTED } from './config.js';
import { createCity, roadLines, onRoad } from './city.js';
import { spawnCar, updateTrafficCar, updatePlayerCar, syncCarMesh, resolveCarCollisions, collideCarWithCity, MODELS } from './vehicles.js';
import { spawnPed, updatePed, killPed, scarePeds } from './pedestrians.js';
import { createPlayer, updatePlayerOnFoot, damagePlayer, syncPlayerMesh } from './player.js';
import { updatePolice, addHeat, clearWanted } from './police.js';
import { updateGoon } from './enemies.js';
import { fireShot, applyShotDamage, muzzlePos } from './combat.js';
import { updateMissions, onGoonDown, missionStartAvailable, startMission, nextMissionTitle, failMission, currentObjective } from './missions.js';
import { ACTION_ENTER, ACTION_PUNCH, ACTION_RELOAD, ACTION_TALK } from './input.js';
import { createEffects } from './effects.js';
import { writeSave } from './save.js';

const PACKAGE_SPOTS = [
  [-216, -216], [216, -216], [-216, 216], [216, 216], [0, -216], [-216, 0],
  [216, 0], [0, 216], [-108, 108], [108, -108],
];

export function createWorld(scene, rng, save, audio) {
  const city = createCity(scene, rng);
  const effects = createEffects(scene);
  const player = createPlayer(scene, rng, PLACES.garage.x + 4, PLACES.garage.z + 16);
  const state = {
    scene, rng, save, audio, city, effects,
    colliders: city.colliders,
    time: 0, cash: save.cash, wanted: 0, unseenTimer: 0, spawnTimer: 0,
    player, cars: [], peds: [], cops: [], enemies: [],
    mission: null, missionData: {}, dialogue: [], events: [],
    packages: [], taxiFare: null, taxiTimer: 8,
    cameraYaw: Math.PI * 0.75, cameraPitch: 0.34, cameraDir: new THREE.Vector3(0, 0, -1),
    screen: 'title', stats: save.stats, playerArmed: false,
    shootCooldown: 0, gunHeatTimer: 0, saveTimer: 0, endTimer: 0,
  };
  state.damagePlayer = (amount) => damagePlayer(player, amount, state);

  // Traffic.
  const lines = roadLines();
  for (let i = 0; i < 14; i += 1) {
    const vertical = rng.chance(0.5);
    const l = rng.pick(lines);
    const along = rng.range(-240, 240);
    const x = vertical ? l + 4 : along;
    const z = vertical ? along : l + 4;
    const heading = vertical ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const model = rng.pick(['sedan', 'sedan', 'coupe', 'van', 'taxi', 'muscle']);
    const car = spawnCar(scene, model, x, z, heading, 'traffic', rng);
    car.speed = 12;
    state.cars.push(car);
  }
  // Parked cars, including the starter cab at the garage.
  const cab = spawnCar(scene, 'taxi', PLACES.garage.x + 8, PLACES.garage.z + 12, Math.PI / 2, 'parked', rng);
  state.cars.push(cab);
  for (let i = 0; i < 10; i += 1) {
    const vertical = rng.chance(0.5);
    const l = rng.pick(lines);
    const along = rng.range(-230, 230);
    const x = vertical ? l + 6 : along;
    const z = vertical ? along : l + 6;
    if (Math.hypot(x - player.x, z - player.z) < 20) continue;
    const model = rng.pick(['sedan', 'coupe', 'muscle', 'van']);
    state.cars.push(spawnCar(scene, model, x, z, vertical ? 0 : Math.PI / 2, 'parked', rng));
  }
  // Pedestrians.
  for (let i = 0; i < 36; i += 1) {
    const l = rng.pick(lines);
    const along = rng.range(-250, 250);
    const vertical = rng.chance(0.5);
    state.peds.push(spawnPed(scene, vertical ? l + 10 : along, vertical ? along : l + 10, rng));
  }
  // Hidden packages: small glowing diamonds.
  const pkgGeo = new THREE.OctahedronGeometry(0.8);
  const pkgMat = new THREE.MeshBasicMaterial({ color: 0x7ae582 });
  for (let i = 0; i < PACKAGE_SPOTS.length; i += 1) {
    const [x, z] = PACKAGE_SPOTS[i];
    const mesh = new THREE.Mesh(pkgGeo, pkgMat);
    mesh.position.set(x, 1.4, z);
    scene.add(mesh);
    state.packages.push({ x, z, mesh, taken: save.packages.includes(i), index: i });
    if (save.packages.includes(i)) mesh.visible = false;
  }
  return state;
}

function nearestCar(state, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(state, car) {
  const p = state.player;
  const wasSteal = car.role === 'parked' || car.role === 'traffic';
  if (wasSteal) {
    state.stats.carsStolen += 1;
    let witnessed = false;
    for (const ped of state.peds) if (!ped.dead && Math.hypot(ped.x - p.x, ped.z - p.z) < 35) witnessed = true;
    for (const cop of state.cops) if (!cop.dead && Math.hypot(cop.x - p.x, cop.z - p.z) < 60) witnessed = true;
    if (witnessed) addHeat(state, 1, 'car theft');
    state.audio.cash();
  }
  car.role = 'player';
  p.car = car;
  p.onFoot = false;
  p.mesh.visible = false;
  p.speed = 0;
}

function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car || Math.abs(car.speed) > 3) return;
  car.role = 'parked';
  p.car = null;
  p.onFoot = true;
  p.x = car.x + Math.cos(car.heading) * 3;
  p.z = car.z - Math.sin(car.heading) * 3;
  p.heading = car.heading;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0.3, p.z);
  syncPlayerMesh(p);
}

function playerShoot(state, camera) {
  const p = state.player;
  const w = WEAPONS[p.weapon];
  if (p.reloadTimer > 0 || state.shootCooldown > 0) return;
  if (p.weapon !== 'fists' && (p.mag[p.weapon] ?? 0) <= 0) {
    startReload(state);
    return;
  }
  state.shootCooldown = w.rate;
  if (p.weapon === 'fists') {
    punch(state);
    return;
  }
  p.mag[p.weapon] -= 1;
  const origin = { x: p.x, y: p.y + 1.45, z: p.z };
  const dir = state.cameraDir;
  const hits = fireShot(state, origin, dir, p.weapon, p);
  const mz = muzzlePos(p.mesh);
  state.effects.muzzle(mz.x, mz.y, mz.z);
  for (const hit of hits) {
    state.effects.tracer(mz, hit);
    if (hit.target) {
      applyShotDamage(state, hit, p.weapon, p);
      if (hit.part === 'car') state.effects.sparks(hit.x, hit.y, hit.z, 8);
      else state.effects.blood(hit.x, hit.y, hit.z);
    } else {
      state.effects.sparks(hit.x, hit.y, hit.z, 4);
    }
  }
  state.audio.shot();
  p.aiming = true;
  scarePeds(state.peds, p.x, p.z, 30);
  if (state.gunHeatTimer <= 0) {
    let witnessed = false;
    for (const cop of state.cops) if (!cop.dead && Math.hypot(cop.x - p.x, cop.z - p.z) < 60) witnessed = true;
    for (const car of state.cars) if (car.role === 'police' && Math.hypot(car.x - p.x, car.z - p.z) < 70) witnessed = true;
    if (witnessed) addHeat(state, 1, 'gunfire');
    state.gunHeatTimer = 10;
  }
  if (p.mag[p.weapon] <= 0) startReload(state);
}

function punch(state) {
  const p = state.player;
  p.punchTimer = PLAYER.punchCooldown;
  state.audio.punch();
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const targets = [...state.peds, ...state.cops, ...state.enemies];
  for (const t of targets) {
    if (t.dead) continue;
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < PLAYER.punchRange && dx * fx + dz * fz > 0) {
      t.health = (t.health ?? 100) - PLAYER.punchDamage;
      state.effects.burst(t.x, 1.4, t.z, 4, '#ffffff', 2, 0.3, 0.8);
      if (t.health <= 0 && !t.dead) {
        t.dead = true;
        if (t.kind === 'goon') state.events.push({ type: 'goonDown', goon: t });
        else if (t.kind === 'cop') state.events.push({ type: 'copDown', cop: t });
        else state.events.push({ type: 'pedDown', ped: t });
      }
      break;
    }
  }
}

function startReload(state) {
  const p = state.player;
  const w = WEAPONS[p.weapon];
  if (p.weapon === 'fists' || p.reloadTimer > 0) return;
  if ((p.ammo[p.weapon] ?? 0) <= 0) return;
  if ((p.mag[p.weapon] ?? 0) >= w.mag) return;
  p.reloadTimer = 1.2;
}

function finishReload(state) {
  const p = state.player;
  const w = WEAPONS[p.weapon];
  const need = w.mag - (p.mag[p.weapon] ?? 0);
  const take = Math.min(need, p.ammo[p.weapon] ?? 0);
  p.mag[p.weapon] = (p.mag[p.weapon] ?? 0) + take;
  p.ammo[p.weapon] -= take;
}

function enemyShoot(state, shooter, dist, accuracy) {
  const p = state.player;
  const from = { x: shooter.x, y: 1.45, z: shooter.z };
  const dx = p.x - shooter.x;
  const dy = (p.y + 1.2) - 1.45;
  const dz = p.z - shooter.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  const err = (1 - accuracy) * 0.12 * (dist / 20);
  const dir = {
    x: dx / len + (Math.random() - 0.5) * err,
    y: dy / len + (Math.random() - 0.5) * err,
    z: dz / len + (Math.random() - 0.5) * err,
  };
  const hits = fireShot(state, from, dir, 'pistol', shooter);
  const mz = muzzlePos(shooter.mesh);
  state.effects.muzzle(mz.x, mz.y, mz.z);
  for (const hit of hits) {
    state.effects.tracer(mz, hit);
    if (hit.target) {
      applyShotDamage(state, hit, 'pistol', shooter);
      if (hit.target === p) state.effects.blood(hit.x, hit.y, hit.z);
      else if (hit.part === 'car') state.effects.sparks(hit.x, hit.y, hit.z, 6);
    }
  }
  state.audio.shot();
}

function updateTaxi(state, dt) {
  const p = state.player;
  if (!state.taxiFare) {
    state.taxiTimer -= dt;
    if (state.taxiTimer <= 0 && p.car && p.car.model === 'taxi') {
      // A passenger hails a cab: pick a sidewalk spot near the player.
      const lines = roadLines();
      const l = state.rng.pick(lines);
      const along = p.z + state.rng.range(-60, 60);
      const hx = l + 10;
      const hz = Math.max(-250, Math.min(250, along));
      const places = Object.values(PLACES);
      const dest = state.rng.pick(places);
      const ped = spawnPed(state.scene, hx, hz, state.rng);
      ped.state = 'wait'; ped.waitTimer = 9999; ped.hailing = true;
      state.peds.push(ped);
      state.taxiFare = { ped, x: hx, z: hz, destX: dest.x, destZ: dest.z + 12, destName: dest.name, pickedUp: false, timer: 90 };
      state.events.push({ type: 'toast', text: 'A passenger is hailing a cab — yellow marker' });
    }
    return;
  }
  const fare = state.taxiFare;
  fare.timer -= dt;
  if (fare.timer <= 0) {
    fare.ped.hailing = false;
    fare.ped.state = 'walk';
    fare.ped.waitTimer = 0;
    state.taxiFare = null;
    state.taxiTimer = 20;
    return;
  }
  if (!fare.pickedUp) {
    if (Math.hypot(p.x - fare.x, p.z - fare.z) < 7 && p.car && Math.abs(p.car.speed) < 2) {
      fare.pickedUp = true;
      fare.ped.mesh.visible = false;
      fare.ped.dead = true;
      fare.timer = 120;
      state.events.push({ type: 'toast', text: `Passenger: "${fare.destName}, please!"` });
    }
  } else if (Math.hypot(p.x - fare.destX, p.z - fare.destZ) < 10 && p.car && Math.abs(p.car.speed) < 2) {
    const dist = Math.hypot(fare.destX - fare.x, fare.destZ - fare.z);
    const pay = Math.round(20 + dist * 0.9 + Math.max(0, fare.timer) * 0.5);
    state.cash += pay;
    state.stats.faresDone += 1;
    state.audio.cash();
    state.events.push({ type: 'toast', text: `Fare complete: +$${pay}` });
    state.taxiFare = null;
    state.taxiTimer = 15;
  }
}

function updatePackages(state) {
  const p = state.player;
  for (const pkg of state.packages) {
    if (pkg.taken) continue;
    pkg.mesh.rotation.y += 0.03;
    pkg.mesh.position.y = 1.4 + Math.sin(state.time * 2 + pkg.index) * 0.25;
    if (p.onFoot && Math.hypot(p.x - pkg.x, p.z - pkg.z) < 3) {
      pkg.taken = true;
      pkg.mesh.visible = false;
      state.save.packages.push(pkg.index);
      state.cash += 100;
      state.audio.pickup();
      const n = state.save.packages.length;
      state.events.push({ type: 'toast', text: `Hidden package ${n}/10: +$100` });
      if (n === 10) {
        state.cash += 500;
        state.events.push({ type: 'banner', title: 'ALL PACKAGES!', sub: 'Bonus +$500. Veloria holds no more secrets from you.' });
      }
    }
  }
}

function updateShops(state, actions) {
  const p = state.player;
  if (!p.onFoot) return null;
  // Gun shop: Q buys ammo, armor, or the shotgun.
  if (Math.hypot(p.x - PLACES.gunShop.x, p.z - PLACES.gunShop.z) < 16) {
    if (actions & ACTION_TALK) {
      if (!state.save.ownedWeapons.includes('shotgun') && state.cash >= 800) {
        state.cash -= 800;
        state.save.ownedWeapons.push('shotgun');
        p.ammo.shotgun = 24;
        state.events.push({ type: 'toast', text: 'Bought the Breacher 12 shotgun — $800' });
      } else if (state.cash >= 200 && p.armor < 50) {
        state.cash -= 200;
        p.armor = 100;
        state.events.push({ type: 'toast', text: 'Body armor fitted — $200' });
      } else if (state.cash >= 50) {
        state.cash -= 50;
        p.ammo.pistol += 48;
        if (state.save.ownedWeapons.includes('smg')) p.ammo.smg += 64;
        if (state.save.ownedWeapons.includes('shotgun')) p.ammo.shotgun += 12;
        state.events.push({ type: 'toast', text: 'Ammo restocked — $50' });
      } else {
        state.events.push({ type: 'toast', text: 'Not enough cash.' });
      }
      state.audio.cash();
    }
    return '<b>Q</b> Iron &amp; Oak — buy ammo $50 · armor $200 · shotgun $800';
  }
  // Diner: Q heals.
  if (Math.hypot(p.x - PLACES.diner.x, p.z - PLACES.diner.z) < 16) {
    if ((actions & ACTION_TALK) && state.cash >= 25) {
      state.cash -= 25;
      p.health = PLAYER.maxHealth;
      state.events.push({ type: 'toast', text: "Rosa's special: health restored — $25" });
    }
    return "<b>Q</b> Rosa's Diner — eat ($25, restores health)";
  }
  return null;
}

function processEvents(state) {
  for (const ev of state.events) {
    switch (ev.type) {
      case 'wantedUp':
        state.hud.toast(`Wanted level: ${'★'.repeat(ev.stars)} — ${ev.reason}`);
        break;
      case 'wantedDown':
        state.hud.toast(`Wanted level down: ${'★'.repeat(ev.stars)}`);
        break;
      case 'missionPass':
        state.hud.banner('MISSION PASSED', `${ev.title}  ·  +$${ev.reward}`);
        state.audio.missionPass();
        state.hud.announce(`Mission passed: ${ev.title}. Reward ${ev.reward} dollars.`);
        writeSave(state.save);
        break;
      case 'missionFail':
        state.hud.banner('MISSION FAILED', ev.reason, 4);
        state.audio.missionFail();
        break;
      case 'busted': {
        const fine = Math.floor(state.cash * 0.1);
        state.cash -= fine;
        clearWanted(state);
        if (state.mission) failMission(state, 'Busted by the VPD.');
        state.screen = 'end';
        state.endKind = 'busted';
        state.endTimer = 0;
        state.hud.showEnd('BUSTED', `The VPD took $${fine} in fines. Mara walks out of VPD Central...`, '#3a6fd8');
        state.audio.busted();
        break;
      }
      case 'wasted': {
        const bill = Math.floor(state.cash * 0.1);
        state.cash -= bill;
        clearWanted(state);
        if (state.mission) failMission(state, 'Mara was wasted.');
        state.screen = 'end';
        state.endKind = 'wasted';
        state.endTimer = 0;
        state.hud.showEnd('WASTED', `Veloria General patched Mara up. Medical bill: $${bill}.`, '#ff4d4d');
        state.audio.missionFail();
        break;
      }
      case 'carExploded': {
        const car = ev.car;
        state.effects.explosion(car.x, 1, car.z);
        state.audio.boom();
        state.effects.addShake(0.7);
        // Blast hurts nearby characters.
        const blast = (c, x, z) => {
          if (c.dead) return;
          const d = Math.hypot(c.x - x, c.z - z);
          if (d < 9) {
            c.health = (c.health ?? 100) - 90;
            if (c.health <= 0 && !c.dead) {
              c.dead = true;
              if (c.kind === 'goon') state.events.push({ type: 'goonDown', goon: c });
            }
          }
        };
        for (const ped of state.peds) blast(ped, car.x, car.z);
        for (const cop of state.cops) blast(cop, car.x, car.z);
        for (const goon of state.enemies) blast(goon, car.x, car.z);
        if (Math.hypot(state.player.x - car.x, state.player.z - car.z) < 9 && state.player.car !== car) {
          damagePlayer(state.player, 55, state);
        }
        if (state.player.car === car) {
          state.player.car = null;
          state.player.onFoot = true;
          state.player.mesh.visible = true;
        }
        car.mesh.visible = false;
        break;
      }
      case 'pedDown':
        addHeat(state, 1, 'pedestrian down');
        scarePeds(state.peds, ev.ped.x, ev.ped.z, 40);
        break;
      case 'copDown':
        addHeat(state, 2, 'officer down');
        break;
      case 'goonDown':
        onGoonDown(state);
        state.audio.pickup();
        break;
      case 'goonShoot':
        enemyShoot(state, ev.goon, ev.dist, 0.55);
        break;
      case 'copShoot':
        enemyShoot(state, ev.cop, Math.hypot(ev.cop.x - state.player.x, ev.cop.z - state.player.z), 0.6);
        break;
      case 'rammed':
        state.effects.addShake(0.35);
        state.audio.crash();
        break;
      case 'resprayed':
        state.hud.toast('Respray complete — the heat is off, car repaired.');
        state.audio.cash();
        break;
      case 'toast':
        state.hud.toast(ev.text);
        break;
      case 'banner':
        state.hud.banner(ev.title, ev.sub);
        break;
      case 'objective':
        state.hud.announce(`Objective: ${ev.text}`);
        break;
      default:
        break;
    }
  }
  state.events.length = 0;
}

export function respawnPlayer(state) {
  const p = state.player;
  const place = state.endKind === 'busted' ? PLACES.policeStation : PLACES.hospital;
  if (p.car) { p.car.role = 'parked'; p.car = null; }
  p.onFoot = true;
  p.mesh.visible = true;
  p.x = place.x; p.z = place.z + 14;
  p.y = 0.3; p.vy = 0;
  p.health = PLAYER.maxHealth;
  p.armor = 0;
  p.heading = Math.PI;
  p.mesh.position.set(p.x, p.y, p.z);
  syncPlayerMesh(p);
  for (const car of state.cars) if (car.role === 'police') car.remove = true;
  for (const cop of state.cops) cop.remove = true;
  state.screen = 'play';
}

export function updateWorld(state, dt, input, camera, actions = 0) {
  state.time += dt;
  state.city.update(dt, state.time);
  state.effects.update(dt, state.time);
  state.gunHeatTimer = Math.max(0, state.gunHeatTimer - dt);
  state.shootCooldown = Math.max(0, state.shootCooldown - dt);
  if (state.shootCooldown <= 0) state.player.aiming = false;

  // Camera orbit from the mouse.
  const look = input.takeLook();
  state.cameraYaw -= look.x * 0.0028;
  state.cameraPitch = Math.max(-0.12, Math.min(1.0, state.cameraPitch + look.y * 0.0022));

  const p = state.player;

  if (state.screen === 'play') {
    // Weapon switching.
    const slot = input.weaponSlot();
    if (slot === 0) p.weapon = 'fists';
    if (slot === 1) p.weapon = 'pistol';
    if (slot === 2) {
      if (state.save.ownedWeapons.includes('smg')) p.weapon = p.weapon === 'smg' && state.save.ownedWeapons.includes('shotgun') ? 'shotgun' : 'smg';
      else if (state.save.ownedWeapons.includes('shotgun')) p.weapon = 'shotgun';
    }
    state.playerArmed = p.weapon !== 'fists';
    if (p.reloadTimer > 0) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) finishReload(state);
    }
    if (actions & ACTION_RELOAD) startReload(state);

    if (p.onFoot) {
      updatePlayerOnFoot(p, dt, input, state, state.cameraYaw);
      if (actions & ACTION_ENTER) {
        const car = nearestCar(state, p.x, p.z, 4.2);
        if (car) enterCar(state, car);
      }
      if (actions & ACTION_PUNCH) punch(state);
      if (input.isFiring()) playerShoot(state, camera);
      // Aim heading follows the camera.
      p.aimHeading = state.cameraYaw + Math.PI;
    } else if (p.car) {
      const skidding = updatePlayerCar(p.car, dt, input, state);
      p.x = p.car.x; p.z = p.car.z;
      p.heading = p.car.heading;
      state.stats.distanceKm += Math.abs(p.car.speed) * dt / 1000;
      if (skidding && Math.random() < 0.5) {
        state.effects.smoke(p.car.x - Math.sin(p.car.heading) * 2, 0.4, p.car.z - Math.cos(p.car.heading) * 2, 2);
        if (Math.random() < 0.1) state.audio.skid();
      }
      if (actions & ACTION_ENTER) exitCar(state);
      if (input.isFiring() && state.shootCooldown <= 0) {
        state.audio.horn();
        state.shootCooldown = 0.4;
      }
      // Ease the camera behind the car.
      const behind = p.car.heading + Math.PI;
      let diff = behind - state.cameraYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(look.x) < 1) state.cameraYaw += diff * Math.min(1, dt * 1.4);
    }

    // Mission start prompt.
    let prompt = updateShops(state, actions);
    if (!prompt && missionStartAvailable(state)) {
      if (actions & ACTION_TALK) {
        startMission(state, state.save.missionIndex);
        state.hud.banner(state.mission.def.title.toUpperCase(), `A job from ${state.mission.def.giver}`);
      } else {
        prompt = `<b>Q</b> Start mission: ${nextMissionTitle(state)}`;
      }
    }
    if (!prompt && p.onFoot) {
      const car = nearestCar(state, p.x, p.z, 4.2);
      if (car) prompt = `<b>E</b> ${car.role === 'parked' || car.role === 'traffic' ? 'Steal' : 'Enter'} the ${MODELS[car.model].name}`;
    }
    if (!prompt && p.car && Math.abs(p.car.speed) < 3) prompt = '<b>E</b> Exit car · <b>Click</b> horn';
    if (!prompt && state.wanted > 0) prompt = 'Lose the cops: break line of sight, or visit Sunshine Respray ($250)';
    state.promptText = prompt ?? null;

    updateMissions(state, dt);
    updateTaxi(state, dt);
    updatePackages(state);
  }

  // Cars.
  for (const car of state.cars) {
    if (car.dead) continue;
    if (car.role === 'traffic') updateTrafficCar(car, dt, state, state.rng);
    if (car.role !== 'player') {
      collideCarWithCity(car, state.colliders, (a, b, rel) => {
        if (rel > 8) {
          state.effects.sparks(a.x, 1, a.z, 6);
          if (Math.hypot(a.x - p.x, a.z - p.z) < 30) state.audio.crash();
        }
      });
    }
    if (car.damage > 70 && Math.random() < 0.1) state.effects.smoke(car.x, 1.2, car.z, 1);
    if (car.damage > 120 && !car.dead) {
      car.dead = true;
      state.events.push({ type: 'carExploded', car });
    }
    syncCarMesh(car, dt, state.time);
  }
  if (p.car) {
    collideCarWithCity(p.car, state.colliders, (a, b, rel) => {
      state.effects.sparks(a.x, 1, a.z, 10);
      state.effects.addShake(Math.min(0.5, rel * 0.02));
      state.audio.crash();
      if (rel > 10) damagePlayer(p, rel * 0.4, state);
    });
    syncCarMesh(p.car, dt, state.time);
  }
  resolveCarCollisions(state.cars, (a, b, rel) => {
    state.effects.sparks((a.x + b.x) / 2, 1, (a.z + b.z) / 2, 8);
    if (Math.hypot(a.x - p.x, a.z - p.z) < 35) {
      state.effects.addShake(Math.min(0.4, rel * 0.02));
      state.audio.crash();
    }
  });

  // Cars running over pedestrians.
  for (const car of state.cars) {
    if (car.dead || Math.abs(car.speed) < 5) continue;
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.4) {
        killPed(ped);
        state.events.push({ type: 'pedDown', ped });
        state.effects.blood(ped.x, 1, ped.z);
        if (car.role === 'player') state.effects.addShake(0.3);
      }
    }
  }

  // Peds, police, goons.
  for (const ped of state.peds) updatePed(ped, dt, state, state.rng);
  updatePolice(state, dt, state.scene, state.rng);
  for (const goon of state.enemies) updateGoon(goon, dt, state, state.rng);

  // Cleanup: remove flagged entities and respawn ambient life near the player.
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    const car = state.cars[i];
    if (car.remove || (car.role === 'traffic' && Math.hypot(car.x - p.x, car.z - p.z) > 320)) {
      state.scene.remove(car.mesh);
      state.cars.splice(i, 1);
    }
  }
  for (let i = state.cops.length - 1; i >= 0; i -= 1) {
    if (state.cops[i].remove) { state.scene.remove(state.cops[i].mesh); state.cops.splice(i, 1); }
  }
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const g = state.enemies[i];
    if (g.dead && g.fallTimer > 8) { state.scene.remove(g.mesh); state.enemies.splice(i, 1); }
  }
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    if (ped.dead && ped.fallTimer > 8) { state.scene.remove(ped.mesh); state.peds.splice(i, 1); }
  }
  while (state.peds.filter((x) => !x.dead).length < 30) {
    const l = state.rng.pick(roadLines());
    const along = p.z + state.rng.range(-120, 120);
    state.peds.push(spawnPed(state.scene, l + 10, Math.max(-250, Math.min(250, along)), state.rng));
  }
  while (state.cars.filter((c) => c.role === 'traffic').length < 12) {
    const l = state.rng.pick(roadLines());
    const along = p.z + state.rng.range(-150, 150);
    const car = spawnCar(state.scene, state.rng.pick(['sedan', 'coupe', 'van', 'taxi']), l + 4, Math.max(-240, Math.min(240, along)), 0, 'traffic', state.rng);
    car.speed = 12;
    state.cars.push(car);
  }

  // Objective beacon.
  const obj = state.mission ? currentObjective(state) : null;
  if (obj && (obj.kind === 'goto' || obj.kind === 'deliver' || obj.kind === 'timed' || obj.kind === 'drive' || obj.kind === 'steal' || obj.kind === 'chase')) {
    state.effects.setBeacon(obj.x, obj.z, true);
  } else if (state.taxiFare) {
    state.effects.setBeacon(state.taxiFare.pickedUp ? state.taxiFare.destX : state.taxiFare.x, state.taxiFare.pickedUp ? state.taxiFare.destZ : state.taxiFare.z, true, 0xf2c21d);
  } else if (!state.mission && state.save.missionIndex < 6) {
    state.effects.setBeacon(PLACES.garage.x, PLACES.garage.z + 12, true);
  } else {
    state.effects.setBeacon(0, 0, false);
  }

  // Audio + autosave.
  const driving = !!p.car;
  state.audio.update(dt, driving, driving ? Math.abs(p.car.speed) / 40 : 0, state.wanted);
  state.saveTimer += dt;
  if (state.saveTimer > 15) {
    state.saveTimer = 0;
    state.save.cash = Math.floor(state.cash);
    writeSave(state.save);
  }

  processEvents(state);
  void STEP;
}
