// Pedestrians: procedural people who stroll the sidewalks, chat in pairs and
// flee gunfire, speeding cars and police chases.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { roadLines, collideCircle } from './city.js';

const SKIN = ['#f2c89a', '#c98d5e', '#8a5a35', '#f0d0b0', '#6a3f22'];
const SHIRTS = ['#c23b2e', '#2e5dc2', '#e8a81d', '#3a7a4a', '#7a4a8f', '#e8e8e8', '#222831', '#ff7a5a'];
const PANTS = ['#2e3a5a', '#4a4a4a', '#7a6a4a', '#2e5a3a'];

const bodyGeo = new THREE.BoxGeometry(0.62, 0.85, 0.36);
const headGeo = new THREE.SphereGeometry(0.26, 10, 8);
const legGeo = new THREE.BoxGeometry(0.24, 0.8, 0.26);
legGeo.translate(0, -0.4, 0); // pivot at the hip
const armGeo = new THREE.BoxGeometry(0.18, 0.75, 0.2);
armGeo.translate(0, -0.32, 0); // pivot at the shoulder

export function buildPersonMesh(rng, shirtColor) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: rng.pick(SKIN) });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor ?? rng.pick(SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: rng.pick(PANTS) });
  const body = new THREE.Mesh(bodyGeo, shirt);
  body.position.y = 1.22;
  const head = new THREE.Mesh(headGeo, skin);
  head.position.y = 1.86;
  const legL = new THREE.Mesh(legGeo, pants); legL.position.set(-0.16, 0.8, 0);
  const legR = new THREE.Mesh(legGeo, pants); legR.position.set(0.16, 0.8, 0);
  const armL = new THREE.Mesh(armGeo, shirt); armL.position.set(-0.42, 1.55, 0);
  const armR = new THREE.Mesh(armGeo, shirt); armR.position.set(0.42, 1.55, 0);
  g.add(body, head, legL, legR, armL, armR);
  g.userData = { legL, legR, armL, armR, head, body };
  return g;
}

let nextPedId = 1;

export function spawnPed(scene, x, z, rng) {
  const mesh = buildPersonMesh(rng);
  mesh.position.set(x, 0.3, z);
  scene.add(mesh);
  const ped = {
    id: nextPedId, mesh, x, z, heading: rng.range(0, Math.PI * 2),
    speed: 0, walkPhase: rng.range(0, 6), state: 'walk',
    targetX: x, targetZ: z, waitTimer: rng.range(0, 4),
    scared: 0, dead: false, fallTimer: 0, hailing: false,
  };
  nextPedId += 1;
  pickSidewalkTarget(ped, rng);
  return ped;
}

function pickSidewalkTarget(ped, rng) {
  // Walk to a point on a sidewalk edge: offset from a road line.
  const lines = roadLines();
  const vertical = rng.chance(0.5);
  if (vertical) {
    const l = rng.pick(lines);
    ped.targetX = l + (rng.chance(0.5) ? 10 : -10);
    ped.targetZ = rng.range(-WORLD.half, WORLD.half);
  } else {
    const l = rng.pick(lines);
    ped.targetX = rng.range(-WORLD.half, WORLD.half);
    ped.targetZ = l + (rng.chance(0.5) ? 10 : -10);
  }
}

export function scarePeds(peds, x, z, radius) {
  for (const p of peds) {
    if (p.dead) continue;
    if (Math.hypot(p.x - x, p.z - z) < radius) {
      p.scared = 4 + Math.random() * 3;
      p.state = 'flee';
    }
  }
}

export function updatePed(ped, dt, state, rng) {
  if (ped.dead) {
    ped.fallTimer += dt;
    ped.mesh.rotation.x = Math.min(Math.PI / 2, ped.fallTimer * 4);
    ped.mesh.position.y = 0.3 + Math.min(0.3, ped.fallTimer * 0.4);
    return;
  }
  if (ped.scared > 0) {
    ped.scared -= dt;
    ped.state = 'flee';
    // Run away from the threat (the player).
    const dx = ped.x - state.player.x;
    const dz = ped.z - state.player.z;
    const d = Math.hypot(dx, dz) || 1;
    const want = Math.atan2(dx, dz);
    ped.heading += (want - ped.heading) * Math.min(1, dt * 5);
    ped.speed = 7;
    ped.x += Math.sin(ped.heading) * ped.speed * dt;
    ped.z += Math.cos(ped.heading) * ped.speed * dt;
    if (ped.scared <= 0) { ped.state = 'walk'; pickSidewalkTarget(ped, rng); }
  } else if (ped.state === 'wait') {
    ped.waitTimer -= dt;
    ped.speed = 0;
    if (ped.waitTimer <= 0) { ped.state = 'walk'; pickSidewalkTarget(ped, rng); }
  } else {
    const dx = ped.targetX - ped.x;
    const dz = ped.targetZ - ped.z;
    const d = Math.hypot(dx, dz);
    if (d < 3) {
      ped.state = 'wait';
      ped.waitTimer = rng.range(1, 6);
      ped.speed = 0;
    } else {
      const want = Math.atan2(dx, dz);
      let diff = want - ped.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      ped.speed = 2.2;
      ped.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.z += Math.cos(ped.heading) * ped.speed * dt;
    }
  }
  const pos = { x: ped.x, z: ped.z };
  collideCircle(state.colliders, pos, 0.6);
  ped.x = pos.x; ped.z = pos.z;
  ped.x = Math.max(-WORLD.half, Math.min(WORLD.half, ped.x));
  ped.z = Math.max(-WORLD.half, Math.min(WORLD.beachZ + 4, ped.z));
  ped.walkPhase += dt * ped.speed * 1.6;
  syncPedMesh(ped);
}

export function syncPedMesh(ped) {
  const u = ped.mesh.userData;
  ped.mesh.position.set(ped.x, ped.mesh.position.y, ped.z);
  ped.mesh.rotation.y = ped.heading;
  const swing = Math.sin(ped.walkPhase) * (ped.speed > 0.1 ? 0.55 : 0.05);
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.7;
  u.armR.rotation.x = swing * 0.7;
  if (ped.hailing) u.armR.rotation.z = -2.6;
}

export function killPed(ped) {
  ped.dead = true;
  ped.fallTimer = 0;
  ped.speed = 0;
}
