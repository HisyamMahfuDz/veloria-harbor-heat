// The view: renderer, golden-hour sky and light, and the third-person camera
// with shake, smoothing and a pull-in when a building blocks the shot.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { skyTexture } from './textures.js';
import { rayBuildings } from './city.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.fog, 220, 700);

  // Sky dome: a warm gradient that never moves with the camera.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(800, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  // Golden-hour sun + soft fill.
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
  sun.position.set(-180, 130, 120);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight('#ffd9a8', '#5a4a3a', 1.1);
  scene.add(hemi);
  const amb = new THREE.AmbientLight('#ffe0b8', 0.35);
  scene.add(amb);

  // A few flat clouds drifting slowly.
  const cloudMat = new THREE.MeshBasicMaterial({ color: '#fff2e0', transparent: true, opacity: 0.85, fog: false });
  const clouds = [];
  for (let i = 0; i < 9; i += 1) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 3; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(9 + j * 3, 8, 6), cloudMat);
      puff.position.set(j * 10 - 10, j * 1.5, 0);
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(-500 + i * 120, 120 + (i % 3) * 22, -250 + (i % 4) * 130);
    scene.add(cloud);
    clouds.push(cloud);
  }

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);
  const camPos = new THREE.Vector3(0, 8, 20);
  const camLook = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    scene, camera, renderer,
    /** Position the camera behind the focus point; returns the view direction. */
    updateCamera(state, focusX, focusY, focusZ, dt, override) {
      const yaw = override?.yaw ?? state.cameraYaw;
      const pitch = override?.pitch ?? state.cameraPitch;
      const dist = override?.dist ?? (state.player.car ? 11.5 : 8);
      const h = 2 + Math.sin(pitch) * dist;
      const flat = Math.cos(pitch) * dist;
      let cx = focusX + Math.sin(yaw) * flat;
      let cz = focusZ + Math.cos(yaw) * flat;
      let cy = focusY + h;
      // Pull the camera in when a building blocks the view.
      if (!override?.ignoreCollision) {
        const dx = cx - focusX; const dy = cy - focusY; const dz = cz - focusZ;
        const len = Math.hypot(dx, dy, dz) || 1;
        const hit = rayBuildings(state.colliders, focusX, focusY, focusZ, dx / len, dy / len, dz / len, len);
        if (hit < len) {
          const pull = Math.max(2.2, hit - 0.8);
          cx = focusX + (dx / len) * pull;
          cy = focusY + (dy / len) * pull;
          cz = focusZ + (dz / len) * pull;
        }
      }
      cy = Math.max(1.2, cy);
      const k = override?.snap ? 1 : Math.min(1, dt * 10);
      camPos.x += (cx - camPos.x) * k;
      camPos.y += (cy - camPos.y) * k;
      camPos.z += (cz - camPos.z) * k;
      const shake = state.effects.getShake();
      camera.position.set(
        camPos.x + (Math.random() - 0.5) * shake * 0.5,
        camPos.y + (Math.random() - 0.5) * shake * 0.5,
        camPos.z + (Math.random() - 0.5) * shake * 0.5,
      );
      camLook.set(focusX, focusY + 1.6, focusZ);
      camera.lookAt(camLook);
      camera.getWorldDirection(tmpDir);
      state.cameraDir.copy(tmpDir);
      sky.position.copy(camera.position);
      for (const cloud of clouds) {
        cloud.position.x += dt * 1.5;
        if (cloud.position.x > 560) cloud.position.x = -560;
      }
      return tmpDir;
    },
    render() { renderer.render(scene, camera); },
    snapCamera(x, y, z) { camPos.set(x, y, z); },
  };
}
