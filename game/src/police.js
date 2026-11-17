// The wanted system: stars, police interceptors that chase and ram, foot cops
// that close in and bust, evasion when the player breaks line of sight, and
// the respray shop that clears the heat for cash.
import { WANTED, PLACES } from './config.js';
import { spawnCar, MODELS } from './vehicles.js';
import { buildPersonMesh, syncPedMesh } from './pedestrians.js';

export function addHeat(state, stars, reason) {
  const before = state.wanted;
  state.wanted = Math.min(WANTED.max, state.wanted + stars);
  state.unseenTimer = 0;
  if (state.wanted > before) {
    state.events.push({ type: 'wantedUp', stars: state.wanted, reason });
  }
}

export function clearWanted(state) {
  if (state.wanted > 0) state.stats.copsEvaded += 1;
  state.wanted = 0;
  state.unseenTimer = 0;
  for (const cop of state.cops) cop.leaving = true;
  for (const car of state.cars) {
    if (car.role === 'police') car.leaving = true;
  }
}

export function spawnPoliceCar(state, scene, rng) {
  // Spawn on a road ahead of the player's travel direction, off-screen.
  const p = state.player;
  const angle = rng.range(0, Math.PI * 2);
  const dist = 70 + rng.range(0, 30);
  let x = p.x + Math.sin(angle) * dist;
  let z = p.z + Math.cos(angle) * dist;
  x = Math.max(-260, Math.min(260, x));
  z = Math.max(-260, Math.min(260, z));
  const car = spawnCar(scene, 'police', x, z, Math.atan2(p.x - x, p.z - z), 'police', rng);
  state.cars.push(car);
  return car;
}

export function spawnFootCop(state, scene, rng) {
  const p = state.player;
  const angle = rng.range(0, Math.PI * 2);
  const x = p.x + Math.sin(angle) * 26;
  const z = p.z + Math.cos(angle) * 26;
  const mesh = buildPersonMesh(rng, '#2d4a7a');
  mesh.position.set(x, 0.3, z);
  scene.add(mesh);
  const cop = {
    kind: 'cop', mesh, x, z, heading: 0, speed: 0, walkPhase: 0,
    health: 100, dead: false, fallTimer: 0, bustTimer: 0, leaving: false,
    shootTimer: rng.range(0.5, 1.5),
  };
  state.cops.push(cop);
  return cop;
}

function updatePoliceCar(car, dt, state) {
  const p = state.player;
  const target = p.car ?? p;
  const tx = target.x ?? target.x;
  const tz = target.z ?? target.z;
  const dx = tx - car.x;
  const dz = tz - car.z;
  const dist = Math.hypot(dx, dz);
  if (car.leaving) {
    car.speed += (16 - car.speed) * Math.min(1, dt);
    car.heading += 0.4 * dt;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    if (dist > 120) car.remove = true;
    return;
  }
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const m = MODELS.police;
  car.steer += (Math.max(-1, Math.min(1, diff * 2.4)) - car.steer) * Math.min(1, dt * 5);
  const desired = dist > 26 ? m.topSpeed : dist > 8 ? 22 : 10;
  car.speed += (desired - car.speed) * Math.min(1, dt * 1.8);
  car.heading += car.steer * (car.speed / m.len) * 0.9 * dt * 0.32 * 3.2;
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  // Ram: hitting the player's car hard slows them both.
  if (dist < 4.6 && Math.abs(car.speed) > 6) {
    car.speed *= 0.55;
    if (p.car) p.car.speed *= 0.6;
    state.events.push({ type: 'rammed' });
  }
}

function updateFootCop(cop, dt, state, rng) {
  if (cop.dead) {
    cop.fallTimer += dt;
    cop.mesh.rotation.x = Math.min(Math.PI / 2, cop.fallTimer * 4);
    return;
  }
  const p = state.player;
  const dx = p.x - cop.x;
  const dz = p.z - cop.z;
  const dist = Math.hypot(dx, dz);
  if (cop.leaving) {
    cop.heading += dt * 2;
    cop.speed = 3;
    cop.x += Math.sin(cop.heading) * cop.speed * dt;
    cop.z += Math.cos(cop.heading) * cop.speed * dt;
    if (dist > 90) cop.remove = true;
    syncPedMesh(cop);
    return;
  }
  const want = Math.atan2(dx, dz);
  let diff = want - cop.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  cop.heading += Math.max(-4 * dt, Math.min(4 * dt, diff));
  cop.speed = dist > 3 ? 6.5 : 0;
  cop.x += Math.sin(cop.heading) * cop.speed * dt;
  cop.z += Math.cos(cop.heading) * cop.speed * dt;
  cop.walkPhase += dt * cop.speed * 1.7;
  // Bust: stay close to a slow on-foot player.
  if (p.onFoot && dist < 3.2 && Math.abs(p.speed) < 2) {
    cop.bustTimer += dt;
    if (cop.bustTimer > WANTED.bustTime) state.events.push({ type: 'busted' });
  } else {
    cop.bustTimer = Math.max(0, cop.bustTimer - dt * 2);
  }
  // Cops shoot when the player is armed and wanted 3+.
  if (state.wanted >= 3 && state.playerArmed && dist < 40 && dist > 6) {
    cop.shootTimer -= dt;
    if (cop.shootTimer <= 0) {
      cop.shootTimer = rng.range(0.7, 1.6);
      state.events.push({ type: 'copShoot', cop });
    }
  }
  syncPedMesh(cop);
}

export function updatePolice(state, dt, scene, rng) {
  const p = state.player;
  // Desired force scales with the wanted level.
  const wantCars = state.wanted === 0 ? 0 : state.wanted <= 2 ? 1 : state.wanted <= 4 ? 2 : 3;
  const wantCops = state.wanted === 0 ? 0 : p.onFoot ? Math.min(4, state.wanted + 1) : 0;
  const liveCars = state.cars.filter((c) => c.role === 'police' && !c.leaving && !c.dead).length;
  const liveCops = state.cops.filter((c) => !c.leaving && !c.dead).length;
  if (liveCars < wantCars && state.spawnTimer <= 0) {
    spawnPoliceCar(state, scene, rng);
    state.spawnTimer = 2.5;
  }
  if (liveCops < wantCops && state.spawnTimer <= 0) {
    spawnFootCop(state, scene, rng);
    state.spawnTimer = 1.5;
  }
  state.spawnTimer -= dt;
  for (const car of state.cars) if (car.role === 'police') updatePoliceCar(car, dt, state);
  for (const cop of state.cops) updateFootCop(cop, dt, state, rng);

  // Evasion: no cop or police car can see the player.
  let seen = false;
  if (state.wanted > 0) {
    for (const car of state.cars) {
      if (car.role === 'police' && !car.leaving && Math.hypot(car.x - p.x, car.z - p.z) < WANTED.evadeRadius) { seen = true; break; }
    }
    if (!seen) for (const cop of state.cops) {
      if (!cop.leaving && !cop.dead && Math.hypot(cop.x - p.x, cop.z - p.z) < WANTED.evadeRadius) { seen = true; break; }
    }
  }
  if (state.wanted > 0 && !seen) {
    state.unseenTimer += dt;
    if (state.unseenTimer > WANTED.decayDelay + WANTED.decayTime) {
      state.wanted -= 1;
      state.unseenTimer = WANTED.decayDelay;
      if (state.wanted === 0) clearWanted(state);
      else state.events.push({ type: 'wantedDown', stars: state.wanted });
    }
  } else {
    state.unseenTimer = 0;
  }

  // Respray: drive into the garage bay to clear the heat for cash.
  if (p.car && state.wanted > 0 && Math.hypot(p.x - PLACES.respray.x, p.z - PLACES.respray.z) < 14 && Math.abs(p.car.speed) < 2) {
    if (state.cash >= WANTED.resprayCost) {
      state.cash -= WANTED.resprayCost;
      clearWanted(state);
      p.car.damage = 0;
      state.events.push({ type: 'resprayed' });
    }
  }
}
