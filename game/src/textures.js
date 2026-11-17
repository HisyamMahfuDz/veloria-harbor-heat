// All art is procedural: canvas textures drawn at boot, no image files.
import * as THREE from 'three';
import { PALETTE } from './config.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Lit/unlit office windows in a grid; tinted per building by the material colour. */
export function buildingTexture(rng, floors, cols) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / floors;
    for (let y = 0; y < floors; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const lit = rng.chance(0.28);
        g.fillStyle = lit ? '#ffd98a' : (rng.chance(0.5) ? '#5d7d99' : '#47657f');
        g.fillRect(x * cw + cw * 0.22, y * ch + ch * 0.24, cw * 0.56, ch * 0.52);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 0; y < floors; y += 1) g.fillRect(0, y * ch, w, 2);
  });
}

export function asphaltTexture(horizontal) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = PALETTE.asphalt;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 900; i += 1) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    // The centre line runs along the road's length: along U for a horizontal
    // road plane, along V for a vertical one.
    g.fillStyle = '#c9a227';
    if (horizontal) {
      for (let x = 0; x < w; x += 32) g.fillRect(x, h / 2 - 3, 18, 6);
      g.fillStyle = '#e8e8e8';
      g.fillRect(0, 6, w, 4);
      g.fillRect(0, h - 10, w, 4);
    } else {
      for (let y = 0; y < h; y += 32) g.fillRect(w / 2 - 3, y, 6, 18);
      g.fillStyle = '#e8e8e8';
      g.fillRect(6, 0, 4, h);
      g.fillRect(w - 10, 0, 4, h);
    }
  });
}

export function sidewalkTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = PALETTE.sidewalk;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
    g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  });
}

export function sandTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = PALETTE.sand;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(180,150,90,0.35)';
    for (let i = 0; i < 300; i += 1) g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
  });
}

export function grassTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = PALETTE.grass;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 400; i += 1) g.fillRect(Math.random() * w, Math.random() * h, 2, 3);
  });
}

/** Vertical gradient sky dome texture, warm at the horizon. */
export function skyTexture() {
  return canvasTexture(16, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, '#7fa8d0');
    grad.addColorStop(0.78, PALETTE.skyHorizon);
    grad.addColorStop(1, '#ff9e4f');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

/** Shopfront sign: coloured board with the shop's name in bold letters. */
export function signTexture(text, bg, fg) {
  return canvasTexture(512, 96, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = fg;
    g.font = 'bold 52px "Trebuchet MS", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

/** Soft round particle sprite. */
export function particleTexture() {
  return canvasTexture(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
}

/** Checker pattern for the taxi roof sign and the diner awning. */
export function checkerTexture(a, b) {
  return canvasTexture(64, 64, (g, w, h) => {
    const s = 16;
    for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) {
      g.fillStyle = (x + y) % 2 ? a : b;
      g.fillRect(x * s, y * s, s, s);
    }
  });
}
