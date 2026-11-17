# VELORIA — Harbor Heat · an open-world crime game in three.js

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/HisyamMahfuDz/veloria-harbor-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/HisyamMahfuDz/veloria-harbor-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime story set in **Veloria**, a sun-soaked coastal
city. You are Mara Quinn, a getaway driver. Run missions for garage owner Ivy
Chen and dock fixer Reyes, steal and drive cars, dodge the VPD wanted system,
and take the city back from the Harbor Syndicate — all in a desktop browser,
offline, with no build step.

Nothing in the game comes from any commercial game: the city, characters,
vehicles, names, story, art and music are all original and procedural.

## How to run

```sh
node serve.ts --port 8080
```

Then open http://localhost:8080/ in a desktop browser with WebGL2. No build
step, no network requests at runtime — three.js 0.187.0 is vendored under
`game/vendor/three/`, all art is procedural geometry plus canvas textures, and
all audio is synthesized with WebAudio.

## Controls

| Key | Action |
| --- | ------ |
| W A S D | Move / drive |
| Mouse | Look · Click: shoot / punch / horn (in a car) |
| Shift | Sprint / handbrake |
| Space | Jump / brake |
| E | Enter / exit car · steal |
| F | Punch |
| R | Reload |
| 1 / 2 / 3 | Fists · pistol · SMG / shotgun |
| Q | Talk · start mission · buy / eat |
| M | Music on / off |
| P / Esc | Pause |

## What is in the game

- **Open world.** A 7×7-block procedural city with a beach, a pier and a
  working ferris wheel, a harbor with docks and boats, hills, palms,
  streetlights, named landmarks (casino, bank, hotel, hospital, VPD Central,
  diner, mall, gun shop, respray garage), traffic that follows the road grid,
  and pedestrians who stroll, wait and flee.
- **Driving.** Arcade car physics with steering, drift and handbrake, 8 car
  models (sedan, coupe, muscle, taxi, van, truck, police interceptor, limo),
  damage, smoke and explosions, collisions with the city and other cars, and
  any parked or traffic car stealable with E.
- **Wanted system.** Five stars. Crimes witnessed by pedestrians or police
  raise the heat; interceptors chase and ram, foot cops close in and bust,
  and the level falls when the player breaks line of sight. Sunshine Respray
  clears the heat and repairs the car for $250.
- **Story: 6 missions.** First Fare, Hot Property, The Getaway, Harbor Run,
  The Exchange and King of Veloria — with dialogue, objective markers, a
  3D beacon, timers, chases, shootouts and a finale convoy takedown.
  Missions start at Ivy's Garage with Q; progress, cash and unlocks save
  automatically in the browser.
- **Combat.** Hitscan shooting with headshots, three firearms plus fists,
  magazines and reloads, tracers, muzzle flashes, hit effects, and Syndicate
  goons who strafe, advance and shoot back.
- **Activities & progression.** Taxi fares, 10 hidden packages, a gun shop
  (ammo, armor, shotgun), a diner that restores health, cash, ranks from
  Wheelman to King of Veloria, and lifetime stats on the pause screen.
- **Feel & polish.** Third-person camera with mouse orbit and collision
  pull-in, a circular live minimap with blips, wanted stars, health/armor,
  speed and ammo HUD, dialogue subtitles, banners, screen shake, particles,
  a title screen, pause and help menus, busted/wasted flow, and a
  synthesized score (engine, sirens, gunfire, music loop).

## Layout

```
main.ts            entrypoint: copies game/ + screenshots/ to the output dir
                   and writes dossier.json via vendor/makefun-game.ts
serve.ts           static dev server (node serve.ts --port 8080)
game/index.html    import map, HUD DOM, styles
game/src/          one-job ES modules, no build step
  config.js        tuning, palette, places, ranks, weapons, controls
  random.js        seeded RNG (mulberry32)
  textures.js      procedural canvas textures (windows, roads, signs, sky)
  input.js         keyboard + mouse, pointer lock, drag-to-look fallback
  audio.js         synthesized SFX and music (WebAudio, no files)
  save.js          localStorage save/load
  city.js          procedural city, road graph, colliders, raycasts
  vehicles.js      car models, arcade physics, traffic AI, collisions
  pedestrians.js   sidewalk walkers, flee behaviour, character rigs
  player.js        on-foot movement, jump, punch, enter/exit car
  police.js        wanted system, interceptors, foot cops, bust, respray
  enemies.js       Syndicate goon AI (strafe, advance, shoot)
  combat.js        hitscan firing path shared by player, cops and goons
  effects.js       particles, tracers, beacon, camera shake
  missions.js      6-mission story: stages, dialogue, spawns, rewards
  hud.js           DOM HUD, minimap, banners, menus
  world.js         simulation orchestration, events, taxi, packages, shops
  render.js        renderer, sky, golden-hour light, third-person camera
  shots.js         deterministic staged frames for screenshots (?shot=…)
game/vendor/three/ three.js 0.187.0 (minified module + core builds)
screenshots/       4 captured frames (1280×720 JPEG)
```

## Architecture notes

- The simulation runs at a fixed 60 Hz, decoupled from rendering; the
  renderer only syncs the view from state.
- One firing path (`fireShot`) serves the player, the cops and the goons, so
  the rules the player feels are the rules the AI plays by.
- Traffic follows Manhattan routes over the road graph with car-ahead
  braking; pedestrians walk sidewalk targets and flee threats.
- The wanted system is line-of-sight based: police that cannot see the
  player cannot hold the heat, and the respray shop is the paid way out.

## Screenshots

The four frames in `screenshots/` were captured from the running game in
headless Chrome (SwiftShader, WebGL2) via deterministic staged scenes:

- `1-chase.jpg` — police chase at 79 mph: interceptors, wanted level, minimap, mission objective
- `2-street.jpg` — on foot outside Rosa's Diner: pedestrians, taxi, dialogue, shop prompt
- `3-mission.jpg` — The Exchange shootout at the docks: goons, crates, beacon, SMG
- `4-title.jpg` — title screen over the city vista

The same scenes can be reproduced live with
`?shot=cover|street|mission|title&seed=7` (see `shots.json` and
`game/src/shots.js`).

## License

MIT — see LICENSE.

---

<sub>Entered on [make.fun](https://make.fun/?ref=0a6j83jv&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
