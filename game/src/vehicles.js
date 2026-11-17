// Cars: procedural box-built models, arcade driving physics, traffic that
// follows the road grid, parked cars to steal, and police interceptors.
import * as THREE from 'three';
import { WORLD, CAR } from './config.js';
import { roadLines, nearestRoad, collideCircle } from './city.js';
import { checkerTexture } from './textures.js';

export const MODELS = {
  sedan: { name: 'Veloria Sedan', len: 4.6, wid: 2.0, topSpeed: 30, accel: 14, grip: 3.2, colors: ['#c23b2e', '#2e5dc2', '#d8d8d8', '#3a3f45', '#7a4a8f'] },
  coupe: { name: 'Comet Coupe', len: 4.2, wid: 1.9, topSpeed: 38, accel: 20, grip: 4.0, colors: ['#e8a81d', '#c22e6a', '#222831', '#e8e8e8'] },
  muscle: { name: 'Torro Muscle', len: 4.8, wid: 2.1, topSpeed: 36, accel: 18, grip: 3.4, colors: ['#8f1d1d', '#1d3a8f', '#d97a1d', '#222222'] },
  taxi: { name: 'City Cab', len: 4.6, wid: 2.0, topSpeed: 30, accel: 14, grip: 3.2, colors: ['#f2c21d'] },
  van: { name: 'Cargo Van', len: 5.2, wid: 2.2, topSpeed: 25, accel: 11, grip: 2.8, colors: ['#d8d8d8', '#5a6a7a', '#8f6a3a'] },
  truck: { name: 'Hauler Truck', len: 6.4, wid: 2.4, topSpeed: 23, accel: 9, grip: 2.4, colors: ['#3a7a4a', '#8f3a2d', '#4a5a6a'] },
  police: { name: 'VPD Interceptor', len: 4.6, wid: 2.0, topSpeed: 40, accel: 21, grip: 4.2, colors: ['#1a1a1a'] },
  limo: { name: 'Harbor Limo', len: 5.8, wid: 2.1, topSpeed: 30, accel: 13, grip: 3.0, colors: ['#141414'] },
};

const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
wheelGeo.rotateZ(Math.PI / 2);
const glassMat = new THREE.MeshLambertMaterial({ color: '#4a6d8f' });
const wheelMat = new THREE.MeshLambertMaterial({ color: '#16181c' });
const lightMat = new THREE.MeshBasicMaterial({ color: '#fff6c9' });
const tailMat = new THREE.MeshBasicMaterial({ color: '#ff2e2e' });
const chromeMat = new THREE.MeshLambertMaterial({ color: '#c8ccd2' });

export function buildCarMesh(modelKey, colorHex, rng) {
  const m = MODELS[modelKey];
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colorHex });
  const body = new THREE.Mesh(bodyGeo, paint);
  body.scale.set(m.wid, 0.75, m.len);
  body.position.y = 0.62;
  group.add(body);
  const cabinH = modelKey === 'van' || modelKey === 'truck' ? 0.95 : 0.62;
  const cabin = new THREE.Mesh(bodyGeo, modelKey === 'police' ? new THREE.MeshLambertMaterial({ color: '#e8e8e8' }) : paint);
  cabin.scale.set(m.wid * 0.86, cabinH, m.len * (modelKey === 'van' ? 0.8 : 0.5));
  cabin.position.set(0, 1.0 + cabinH / 2 - 0.28, modelKey === 'truck' ? m.len * 0.22 : -m.len * 0.06);
  group.add(cabin);
  const glass = new THREE.Mesh(bodyGeo, glassMat);
  glass.scale.set(m.wid * 0.8, cabinH * 0.6, m.len * 0.42);
  glass.position.set(0, 1.0 + cabinH / 2 - 0.2, modelKey === 'truck' ? m.len * 0.2 : -m.len * 0.06);
  group.add(glass);
  if (modelKey === 'taxi') {
    const sign = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ map: checkerTexture('#f2c21d', '#1a1a1a') }));
    sign.scale.set(0.9, 0.3, 0.4);
    sign.position.set(0, 1.75, -0.1);
    group.add(sign);
  }
  if (modelKey === 'police') {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: '#ff2020' }));
    red.scale.set(0.55, 0.22, 0.3); red.position.x = -0.35;
    const blue = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: '#2050ff' }));
    blue.scale.set(0.55, 0.22, 0.3); blue.position.x = 0.35;
    bar.add(red, blue);
    bar.position.set(0, 1.78, -0.1);
    group.add(bar);
    group.userData.lightBar = { red, blue };
  }
  const headL = new THREE.Mesh(bodyGeo, lightMat); headL.scale.set(0.4, 0.2, 0.1); headL.position.set(-m.wid * 0.32, 0.7, m.len / 2 + 0.02);
  const headR = headL.clone(); headR.position.x = m.wid * 0.32;
  const tailL = new THREE.Mesh(bodyGeo, tailMat); tailL.scale.set(0.4, 0.2, 0.1); tailL.position.set(-m.wid * 0.32, 0.7, -m.len / 2 - 0.02);
  const tailR = tailL.clone(); tailR.position.x = m.wid * 0.32;
  group.add(headL, headR, tailL, tailR);
  const bumper = new THREE.Mesh(bodyGeo, chromeMat);
  bumper.scale.set(m.wid * 0.9, 0.14, 0.12);
  bumper.position.set(0, 0.35, m.len / 2 + 0.03);
  group.add(bumper);
  const wheels = [];
  const wz = m.len / 2 - 0.8;
  const wx = m.wid / 2 - 0.12;
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.42, z);
    group.add(w);
    wheels.push(w);
  }
  group.userData.wheels = wheels;
  group.userData.smoke = 0;
  return group;
}

let nextCarId = 1;

export function spawnCar(scene, modelKey, x, z, heading, role, rng) {
  const m = MODELS[modelKey];
  const color = rng.pick(m.colors);
  const mesh = buildCarMesh(modelKey, color, rng);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const car = {
    id: nextCarId,
    model: modelKey,
    mesh,
    x, z, heading,
    speed: 0,
    steer: 0,
    role, // 'traffic' | 'parked' | 'player' | 'police' | 'mission'
    color,
    damage: 0,
    route: null,
    routeIndex: 0,
    waitTimer: 0,
    driver: null,
    targetSpeed: 0,
    sirenPhase: rng.range(0, 6),
    dead: false,
    wheelSpin: 0,
  };
  nextCarId += 1;
  return car;
}

/** A Manhattan route over the road grid: list of {x,z} waypoints. */
export function makeRoute(rng, fromX, fromZ) {
  const lines = roadLines();
  let cx = nearestRoad(fromX);
  let cz = nearestRoad(fromZ);
  let tx = rng.pick(lines);
  let tz = rng.pick(lines);
  // Never route nowhere: the target must differ from the start.
  while (tx === cx && tz === cz) {
    tx = rng.pick(lines);
    tz = rng.pick(lines);
  }
  const pts = [];
  while (cx !== tx || cz !== tz) {
    if (cx !== tx && (cz === tz || rng.chance(0.5))) {
      cx += Math.sign(tx - cx) * WORLD.pitch;
    } else {
      cz += Math.sign(tz - cz) * WORLD.pitch;
    }
    pts.push({ x: cx, z: cz });
  }
  return pts;
}

function driveToward(car, tx, tz, dt, desiredSpeed) {
  const dx = tx - car.x;
  const dz = tz - car.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const m = MODELS[car.model];
  const steerTarget = Math.max(-1, Math.min(1, diff * 2.2));
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 6);
  const slow = Math.min(1, dist / 18) * (1 - Math.min(0.6, Math.abs(diff) * 0.5));
  const target = desiredSpeed * Math.max(0.15, slow);
  car.speed += (target - car.speed) * Math.min(1, dt * 1.6);
  car.heading += car.steer * (car.speed / m.len) * 0.9 * dt * Math.sign(car.speed || 1);
  return dist;
}

export function updateTrafficCar(car, dt, state, rng) {
  if (!car.route || car.routeIndex >= car.route.length) {
    car.route = makeRoute(rng, car.x, car.z);
    car.routeIndex = 0;
  }
  // Brake for a car ahead.
  let blocked = false;
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
    const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
    if (ahead > 0 && ahead < 11 && side < 3.2) { blocked = true; break; }
  }
  const wp = car.route[car.routeIndex];
  // Right-hand lane offset.
  const lane = 4;
  const tx = wp.x + (Math.abs(wp.x - car.x) < 1 ? 0 : 0);
  const tz = wp.z;
  const dist = driveToward(car, tx, tz, dt, blocked ? 0 : 13);
  // Lane offset: shift target sideways once aligned to an axis.
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  if (dist < 7) car.routeIndex += 1;
  if (car.waitTimer > 0) { car.waitTimer -= dt; car.speed *= 0.9; }
  void lane;
}

export function updatePlayerCar(car, dt, input, state) {
  const m = MODELS[car.model];
  const axis = input.axis();
  const throttle = -axis.z; // W = forward
  const steering = axis.x;
  const braking = input.jump(); // Space = brake / handbrake with shift
  const handbrake = braking && input.sprint();
  if (throttle > 0) car.speed += m.accel * dt * (car.speed < 0 ? 2.2 : 1);
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= m.accel * 1.6 * dt;
    else car.speed = Math.max(-m.topSpeed * 0.4, car.speed - m.accel * 0.7 * dt);
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 4 * dt);
  }
  if (braking && !handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 14 * dt);
  car.speed = Math.max(-m.topSpeed * 0.4, Math.min(m.topSpeed, car.speed));
  const steerTarget = steering * (1 - Math.min(0.55, Math.abs(car.speed) / m.topSpeed * 0.55));
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * (handbrake ? 10 : 6));
  const grip = handbrake ? m.grip * 0.45 : m.grip;
  car.heading += car.steer * (car.speed / m.len) * grip * 0.32 * dt;
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.skidding = handbrake && Math.abs(car.speed) > 8;
  return car.skidding;
}

export function syncCarMesh(car, dt, time) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  car.wheelSpin += car.speed * dt * 2.4;
  const wheels = car.mesh.userData.wheels;
  for (let i = 0; i < wheels.length; i += 1) {
    wheels[i].rotation.x = car.wheelSpin;
    if (i < 2) wheels[i].rotation.y = car.steer * 0.45;
  }
  const bar = car.mesh.userData.lightBar;
  if (bar) {
    const on = Math.sin(time * 12 + car.sirenPhase) > 0;
    bar.red.visible = on;
    bar.blue.visible = !on;
  }
  // Damage smoke: tilt the body slightly and shake when wrecked.
  if (car.damage > 60) {
    car.mesh.rotation.z = Math.sin(time * 30) * 0.01;
  }
}

/** Circle-vs-circle car collisions with damage and a push apart. */
export function resolveCarCollisions(cars, onCrash) {
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = CAR.radius * 1.7;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 4) {
          a.damage += rel * 0.8; b.damage += rel * 0.8;
          a.speed *= 0.6; b.speed *= 0.6;
          if (onCrash) onCrash(a, b, rel);
        } else {
          a.speed *= 0.92; b.speed *= 0.92;
        }
      }
    }
  }
}

/** Building collision for a car: slide along the wall, lose speed, take damage. */
export function collideCarWithCity(car, colliders, onCrash) {
  const pos = { x: car.x, z: car.z };
  const speedBefore = Math.abs(car.speed);
  if (collideCircle(colliders, pos, CAR.radius)) {
    car.x = pos.x; car.z = pos.z;
    if (speedBefore > 6) {
      car.damage += speedBefore * 0.9;
      car.speed *= 0.35;
      if (onCrash) onCrash(car, null, speedBefore);
    } else {
      car.speed *= 0.7;
    }
  }
  // World bounds + water: the sea stops cars at the sand.
  const lim = WORLD.half + 8;
  if (car.x < -lim) { car.x = -lim; car.speed *= 0.5; }
  if (car.x > lim) { car.x = lim; car.speed *= 0.5; }
  if (car.z < -lim) { car.z = -lim; car.speed *= 0.5; }
  if (car.z > WORLD.beachZ + 6) { car.z = WORLD.beachZ + 6; car.speed *= 0.5; }
}
