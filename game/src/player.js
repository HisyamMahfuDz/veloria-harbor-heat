// Mara Quinn on foot: camera-relative movement, sprint, jump, punch and the
// enter/exit-car handoff. The mesh is a distinct red-jacket figure.
import * as THREE from 'three';
import { PLAYER, WORLD } from './config.js';
import { collideCircle } from './city.js';
import { buildPersonMesh } from './pedestrians.js';

export function createPlayer(scene, rng, x, z) {
  const mesh = buildPersonMesh(rng, '#c22e2e');
  mesh.position.set(x, 0.3, z);
  // A cap so Mara reads at a glance.
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.16, 10), new THREE.MeshLambertMaterial({ color: '#222831' }));
  cap.position.y = 2.06;
  mesh.add(cap);
  scene.add(mesh);
  return {
    mesh, x, z, y: 0.3, vy: 0,
    heading: Math.PI, speed: 0, walkPhase: 0,
    health: PLAYER.maxHealth, armor: 0,
    onFoot: true, car: null,
    punchTimer: 0, hurtTimer: 0,
    weapon: 'pistol',
    ammo: { pistol: 96, smg: 0, shotgun: 0 },
    mag: { pistol: 12, smg: 32, shotgun: 6 },
    reloadTimer: 0,
    aimHeading: Math.PI,
  };
}

export function updatePlayerOnFoot(player, dt, input, state, cameraYaw) {
  const axis = input.axis();
  const sprint = input.sprint();
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  // Camera-relative: forward is away from the camera. The camera sits at
  // player + (sin yaw, cos yaw) * distance, so forward is (-sin yaw, -cos yaw)
  // and right is (cos yaw, -sin yaw).
  const sin = Math.sin(cameraYaw);
  const cos = Math.cos(cameraYaw);
  const mx = axis.x * cos + axis.z * sin;
  const mz = axis.z * cos - axis.x * sin;
  const moving = Math.hypot(mx, mz) > 0.1;
  if (moving) {
    const want = Math.atan2(mx, mz);
    let diff = want - player.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.heading += Math.max(-10 * dt, Math.min(10 * dt, diff));
    player.speed += (speed - player.speed) * Math.min(1, dt * 8);
    player.x += Math.sin(player.heading) * player.speed * dt;
    player.z += Math.cos(player.heading) * player.speed * dt;
  } else {
    player.speed += (0 - player.speed) * Math.min(1, dt * 10);
  }
  // Gravity + jump.
  if (input.jump() && player.y <= 0.31) player.vy = PLAYER.jumpSpeed;
  player.vy -= 26 * dt;
  player.y += player.vy * dt;
  if (player.y < 0.3) { player.y = 0.3; player.vy = 0; }
  const pos = { x: player.x, z: player.z };
  collideCircle(state.colliders, pos, PLAYER.radius);
  player.x = pos.x; player.z = pos.z;
  player.x = Math.max(-WORLD.half, Math.min(WORLD.half, player.x));
  player.z = Math.max(-WORLD.half, Math.min(WORLD.beachZ + 8, player.z));
  player.walkPhase += dt * player.speed * 1.7;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
  syncPlayerMesh(player);
}

export function syncPlayerMesh(player) {
  const u = player.mesh.userData;
  player.mesh.position.set(player.x, player.y, player.z);
  player.mesh.rotation.y = player.heading;
  const swing = Math.sin(player.walkPhase) * (player.speed > 0.1 ? 0.6 : 0.05);
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  if (player.punchTimer > 0.2) {
    u.armR.rotation.x = -2.2;
    u.armL.rotation.x = 0.3;
  } else {
    u.armL.rotation.x = -swing * 0.7;
    u.armR.rotation.x = swing * 0.7;
  }
  // Aiming: face the camera direction when firing.
  if (player.aiming) {
    player.mesh.rotation.y = player.aimHeading;
    u.armR.rotation.x = -1.35;
    u.armL.rotation.x = -1.1;
  }
}

export function damagePlayer(player, amount, state) {
  if (player.hurtTimer > 0 && amount < 20) return;
  let rest = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, rest * 0.6);
    player.armor -= absorbed;
    rest -= absorbed;
  }
  player.health -= rest;
  player.hurtTimer = 0.25;
  if (player.health <= 0) {
    player.health = 0;
    state.events.push({ type: 'wasted' });
  }
}
