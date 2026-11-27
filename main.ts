// Sky Courier — entrypoint for the make.fun "best flight game" bounty (program/v1).
//
// Sky Courier is a 3D arcade flight game that runs entirely in the browser:
// the whole game lives in this directory's game/ folder as plain static files
// (game/index.html plus its ES modules under game/src/ and a vendored
// three.js under game/vendor/, no build step, no network requests), and this
// program is what hands the entry in. Running it copies game/ and
// screenshots/ from beside this file into the output directory and writes
// dossier.json there — the summary the judge reads — using the vendored
// make.fun library in vendor/makefun-game.ts.
//
// Version 3 of the game: the player flies a little orange cargo plane around
// an island archipelago — dawn, noon and dusk sorties over one terrain —
// threading glowing rings in combo chains, skimming rings and treetops
// for near-miss bonuses, hauling cargo that bends the flight model,
// leaning against a gusting crosswind and visible rain in the storm, and
// landing on the runway to bank the score for hangar upgrades. The home
// island is a lived-in place now — crop fields, a village, dirt roads —
// and the sun throws real shadows across all of it. The game's own
// source is split into single-job modules: flightmodel.js integrates
// the physics, missions.js judges rings, near misses, damage and
// touchdown quality, weather.js owns the hours, the wind and the rain,
// scenery.js builds the fields, village and roads, upgrades.js the
// hangar, effects.js the particles, world.js the archipelago, hud.js
// the instruments, and game.js wires them together frame by frame.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The copy is a plain file copy and the dossier is derived only from file contents,
// so two runs over the same tree produce byte-identical output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
