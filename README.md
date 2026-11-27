# flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/febry10/flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/febry10/flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Sky Courier — a 3D arcade flight game: fly a little orange cargo plane around an island archipelago, thread glowing rings, mind your fuel and the storm clouds, and land back on the runway to bank your score. Three sorties (Island Hop, Parcel Run, Storm Circuit) with different ring courses, timers and weather — each at its own hour of day (dawn, noon, dusk) and the storm sortie under a gusting crosswind with visible rain. Chained rings build a combo multiplier, threading a ring's edge or skimming the treetops pays a near-miss bonus, cargo weight bends the flight model, every touchdown is graded SMOOTH / FIRM / HARD, and banked score buys hangar upgrades (engine tune, long-range tank, feathering prop) between sorties. The home island is a lived-in place — crop fields, a village with a church, dirt roads — and the sun throws real shadows across all of it; the runway has edge lights and a PAPI row for the approach. Chase camera with a speed FOV kick and stall buffet, live instruments (speed, altitude, heading, throttle, fuel, damage, combo, wind), minimap chart, synthesised engine/wind/ring sounds, keyboard + touch controls. Runs entirely offline in a desktop browser; Three.js is vendored under game/vendor/.

The source is split into single-job modules under game/src/: the flight model (flightmodel.js), mission rules — rings, near misses, damage, landings (missions.js), camera (camera.js), weather, time of day and rain (weather.js), home-island scenery (scenery.js), hangar upgrades (upgrades.js), particle effects (effects.js), the world (world.js), the HUD (hud.js) and the game orchestration (game.js).

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — click a sortie and fly: W/S pitch, A/D bank, Shift/Ctrl throttle, Space airbrake, P pause, M mute.

---

<sub>Entered on [make.fun](https://make.fun/?ref=xttqesbf&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
