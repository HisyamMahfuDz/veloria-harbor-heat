// Harbor Syndicate goons: mission enemies who hold ground, strafe and shoot
// at Mara with deliberately imperfect aim.
import { buildPersonMesh, syncPedMesh } from './pedestrians.js';

export function spawnGoon(state, scene, rng, x, z, opts = {}) {
  const mesh = buildPersonMesh(rng, opts.shirt ?? '#3a3a3a');
  mesh.position.set(x, 0.3, z);
  scene.add(mesh);
  const goon = {
    kind: 'goon', mesh, x, z, heading: Math.atan2(state.player.x - x, state.player.z - z),
    speed: 0, walkPhase: 0, health: opts.health ?? 70, dead: false, fallTimer: 0,
    homeX: x, homeZ: z, shootTimer: rng.range(0.4, 1.4), strafeDir: rng.chance(0.5) ? 1 : -1,
    strafeTimer: rng.range(1, 3), aggressive: opts.aggressive ?? false,
  };
  state.enemies.push(goon);
  return goon;
}

export function updateGoon(goon, dt, state, rng) {
  if (goon.dead) {
    goon.fallTimer += dt;
    goon.mesh.rotation.x = Math.min(Math.PI / 2, goon.fallTimer * 4);
    return;
  }
  const p = state.player;
  const dx = p.x - goon.x;
  const dz = p.z - goon.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  let diff = want - goon.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  goon.heading += Math.max(-4 * dt, Math.min(4 * dt, diff));
  // Strafe sideways, or close in when aggressive; never wander far from home.
  goon.strafeTimer -= dt;
  if (goon.strafeTimer <= 0) { goon.strafeDir *= -1; goon.strafeTimer = rng.range(1, 3); }
  const homeDist = Math.hypot(goon.x - goon.homeX, goon.z - goon.homeZ);
  let mx = 0; let mz = 0;
  if (goon.aggressive && dist > 14) { mx = dx / dist; mz = dz / dist; }
  else if (homeDist < 10) { mx = Math.cos(goon.heading) * goon.strafeDir; mz = -Math.sin(goon.heading) * goon.strafeDir; }
  else { mx = (goon.homeX - goon.x) / homeDist; mz = (goon.homeZ - goon.z) / homeDist; }
  const spd = 2.6;
  goon.x += mx * spd * dt;
  goon.z += mz * spd * dt;
  goon.speed = spd;
  goon.walkPhase += dt * spd * 1.7;
  // Shoot with a delay and a miss chance baked into the aim error.
  goon.shootTimer -= dt;
  if (goon.shootTimer <= 0 && dist < 55) {
    goon.shootTimer = rng.range(0.8, 1.8);
    state.events.push({ type: 'goonShoot', goon, dist });
  }
  syncPedMesh(goon);
  // Aim the arm at the player.
  goon.mesh.userData.armR.rotation.x = -1.35;
}
