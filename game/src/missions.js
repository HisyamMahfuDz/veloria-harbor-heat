// The story: six missions for Mara Quinn, from a first fare to the King of
// Veloria. A stage machine drives objectives, dialogue, spawns, timers and
// rewards; the HUD reads the current objective from here.
import { PLACES } from './config.js';
import { spawnCar } from './vehicles.js';
import { spawnGoon } from './enemies.js';
import { spawnPed } from './pedestrians.js';
import { addHeat } from './police.js';

export const MISSION_DEFS = [
  {
    id: 'first-fare', title: 'First Fare', giver: 'Ivy Chen', reward: 150,
    intro: [
      ['Ivy', 'Mara! The cab is outside. A client waits at the Marlin Hotel — drive her to the Galleria.'],
      ['Ivy', 'Easy money. Just don\'t scratch the paint. Much.'],
    ],
    stages: [
      { kind: 'drive', text: 'Get in the cab outside the garage', x: PLACES.garage.x + 8, z: PLACES.garage.z + 12, radius: 10, needCar: true },
      { kind: 'goto', text: 'Pick up the client at the Marlin Hotel', x: PLACES.hotel.x, z: PLACES.hotel.z + 12, radius: 12,
        say: [['Client', 'The Galleria, please. And do hurry — my flight leaves at noon!']] },
      { kind: 'goto', text: 'Drop the client at the Galleria', x: PLACES.mall.x, z: PLACES.mall.z + 12, radius: 12,
        say: [['Client', 'Wonderful driving! Here — keep the change.']] },
    ],
    outro: [['Ivy', 'Not bad. Word travels fast in Veloria — I may have more work for you.']],
  },
  {
    id: 'hot-property', title: 'Hot Property', giver: 'Ivy Chen', reward: 400, unlock: 'smg',
    intro: [
      ['Ivy', 'A Comet coupe sits at the Golden Palm valet. The owner owes me money.'],
      ['Ivy', 'Take it. Bring it here. If the cops notice, lose them before you come home.'],
    ],
    stages: [
      { kind: 'goto', text: 'Go to the Golden Palm Casino', x: PLACES.casino.x, z: PLACES.casino.z + 12, radius: 14,
        onStart: (s) => spawnTargetCar(s, 'coupe', PLACES.casino.x + 6, PLACES.casino.z + 14, '#e8a81d') },
      { kind: 'steal', text: 'Steal the Comet coupe', radius: 6,
        say: [['Mara', 'Nice car. Shame about the owner.']] },
      { kind: 'escape', text: 'Lose the cops', radius: 0,
        onStart: (s) => addHeat(s, 2, 'car theft'),
        say: [['Radio', 'All units: stolen coupe, Golden Palm. Intercept.']] },
      { kind: 'deliver', text: 'Deliver the coupe to the garage', x: PLACES.garage.x, z: PLACES.garage.z + 12, radius: 12 },
    ],
    outro: [['Ivy', 'Beautiful. A client in the hills will pay double. Here is your cut — and a little something for protection.']],
  },
  {
    id: 'getaway', title: 'The Getaway', giver: 'Ivy Chen', reward: 800,
    intro: [
      ['Ivy', 'A crew is hitting the First Harbor Bank. They need a wheelman. That is you.'],
      ['Ivy', 'Pick them up, lose the heat, get them to the safehouse. No heroics.'],
    ],
    stages: [
      { kind: 'drive', text: 'Get a car and reach the bank', x: PLACES.bank.x, z: PLACES.bank.z + 12, radius: 14, needCar: true },
      { kind: 'goto', text: 'Wait for the crew outside the bank', x: PLACES.bank.x, z: PLACES.bank.z + 12, radius: 12, dwell: 3,
        onStart: (s) => spawnCrew(s),
        say: [['Crew', 'Go go go! Drive!'], ['Mara', 'Everyone in? Hold on!']] },
      { kind: 'escape', text: 'Escape the police', radius: 0,
        onStart: (s) => addHeat(s, 3, 'bank robbery'),
        say: [['Radio', 'All units: bank robbery in progress. Three stars, armed suspects.']] },
      { kind: 'goto', text: 'Drop the crew at the safehouse', x: PLACES.safehouse.x, z: PLACES.safehouse.z + 12, radius: 12,
        say: [['Crew', 'Clean getaway. You drive like the devil, Mara.']] },
    ],
    outro: [['Ivy', 'The crew speaks highly of you. Someone at the docks wants a word.']],
  },
  {
    id: 'harbor-run', title: 'Harbor Run', giver: 'Reyes', reward: 600,
    intro: [
      ['Reyes', 'Crates at the docks. My buyer waits at the garage. You have two and a half minutes.'],
      ['Reyes', 'The cargo is fragile. The buyer is not.'],
    ],
    stages: [
      { kind: 'goto', text: 'Collect the crates at the Harbor Docks', x: PLACES.docks.x, z: PLACES.docks.z, radius: 14,
        say: [['Reyes', 'Loaded. Clock is running — move!']] },
      { kind: 'timed', text: 'Deliver the crates to the garage', x: PLACES.garage.x, z: PLACES.garage.z + 12, radius: 12, time: 150,
        say: [['Reyes', 'Two minutes left. The buyer hates waiting.']] },
    ],
    outro: [['Reyes', 'On time and in one piece. The Harbor Syndicate will remember this.']],
  },
  {
    id: 'the-exchange', title: 'The Exchange', giver: 'Reyes', reward: 1200, unlock: 'shotgun',
    intro: [
      ['Reyes', 'The Syndicate set a trap at the docks. My people walked into it.'],
      ['Reyes', 'Take their briefcase back. Expect company — go in loud.'],
    ],
    stages: [
      { kind: 'goto', text: 'Reach the Harbor Docks', x: PLACES.docks.x, z: PLACES.docks.z, radius: 20,
        onStart: (s) => spawnDockGoons(s, 6),
        say: [['Goon', 'She is here! Take her down!']] },
      { kind: 'kill', text: 'Clear out the Syndicate goons', count: 6, x: PLACES.docks.x, z: PLACES.docks.z, radius: 30,
        say: [['Mara', 'That is all of them. Now the briefcase.']] },
      { kind: 'goto', text: 'Grab the briefcase', x: PLACES.docks.x + 10, z: PLACES.docks.z - 6, radius: 6,
        onStart: (s) => addHeat(s, 2, 'shootout'),
        say: [['Mara', 'Got it. Time to disappear.']] },
      { kind: 'goto', text: 'Bring the briefcase to Reyes at the diner', x: PLACES.diner.x, z: PLACES.diner.z + 12, radius: 12 },
    ],
    outro: [['Reyes', 'You just made an enemy of Victor Kroll. He runs the Syndicate — and he does not forgive.']],
  },
  {
    id: 'king-of-veloria', title: 'King of Veloria', giver: 'Reyes', reward: 2500,
    intro: [
      ['Reyes', 'Kroll is leaving town in his limo. Tonight. One convoy, one chance.'],
      ['Reyes', 'Stop the limo, take the ledger, and meet me at the pier. End this, Mara.'],
    ],
    stages: [
      { kind: 'chase', text: 'Run Kroll\'s limo off the road', radius: 0,
        onStart: (s) => spawnConvoy(s),
        say: [['Kroll', 'You again? Drivers! Lose her!']] },
      { kind: 'kill', text: 'Deal with Kroll\'s guards', count: 4, x: 0, z: 0, radius: 40, followTarget: true,
        onStart: (s) => spawnConvoyGuards(s),
        say: [['Guard', 'Protect Mr. Kroll!']] },
      { kind: 'goto', text: 'Take the ledger from the limo', x: 0, z: 0, radius: 6, followTarget: true,
        say: [['Mara', 'The ledger. Every dirty deal in Veloria.']] },
      { kind: 'goto', text: 'Meet Reyes at Sunset Pier', x: PLACES.pier.x, z: PLACES.pier.z - 20, radius: 14,
        say: [['Reyes', 'It is over, Mara. Veloria is yours now.']] },
    ],
    outro: [['Reyes', 'Kroll is finished. The harbor, the streets, the whole city — they all know your name now.']],
  },
];

function spawnTargetCar(s, model, x, z, color) {
  const car = spawnCar(s.scene, model, x, z, 0.4, 'mission', s.rng);
  car.color = color;
  s.missionData.targetCar = car;
  s.cars.push(car);
  return car;
}

function spawnCrew(s) {
  s.missionData.crew = [];
  for (let i = 0; i < 2; i += 1) {
    const ped = spawnPed(s.scene, PLACES.bank.x - 4 + i * 6, PLACES.bank.z + 10, s.rng);
    ped.state = 'wait';
    ped.waitTimer = 9999;
    s.missionData.crew.push(ped);
    s.peds.push(ped);
  }
}

function spawnDockGoons(s, n) {
  for (let i = 0; i < n; i += 1) {
    spawnGoon(s, s.scene, s.rng,
      PLACES.docks.x + s.rng.range(-22, 22),
      PLACES.docks.z + s.rng.range(-12, 12),
      { aggressive: true });
  }
  s.missionData.killTarget = n;
  s.missionData.killed = 0;
}

function spawnConvoy(s) {
  const limo = spawnCar(s.scene, 'limo', 36, -180, Math.PI / 2, 'mission', s.rng);
  limo.route = null;
  s.missionData.targetCar = limo;
  s.cars.push(limo);
  for (let i = 0; i < 2; i += 1) {
    const esc = spawnCar(s.scene, 'muscle', 36 - 10 - i * 9, -180, Math.PI / 2, 'mission', s.rng);
    s.cars.push(esc);
    s.missionData.escorts = s.missionData.escorts ?? [];
    s.missionData.escorts.push(esc);
  }
}

function spawnConvoyGuards(s) {
  const limo = s.missionData.targetCar;
  for (let i = 0; i < 4; i += 1) {
    spawnGoon(s, s.scene, s.rng, limo.x + s.rng.range(-6, 6), limo.z + s.rng.range(-6, 6), { aggressive: true, health: 90 });
  }
  s.missionData.killTarget = 4;
  s.missionData.killed = 0;
}

export function startMission(state, index) {
  const def = MISSION_DEFS[index];
  if (!def) return false;
  state.mission = { def, index, stageIndex: -1, stageTime: 0, dwell: 0, failed: false };
  state.missionData = {};
  state.dialogue = def.intro.map(([who, line]) => ({ who, line, t: 0 }));
  state.dialogueTimer = 0;
  advanceStage(state);
  return true;
}

function advanceStage(state) {
  const m = state.mission;
  m.stageIndex += 1;
  m.stageTime = 0;
  m.dwell = 0;
  const stage = m.def.stages[m.stageIndex];
  if (!stage) { completeMission(state); return; }
  if (stage.onStart) stage.onStart(state);
  if (stage.say) {
    for (const [who, line] of stage.say) state.dialogue.push({ who, line, t: 0 });
  }
  if (stage.kind === 'kill') state.missionData.killed = 0;
  state.events.push({ type: 'objective', text: stage.text });
}

export function currentObjective(state) {
  if (!state.mission) return null;
  const stage = state.mission.def.stages[state.mission.stageIndex];
  if (!stage) return null;
  let x = stage.x ?? 0;
  let z = stage.z ?? 0;
  if (stage.followTarget && state.missionData.targetCar) {
    x = state.missionData.targetCar.x;
    z = state.missionData.targetCar.z;
  }
  if (stage.kind === 'steal' && state.missionData.targetCar) {
    x = state.missionData.targetCar.x;
    z = state.missionData.targetCar.z;
  }
  if (stage.kind === 'chase' && state.missionData.targetCar) {
    x = state.missionData.targetCar.x;
    z = state.missionData.targetCar.z;
  }
  let text = stage.text;
  if (stage.kind === 'kill') text += ` (${state.missionData.killed ?? 0}/${state.missionData.killTarget ?? stage.count})`;
  if (stage.kind === 'timed') text += ` — ${Math.max(0, Math.ceil(stage.time - state.mission.stageTime))}s`;
  return { text, x, z, radius: stage.radius ?? 10, kind: stage.kind };
}

function stageComplete(state, stage) {
  const p = state.player;
  const d = state.missionData;
  switch (stage.kind) {
    case 'goto':
    case 'deliver': {
      let x = stage.x; let z = stage.z;
      if (stage.followTarget && d.targetCar) { x = d.targetCar.x; z = d.targetCar.z; }
      return Math.hypot(p.x - x, p.z - z) < stage.radius;
    }
    case 'drive':
      return p.car && Math.hypot(p.x - stage.x, p.z - stage.z) < stage.radius;
    case 'steal':
      return p.car === d.targetCar;
    case 'escape':
      return state.wanted === 0;
    case 'kill':
      return (d.killed ?? 0) >= (d.killTarget ?? stage.count);
    case 'timed':
      return Math.hypot(p.x - stage.x, p.z - stage.z) < stage.radius;
    case 'chase':
      return d.targetCar && d.targetCar.damage >= 80;
    default:
      return false;
  }
}

function stageFailed(state, stage) {
  const d = state.missionData;
  if (stage.kind === 'timed' && state.mission.stageTime > stage.time) return 'Out of time.';
  if ((stage.kind === 'deliver' || stage.kind === 'steal') && d.targetCar && d.targetCar.dead) return 'The car was destroyed.';
  if (stage.kind === 'chase' && d.targetCar && d.targetCar.dead) return 'The limo was destroyed — Kroll escaped in the chaos.';
  return null;
}

export function updateMissions(state, dt) {
  const m = state.mission;
  if (!m || m.failed) return;
  const stage = m.def.stages[m.stageIndex];
  if (!stage) return;
  m.stageTime += dt;
  // Convoy driving: the limo flees along the roads.
  const limo = state.missionData.targetCar;
  if (limo && m.def.id === 'king-of-veloria' && stage.kind === 'chase' && !limo.dead) {
    const p = state.player;
    const away = Math.atan2(limo.x - p.x, limo.z - p.z);
    limo.heading += (away - limo.heading) * Math.min(1, dt * 0.8);
    limo.speed += (26 - limo.speed) * Math.min(1, dt);
    limo.x += Math.sin(limo.heading) * limo.speed * dt;
    limo.z += Math.cos(limo.heading) * limo.speed * dt;
  }
  // Dwell stages: stand in the marker for a few seconds.
  if (stage.dwell) {
    if (Math.hypot(state.player.x - stage.x, state.player.z - stage.z) < stage.radius) {
      m.dwell += dt;
      if (m.dwell >= stage.dwell) {
        // Crew gets in the car.
        for (const ped of state.missionData.crew ?? []) { ped.dead = true; ped.mesh.visible = false; }
        advanceStage(state);
      }
      return;
    }
    m.dwell = 0;
  }
  const fail = stageFailed(state, stage);
  if (fail) { failMission(state, fail); return; }
  if (stageComplete(state, stage)) advanceStage(state);
}

export function onGoonDown(state) {
  if (!state.mission) return;
  state.missionData.killed = (state.missionData.killed ?? 0) + 1;
}

function completeMission(state) {
  const m = state.mission;
  const def = m.def;
  state.cash += def.reward;
  state.save.missionsDone.push(def.id);
  state.save.missionIndex = Math.max(state.save.missionIndex, m.index + 1);
  state.save.stats.missionsDone += 1;
  if (def.unlock && !state.save.ownedWeapons.includes(def.unlock)) {
    state.save.ownedWeapons.push(def.unlock);
    state.player.ammo[def.unlock] = def.unlock === 'smg' ? 96 : 24;
  }
  state.dialogue = def.outro.map(([who, line]) => ({ who, line, t: 0 }));
  state.mission = null;
  state.missionData = {};
  state.events.push({ type: 'missionPass', title: def.title, reward: def.reward });
}

export function failMission(state, reason) {
  const m = state.mission;
  if (!m) return;
  state.mission = null;
  state.missionData = {};
  state.events.push({ type: 'missionFail', title: m.def.title, reason });
}

/** Can the player start the next story mission here? (at the garage, on foot) */
export function missionStartAvailable(state) {
  if (state.mission) return false;
  const idx = state.save.missionIndex;
  if (idx >= MISSION_DEFS.length) return false;
  const p = state.player;
  return p.onFoot && Math.hypot(p.x - PLACES.garage.x, p.z - PLACES.garage.z) < 18;
}

export function nextMissionTitle(state) {
  const def = MISSION_DEFS[state.save.missionIndex];
  return def ? `${def.title} — ${def.giver}` : null;
}
