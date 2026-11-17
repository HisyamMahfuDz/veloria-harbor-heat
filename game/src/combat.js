// Hitscan combat: one firing path for the player, the cops and the goons.
// Ray vs spheres (characters) and ray vs building AABBs (the city).
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { rayBuildings } from './city.js';

export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox; const ly = cy - oy; const lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return Infinity;
  return tca - Math.sqrt(r * r - d2);
}

/**
 * Fire one hitscan shot. Returns one hit per pellet: {hit, x, y, z, target,
 * part} where target is a ped, cop, goon or car, or null for a wall/ground hit.
 */
export function fireShot(state, origin, dir, weaponKey, shooter) {
  const w = WEAPONS[weaponKey];
  const pellets = w.pellets ?? 1;
  const hits = [];
  for (let p = 0; p < pellets; p += 1) {
    const spread = w.spread;
    const d = {
      x: dir.x + (Math.random() - 0.5) * 2 * spread,
      y: dir.y + (Math.random() - 0.5) * 2 * spread,
      z: dir.z + (Math.random() - 0.5) * 2 * spread,
    };
    const len = Math.hypot(d.x, d.y, d.z) || 1;
    d.x /= len; d.y /= len; d.z /= len;
    let bestDist = w.range;
    let target = null;
    let part = 'body';
    const wall = rayBuildings(state.colliders, origin.x, origin.y, origin.z, d.x, d.y, d.z, w.range);
    if (wall < bestDist) bestDist = wall;
    // Ground plane.
    if (d.y < -0.001) {
      const t = -origin.y / d.y;
      if (t > 0 && t < bestDist) bestDist = t;
    }
    const testChar = (c, x, y, z, radius, kind) => {
      if (c === shooter || c.dead) return;
      const tHead = raySphere(origin.x, origin.y, origin.z, d.x, d.y, d.z, x, y + 1.86, z, 0.34);
      if (tHead < bestDist) { bestDist = tHead; target = c; part = 'head'; }
      const tBody = raySphere(origin.x, origin.y, origin.z, d.x, d.y, d.z, x, y + 1.1, z, radius);
      if (tBody < bestDist) { bestDist = tBody; target = c; part = 'body'; }
      void kind;
    };
    for (const ped of state.peds) testChar(ped, ped.x, 0.3, ped.z, 0.55, 'ped');
    for (const cop of state.cops) testChar(cop, cop.x, 0.3, cop.z, 0.55, 'cop');
    for (const goon of state.enemies) testChar(goon, goon.x, 0.3, goon.z, 0.55, 'goon');
    if (shooter !== state.player) {
      const pl = state.player;
      testChar(pl, pl.x, pl.y, pl.z, 0.55, 'player');
    }
    // Cars: a fat sphere at the centre.
    for (const car of state.cars) {
      if (car.dead) continue;
      const t = raySphere(origin.x, origin.y, origin.z, d.x, d.y, d.z, car.x, 1, car.z, 2.4);
      if (t < bestDist) { bestDist = t; target = car; part = 'car'; }
    }
    const hit = {
      x: origin.x + d.x * bestDist,
      y: origin.y + d.y * bestDist,
      z: origin.z + d.z * bestDist,
      target, part, dist: bestDist,
    };
    hits.push(hit);
  }
  return hits;
}

export function applyShotDamage(state, hit, weaponKey, shooter) {
  if (!hit || !hit.target) return;
  const w = WEAPONS[weaponKey];
  let dmg = w.damage * (hit.part === 'head' ? 2.5 : 1);
  const t = hit.target;
  if (t === state.player) {
    state.damagePlayer(dmg);
    return;
  }
  if (t.model) { // a car
    t.damage += dmg;
    if (t.damage > 120 && !t.dead) {
      t.dead = true;
      state.events.push({ type: 'carExploded', car: t });
    }
    return;
  }
  t.health = (t.health ?? 100) - dmg;
  if (t.health <= 0 && !t.dead) {
    t.dead = true;
    if (t.kind === 'goon') state.events.push({ type: 'goonDown', goon: t });
    else if (t.kind === 'cop') state.events.push({ type: 'copDown', cop: t });
    else state.events.push({ type: 'pedDown', ped: t });
  }
}

/** Muzzle position for a character, in world space. */
export function muzzlePos(mesh) {
  const v = new THREE.Vector3(0.3, 1.45, 0.6);
  return mesh.localToWorld(v);
}
