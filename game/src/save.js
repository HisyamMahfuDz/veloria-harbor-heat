// Save / load through localStorage: cash, story progress, collectibles and
// lifetime stats. Saving never blocks play; a failed write is ignored.
import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return {
    cash: 250,
    missionIndex: 0,
    missionsDone: [],
    packages: [],
    ownedWeapons: ['fists', 'pistol'],
    stats: { carsStolen: 0, distanceKm: 0, faresDone: 0, copsEvaded: 0, missionsDone: 0 },
    musicOn: true,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const base = defaultSave();
    return { ...base, ...data, stats: { ...base.stats, ...(data.stats ?? {}) } };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}
