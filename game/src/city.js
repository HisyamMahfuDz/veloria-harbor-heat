// Veloria itself: a procedural grid city with a beach, a pier and a ferris
// wheel. Buildings are instanced boxes with canvas window textures; the road
// graph drives traffic, and every building registers an AABB collider.
import * as THREE from 'three';
import { WORLD, PALETTE, PLACES } from './config.js';
import { buildingTexture, asphaltTexture, sidewalkTexture, sandTexture, grassTexture, signTexture, checkerTexture } from './textures.js';

export function roadLines() {
  const lines = [];
  for (let i = 0; i < WORLD.roads; i += 1) lines.push(-252 + i * WORLD.pitch);
  return lines;
}

export function nearestRoad(v) {
  const lines = roadLines();
  let best = lines[0];
  for (const l of lines) if (Math.abs(l - v) < Math.abs(best - v)) best = l;
  return best;
}

export function onRoad(x, z) {
  const hw = WORLD.roadWidth / 2;
  for (const l of roadLines()) {
    if (Math.abs(x - l) < hw || Math.abs(z - l) < hw) return true;
  }
  return false;
}

export function createCity(scene, rng) {
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const group = new THREE.Group();
  scene.add(group);
  const dummy = new THREE.Object3D();

  // Ground: one big grass plane, roads and sidewalks drawn above it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 120, WORLD.half * 2 + 220),
    new THREE.MeshLambertMaterial({ map: grassTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 20);
  ground.material.map.repeat.set(40, 40);
  ground.material.map.wrapS = ground.material.map.wrapT = THREE.RepeatWrapping;
  group.add(ground);

  // Asphalt: one plane per road line, both directions; each orientation gets
  // its own texture so the dashed centre line runs along the road.
  const roadMatH = new THREE.MeshLambertMaterial({ map: asphaltTexture(true) });
  const roadMatV = new THREE.MeshLambertMaterial({ map: asphaltTexture(false) });
  const lines = roadLines();
  const span = WORLD.half * 2 + 40;
  for (const l of lines) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(span, WORLD.roadWidth), roadMatH);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0, l); group.add(h);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, span), roadMatV);
    v.rotation.x = -Math.PI / 2; v.position.set(l, 0, 0); group.add(v);
  }

  // Sidewalks: one slab per block.
  const walkMat = new THREE.MeshLambertMaterial({ map: sidewalkTexture() });
  const blockSize = WORLD.pitch - WORLD.roadWidth;
  const blockCentres = [];
  for (let i = 0; i < WORLD.roads - 1; i += 1) {
    for (let j = 0; j < WORLD.roads - 1; j += 1) {
      const cx = -252 + i * WORLD.pitch + WORLD.pitch / 2;
      const cz = -252 + j * WORLD.pitch + WORLD.pitch / 2;
      blockCentres.push({ x: cx, z: cz });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(blockSize, 0.3, blockSize), walkMat);
      slab.position.set(cx, 0.15, cz);
      group.add(slab);
    }
  }

  // Buildings: instanced, 1-4 per block, taller toward the centre.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const winTex = buildingTexture(rng, 12, 6);
  const bMat = new THREE.MeshLambertMaterial({ map: winTex });
  const placements = [];
  for (const b of blockCentres) {
    const distC = Math.hypot(b.x, b.z) / WORLD.half;
    const tall = rng.range(0.35, 1) > distC;
    const n = rng.pick([1, 2, 2, 4]);
    const spots = n === 1 ? [[0, 0, 0.8]] : n === 2
      ? [[-0.24, 0, 0.42], [0.24, 0, 0.42]]
      : [[-0.24, -0.24, 0.42], [0.24, -0.24, 0.42], [-0.24, 0.24, 0.42], [0.24, 0.24, 0.42]];
    for (const [ox, oz, f] of spots) {
      const w = blockSize * f * rng.range(0.8, 1);
      const d = blockSize * f * rng.range(0.8, 1);
      const h = tall ? rng.range(26, 62) : rng.range(9, 24);
      const x = b.x + ox * blockSize;
      const z = b.z + oz * blockSize;
      placements.push({ x, z, w, d, h, color: rng.pick(PALETTE.building) });
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }
  }
  const inst = new THREE.InstancedMesh(boxGeo, bMat, placements.length);
  const color = new THREE.Color();
  placements.forEach((p, i) => {
    dummy.position.set(p.x, 0.3, p.z);
    dummy.scale.set(p.w, p.h, p.d);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    inst.setColorAt(i, color.set(p.color));
  });
  inst.instanceMatrix.needsUpdate = true;
  group.add(inst);

  // Rooftop boxes on a few tall buildings.
  const roofGeo = new THREE.BoxGeometry(4, 3, 4);
  const roofMat = new THREE.MeshLambertMaterial({ color: '#8a8580' });
  const roofs = placements.filter((p) => p.h > 30);
  const roofInst = new THREE.InstancedMesh(roofGeo, roofMat, roofs.length);
  roofs.forEach((p, i) => {
    dummy.position.set(p.x + p.w * 0.2, 0.3 + p.h, p.z - p.d * 0.2);
    dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    roofInst.setMatrixAt(i, dummy.matrix);
  });
  group.add(roofInst);

  // Palms along sidewalks and the beach.
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 7, 6);
  trunkGeo.translate(0, 3.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#8a6a4a' });
  const frondGeo = new THREE.ConeGeometry(3.4, 2.4, 7);
  frondGeo.translate(0, 7.6, 0);
  const frondMat = new THREE.MeshLambertMaterial({ color: '#3f8a4a' });
  const palmSpots = [];
  for (const b of blockCentres) {
    if (rng.chance(0.6)) palmSpots.push({ x: b.x + blockSize / 2 - 3, z: b.z + rng.range(-18, 18) });
    if (rng.chance(0.4)) palmSpots.push({ x: b.x - blockSize / 2 + 3, z: b.z + rng.range(-18, 18) });
  }
  for (let x = -250; x <= 250; x += 18) palmSpots.push({ x: x + rng.range(-4, 4), z: WORLD.beachZ + 4 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const frondInst = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length);
  palmSpots.forEach((p, i) => {
    dummy.position.set(p.x, 0.3, p.z);
    dummy.scale.set(1, 1, 1); dummy.rotation.set(0, rng.range(0, 6.28), 0); dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    frondInst.setMatrixAt(i, dummy.matrix);
  });
  group.add(trunkInst, frondInst);

  // Streetlights at intersections.
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.24, 8, 6);
  poleGeo.translate(0, 4, 0);
  const poleMat = new THREE.MeshLambertMaterial({ color: '#3a3f45' });
  const lampGeo = new THREE.SphereGeometry(0.55, 8, 6);
  lampGeo.translate(0, 8.2, 0);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ffe9a8' });
  const lampSpots = [];
  for (const lx of lines) for (const lz of lines) lampSpots.push({ x: lx + 9, z: lz + 9 });
  const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const lampInst = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
  lampSpots.forEach((p, i) => {
    dummy.position.set(p.x, 0, p.z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    poleInst.setMatrixAt(i, dummy.matrix);
    lampInst.setMatrixAt(i, dummy.matrix);
  });
  group.add(poleInst, lampInst);

  // Beach, water and the pier.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 120, 40),
    new THREE.MeshLambertMaterial({ map: sandTexture() }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, WORLD.beachZ + 18);
  sand.material.map.repeat.set(30, 3);
  sand.material.map.wrapS = sand.material.map.wrapT = THREE.RepeatWrapping;
  group.add(sand);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 400),
    new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.4, WORLD.waterZ + 180);
  group.add(water);
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 60), new THREE.MeshLambertMaterial({ color: '#9a7a52' }));
  pier.position.set(PLACES.pier.x, 0.6, WORLD.beachZ + 34);
  group.add(pier);

  // Ferris wheel on the pier: a landmark visible across the city.
  const wheel = new THREE.Group();
  wheel.position.set(PLACES.pier.x, 0.6, WORLD.beachZ + 62);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(14, 0.5, 8, 32), new THREE.MeshLambertMaterial({ color: '#e8645a' }));
  rim.position.y = 16;
  wheel.add(rim);
  const spokeMat = new THREE.MeshLambertMaterial({ color: '#f0e6d0' });
  for (let i = 0; i < 4; i += 1) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 28, 0.5), spokeMat);
    spoke.position.y = 16;
    spoke.rotation.z = (i * Math.PI) / 4;
    wheel.add(spoke);
  }
  const cabinGeo = new THREE.BoxGeometry(2.4, 2.4, 2.4);
  const cabins = new THREE.Group();
  cabins.position.y = 16;
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const cabin = new THREE.Mesh(cabinGeo, new THREE.MeshLambertMaterial({ color: ['#ffd23e', '#3ea8ff', '#ff5a8a', '#7ae582'][i % 4] }));
    cabin.position.set(Math.cos(a) * 14, Math.sin(a) * 14, 0);
    cabins.add(cabin);
  }
  wheel.add(cabins);
  const legGeo = new THREE.BoxGeometry(1.2, 18, 1.2);
  const legL = new THREE.Mesh(legGeo, spokeMat); legL.position.set(-5, 8, 0); legL.rotation.z = 0.3;
  const legR = new THREE.Mesh(legGeo, spokeMat); legR.position.set(5, 8, 0); legR.rotation.z = -0.3;
  wheel.add(legL, legR);
  group.add(wheel);

  // Hills ringing the north edge.
  const hillMat = new THREE.MeshLambertMaterial({ color: '#7a8a6a' });
  for (let x = -320; x <= 320; x += 55) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(rng.range(28, 48), rng.range(35, 70), 7), hillMat);
    hill.position.set(x + rng.range(-12, 12), 0, -330 + rng.range(-15, 15));
    group.add(hill);
  }

  // Shop signs on the landmark buildings.
  const signs = [
    [PLACES.garage, "IVY'S GARAGE", '#274d8f', '#ffd23e'],
    [PLACES.casino, 'GOLDEN PALM', '#7a2d8f', '#ffd23e'],
    [PLACES.hotel, 'MARLIN HOTEL', '#2d7a6a', '#ffffff'],
    [PLACES.bank, 'FIRST HARBOR BANK', '#5a4a2d', '#ffffff'],
    [PLACES.diner, "ROSA'S DINER", '#a83a3a', '#ffffff'],
    [PLACES.mall, 'GALLERIA', '#3a5a8f', '#ffffff'],
    [PLACES.gunShop, 'IRON & OAK', '#4a4a4a', '#ffb02e'],
    [PLACES.respray, 'SUNSHINE RESPRAY', '#c97a1d', '#ffffff'],
    [PLACES.hospital, 'VELORIA GENERAL', '#e8e8e8', '#c93a3a'],
    [PLACES.policeStation, 'VPD CENTRAL', '#2d4a7a', '#ffffff'],
  ];
  for (const [place, text, bg, fg] of signs) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 3.6),
      new THREE.MeshBasicMaterial({ map: signTexture(text, bg, fg), side: THREE.DoubleSide }),
    );
    sign.position.set(place.x, 9, place.z - 26);
    group.add(sign);
    colliders.push({ minX: place.x - 22, maxX: place.x + 22, minZ: place.z - 30, maxZ: place.z - 22 });
  }

  // Diner awning and docks crates for the mission areas.
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.6, 5),
    new THREE.MeshLambertMaterial({ map: checkerTexture('#c93a3a', '#ffffff') }),
  );
  awning.position.set(PLACES.diner.x, 5, PLACES.diner.z - 24);
  group.add(awning);
  const crateGeo = new THREE.BoxGeometry(3, 3, 3);
  const crateMat = new THREE.MeshLambertMaterial({ color: '#a8814f' });
  for (let i = 0; i < 14; i += 1) {
    const crate = new THREE.Mesh(crateGeo, crateMat);
    const cx = PLACES.docks.x + rng.range(-24, 24);
    const cz = PLACES.docks.z + rng.range(-14, 14);
    crate.position.set(cx, 1.5, cz);
    crate.rotation.y = rng.range(0, 3);
    group.add(crate);
    colliders.push({ minX: cx - 1.6, maxX: cx + 1.6, minZ: cz - 1.6, maxZ: cz + 1.6 });
  }
  // Docked boats.
  const hullMat = new THREE.MeshLambertMaterial({ color: '#d8d8d8' });
  for (let i = 0; i < 4; i += 1) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 12), hullMat);
    hull.position.y = 0.4;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 4), new THREE.MeshLambertMaterial({ color: '#3a6f8f' }));
    cabin.position.set(0, 2, -1);
    boat.add(hull, cabin);
    boat.position.set(PLACES.docks.x - 30 + i * 20, -0.2, WORLD.waterZ + 12);
    boat.rotation.y = 0.2;
    group.add(boat);
  }

  return {
    group, colliders, wheel, cabins,
    update(dt, time) {
      cabins.rotation.z = time * 0.08;
      water.position.y = -0.4 + Math.sin(time * 0.5) * 0.08;
    },
  };
}

/** Push a circle out of every AABB it overlaps; returns true when a hit happened. */
export function collideCircle(colliders, pos, radius) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const pushL = pos.x - c.minX + radius;
        const pushR = c.maxX - pos.x + radius;
        const pushU = pos.z - c.minZ + radius;
        const pushD = c.maxZ - pos.z + radius;
        const m = Math.min(pushL, pushR, pushU, pushD);
        if (m === pushL) pos.x = c.minX - radius;
        else if (m === pushR) pos.x = c.maxX + radius;
        else if (m === pushU) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
  return hit;
}

/** Ray vs the building AABBs: the distance to the nearest hit, or Infinity. */
export function rayBuildings(colliders, ox, oy, oz, dx, dy, dz, maxDist) {
  let best = Infinity;
  for (const c of colliders) {
    // Boxes rise from y=0 to y=60; treat tall buildings as 60 high.
    let tmin = 0;
    let tmax = maxDist;
    const mins = [c.minX, 0, c.minZ];
    const maxs = [c.maxX, 60, c.maxZ];
    const o = [ox, oy, oz];
    const d = [dx, dy, dz];
    let ok = true;
    for (let i = 0; i < 3; i += 1) {
      if (Math.abs(d[i]) < 1e-8) {
        if (o[i] < mins[i] || o[i] > maxs[i]) { ok = false; break; }
      } else {
        let t1 = (mins[i] - o[i]) / d[i];
        let t2 = (maxs[i] - o[i]) / d[i];
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) { ok = false; break; }
      }
    }
    if (ok && tmin < best) best = tmin;
  }
  return best;
}
