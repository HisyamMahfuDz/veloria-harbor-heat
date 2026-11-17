// Every tuning number, name and colour in one place. VELORIA is an original
// sun-soaked coastal city: no names, places or art from any commercial game.
export const STEP = 1 / 60;
export const WORLD = {
  half: 270, // playable half-extent; the beach and water lie south of it
  pitch: 72, // road-centre spacing
  roadWidth: 16,
  roads: 8, // road lines each way, at -252 + i*72
  beachZ: 278, // sand starts here (south edge)
  waterZ: 306, // water plane starts here
};

export const GAME_TITLE = 'VELORIA';
export const GAME_SUBTITLE = 'Harbor Heat — an open-world crime story';
export const SAVE_KEY = 'veloria.save.v1';
export const BEST_KEY = 'veloria.best.v1';

export const PLAYER = {
  walkSpeed: 6,
  sprintSpeed: 10.5,
  accel: 40,
  radius: 0.7,
  maxHealth: 100,
  maxArmor: 100,
  jumpSpeed: 8,
  punchDamage: 12,
  punchRange: 2.2,
  punchCooldown: 0.45,
};

export const CAR = {
  radius: 2.3,
  enterRange: 4.2,
  stealHeat: 1, // wanted stars gained for stealing a car with a witness
};

export const WANTED = {
  max: 5,
  decayDelay: 6, // seconds unseen before the level starts falling
  decayTime: 9, // seconds per star once decaying
  bustTime: 2.2, // seconds a cop must stay close to bust an on-foot player
  evadeRadius: 55, // cops farther than this cannot see the player
  resprayCost: 250,
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.45, range: 2.2, mag: Infinity, reserve: Infinity, spread: 0, auto: false, sound: 'punch' },
  pistol: { name: 'P9 Pistol', damage: 26, rate: 0.28, range: 90, mag: 12, reserve: 96, spread: 0.012, auto: false, sound: 'shot' },
  smg: { name: 'K-7 SMG', damage: 15, rate: 0.09, range: 70, mag: 32, reserve: 192, spread: 0.035, auto: true, sound: 'shot' },
  shotgun: { name: 'Breacher 12', damage: 14, rate: 0.8, range: 30, mag: 6, reserve: 36, spread: 0.09, auto: false, pellets: 6, sound: 'boom' },
};

export const PALETTE = {
  skyTop: '#2e6fb8',
  skyHorizon: '#ffb35c',
  sun: '#ffd9a0',
  fog: '#f2a56b',
  asphalt: '#33373d',
  sidewalk: '#9a938a',
  sand: '#e8cf9a',
  water: '#1d7fa8',
  grass: '#6f9e57',
  building: ['#e8dcc8', '#d9c2a8', '#c8b8d4', '#a8c4d9', '#e0b48f', '#b8c4a8', '#d9a8a8', '#f0e6d0'],
  glass: '#7fb2d9',
  hud: '#ffffff',
  accent: '#ffb02e',
  danger: '#ff4d4d',
  police: '#3a6fd8',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

// Fixed story locations, all beside roads. x east, z south, y up.
export const PLACES = {
  garage: { name: "Ivy's Garage", x: -108, z: -36, blip: 'G' },
  safehouse: { name: 'Safehouse', x: 36, z: -108, blip: 'H' },
  respray: { name: 'Sunshine Respray', x: 180, z: 36, blip: 'S' },
  hospital: { name: 'Veloria General', x: -180, z: 108, blip: '+' },
  policeStation: { name: 'VPD Central', x: 108, z: 180, blip: 'P' },
  gunShop: { name: 'Iron & Oak', x: -36, z: 180, blip: 'A' },
  casino: { name: 'Golden Palm Casino', x: 180, z: -108, blip: 'C' },
  hotel: { name: 'Marlin Hotel', x: -180, z: -180, blip: 'M' },
  bank: { name: 'First Harbor Bank', x: 36, z: 36, blip: 'B' },
  docks: { name: 'Harbor Docks', x: 216, z: 252, blip: 'D' },
  pier: { name: 'Sunset Pier', x: -216, z: 268, blip: 'W' },
  diner: { name: "Rosa's Diner", x: -36, z: -180, blip: 'R' },
  mall: { name: 'Veloria Galleria', x: 108, z: -180, blip: 'L' },
  motel: { name: 'Palm Court Motel', x: -180, z: 36, blip: 'T' },
};

export const RANKS = [
  { cash: 0, name: 'Wheelman' },
  { cash: 1000, name: 'Hustler' },
  { cash: 3000, name: 'Getaway Artist' },
  { cash: 7000, name: 'Harbor Legend' },
  { cash: 12000, name: 'King of Veloria' },
];

export const CONTROLS_TEXT = [
  ['W A S D', 'Move / drive'],
  ['Mouse', 'Look · Click: shoot / punch'],
  ['Shift', 'Sprint / handbrake'],
  ['Space', 'Jump / brake (car)'],
  ['E', 'Enter / exit car · steal'],
  ['F', 'Punch'],
  ['R', 'Reload'],
  ['1 2 3', 'Fists · pistol · SMG / shotgun'],
  ['Q', 'Taxi job · talk'],
  ['M', 'Music on / off'],
  ['P / Esc', 'Pause'],
];
