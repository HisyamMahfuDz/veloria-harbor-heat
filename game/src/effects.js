// Particles, tracers, muzzle flashes, objective beacons and camera shake.
// One pooled THREE.Points cloud for smoke/sparks, one for tracers.
import * as THREE from 'three';
import { particleTexture } from './textures.js';

const MAX_PARTICLES = 600;

export function createEffects(scene) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX_PARTICLES * 3);
  const col = new Float32Array(MAX_PARTICLES * 3);
  const size = new Float32Array(MAX_PARTICLES);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.PointsMaterial({
    size: 1, vertexColors: true, map: particleTexture(), transparent: true,
    depthWrite: false, sizeAttenuation: true, opacity: 0.9,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) parts.push({ life: 0, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, s: 1, max: 1 });
  let cursor = 0;

  const tracerGeo = new THREE.BufferGeometry();
  const tracerPos = new Float32Array(64 * 6);
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3));
  const tracers = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  tracers.frustumCulled = false;
  scene.add(tracers);
  const tracerLife = new Float32Array(64);
  let tracerCursor = 0;

  // Objective beacon: a tall glowing cylinder + a bouncing diamond.
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), new THREE.MeshBasicMaterial({ color: 0xffb02e }));
  diamond.position.y = 7;
  beacon.add(beam, diamond);
  beacon.visible = false;
  scene.add(beacon);

  let shake = 0;

  function spawn(x, y, z, vx, vy, vz, life, r, g, b, s) {
    const p = parts[cursor];
    cursor = (cursor + 1) % MAX_PARTICLES;
    p.life = life; p.max = life;
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.r = r; p.g = g; p.b = b; p.s = s;
  }

  return {
    beacon,
    addShake(amount) { shake = Math.min(1.2, shake + amount); },
    getShake() { return shake; },
    burst(x, y, z, n, color, speed, life, sizeMul = 1) {
      const c = new THREE.Color(color);
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const e = Math.random() * Math.PI - Math.PI / 2;
        const sp = speed * (0.4 + Math.random() * 0.8);
        spawn(x, y, z, Math.cos(a) * Math.cos(e) * sp, Math.abs(Math.sin(e)) * sp + 1, Math.sin(a) * Math.cos(e) * sp,
          life * (0.6 + Math.random() * 0.6), c.r, c.g, c.b, sizeMul * (0.6 + Math.random() * 0.8));
      }
    },
    smoke(x, y, z, n = 6) { this.burst(x, y, z, n, '#8a8a8a', 1.6, 1.4, 2.2); },
    sparks(x, y, z, n = 10) { this.burst(x, y, z, n, '#ffd23e', 7, 0.4, 0.7); },
    blood(x, y, z) { this.burst(x, y, z, 8, '#a81d1d', 3, 0.6, 1); },
    explosion(x, y, z) {
      this.burst(x, y + 1, z, 40, '#ff7a1d', 9, 0.9, 3);
      this.burst(x, y + 1, z, 26, '#ffcf3e', 6, 0.6, 2.4);
      this.smoke(x, y + 2, z, 20);
      this.addShake(0.9);
    },
    muzzle(x, y, z) { this.burst(x, y, z, 3, '#ffe9a8', 2, 0.09, 1.4); },
    tracer(from, to) {
      const i = tracerCursor;
      tracerCursor = (tracerCursor + 1) % 64;
      tracerPos[i * 6] = from.x; tracerPos[i * 6 + 1] = from.y; tracerPos[i * 6 + 2] = from.z;
      tracerPos[i * 6 + 3] = to.x; tracerPos[i * 6 + 4] = to.y; tracerPos[i * 6 + 5] = to.z;
      tracerLife[i] = 0.09;
    },
    setBeacon(x, z, visible, color = 0xffb02e) {
      beacon.visible = visible;
      if (visible) {
        beacon.position.set(x, 0, z);
        beam.material.color.setHex(color);
        diamond.material.color.setHex(color);
      }
    },
    update(dt, time) {
      shake = Math.max(0, shake - dt * 2.2);
      for (let i = 0; i < MAX_PARTICLES; i += 1) {
        const p = parts[i];
        if (p.life > 0) {
          p.life -= dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.vy -= 3 * dt; p.vx *= 0.98; p.vz *= 0.98;
          if (p.y < 0.1) { p.y = 0.1; p.vy = 0; }
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
          const f = Math.max(0, p.life / p.max);
          col[i * 3] = p.r * f; col[i * 3 + 1] = p.g * f; col[i * 3 + 2] = p.b * f;
          size[i] = p.s * (0.5 + f);
        } else {
          pos[i * 3 + 1] = -100;
          size[i] = 0;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      geo.attributes.size.needsUpdate = true;
      for (let i = 0; i < 64; i += 1) {
        if (tracerLife[i] > 0) {
          tracerLife[i] -= dt;
          if (tracerLife[i] <= 0) tracerPos[i * 6 + 1] = -100;
        }
      }
      tracerGeo.attributes.position.needsUpdate = true;
      if (beacon.visible) {
        diamond.position.y = 7 + Math.sin(time * 2.4) * 0.7;
        diamond.rotation.y = time * 1.6;
        beam.rotation.y = time * 0.4;
      }
    },
  };
}
