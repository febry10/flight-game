// Sky Courier — deterministic screenshot scenes behind ?shot=<name>&seed=N.
// Each scene sets the game to a real moment a player would see — a low
// dawn pass over the village and fields toward the first ring, the storm
// sortie banked over the snowy mountain island with damage smoke and
// rain, a noon final approach down the runway light line, and the
// results screen with the plane parked by the hangar — so the composed
// frame is identical on every run and shows the game at its best.
// Nothing here animates: the boot module paints the staged frame a few
// times and stops.
import { PHASE } from './game.js';
import { WORLD } from './config.js';
import { terrainHeight } from './world.js';

/** Cover: a low dawn pass in chase view — village and crop fields
    below, the runway ahead, the first green ring beyond it, every
    instrument lit. The boot module pushes the camera in for the
    poster framing. */
function stageStart(game) {
  game.startSortie(0);
  game.position = { x: 170, y: 60, z: 430 };
  game.heading = 0.34;
  game.pitch = 0.05;
  game.bank = 0.06;
  game.speed = 58;
  game.throttle = 0.8;
  game.fuel = 96;
  game.timeFlown = 12;
  game.timeLeft = 228;
  game.showMessage('Island Hop — fly through the green ring!', 10);
  game.placePlane();
  return game;
}

/** The storm sortie at dusk: banked over the mountain island toward
    the fourth ring, combo running, damage smoke trailing, rain
    falling, the crosswind up. */
function stagePlay(game) {
  game.startSortie(2);
  const ring = game.sortie.rings[3];
  game.ringsPassed = 3;
  game.score = 2650;
  game.perfectRings = 1;
  game.nearMisses = 2;
  game.comboCount = 3;
  game.bestCombo = 3;
  game.comboTimer = 20;
  game.damage = 46;
  game.world.setNextRing(3, 3);
  // Approach the mountain ring from the north, so the island's snowy
  // massif fills the lower frame ahead instead of open sea.
  game.position = { x: ring[0] - 120, y: ring[1] - 35, z: ring[2] - 340 };
  game.heading = Math.atan2(-(ring[0] - game.position.x), -(ring[2] - game.position.z));
  game.pitch = -0.04;
  game.bank = 0.5;
  game.speed = 74;
  game.throttle = 0.85;
  game.fuel = 34;
  game.timeFlown = 150;
  game.timeLeft = 180;
  game.wind.push = { x: 9.4, z: 3.3 };
  game.showMessage("NEAR MISS! +50 — threaded the ring's edge!", 10);
  game.placePlane();
  // The staged frame never runs the effects step, so lay the damage
  // smoke trail by hand: a line of dark puffs behind the plane,
  // growing, thinning and curling upward the way the live trail does,
  // big enough to read against the sea and sky.
  if (game.effects) {
    // Lay the trail along the arc the banked plane has just flown: a
    // straight trail would hide along the chase camera's axis, but
    // the curved one streams out beside the plane where a still can
    // read it. Past headings unwind the banked turn step by step.
    let px = game.position.x;
    let py = game.position.y;
    let pz = game.position.z;
    for (let i = 1; i <= 22; i++) {
      const pastHeading = game.heading - i * 0.055;
      px += Math.sin(pastHeading) * 3.4;
      pz += Math.cos(pastHeading) * 3.4;
      py += 0.45;
      game.effects.spawn(px, py + 0.6, pz, {
        color: 0x1a1a1e,
        scale: 3.2 + i * 0.38,
        life: 1,
        opacity: 0.62 - i * 0.016,
      });
    }
  }
  return game;
}

/** Final approach at noon: every parcel delivered, low on the glide
    path with the runway, its edge lights and the PAPI row filling
    the view ahead. */
function stageApproach(game) {
  game.startSortie(1);
  game.ringsPassed = 8;
  game.score = 3100;
  game.perfectRings = 3;
  game.nearMisses = 1;
  game.bestCombo = 4;
  game.world.setNextRing(8, 8);
  game.position = { x: 10, y: 41, z: WORLD.runway.z + 300 };
  game.heading = 0;
  game.pitch = -0.04;
  game.bank = 0.01;
  game.speed = 29;
  game.throttle = 0.3;
  game.fuel = 22;
  game.verticalSpeed = -1.6;
  game.timeFlown = 210;
  game.timeLeft = 90;
  game.showMessage('All parcels delivered — land on the runway!', 10);
  game.placePlane();
  return game;
}

/** Sortie complete: the results screen over the plane parked beside
    the hangar — score, touchdown grade, best combo, near misses and
    the hangar bank all on show. */
function stageEnd(game) {
  game.startSortie(1);
  game.ringsPassed = 8;
  game.perfectRings = 3;
  game.nearMisses = 2;
  game.bestCombo = 5;
  game.score = 3950;
  game.fuel = 19;
  game.timeLeft = 41;
  game.timeFlown = 259;
  game.landingQuality = 'SMOOTH';
  // Parked on the runway shoulder, nose swung toward the hangar: from
  // the chase view the strip runs diagonally behind the results panel
  // and the hangar and fields edge the frame.
  const parkX = WORLD.runway.x + 20;
  const parkZ = WORLD.runway.z + 80;
  game.position = { x: parkX, y: terrainHeight(parkX, parkZ) + 2.2, z: parkZ };
  game.heading = 0.5;
  game.speed = 0;
  game.throttle = 0;
  game.landed = true;
  game.world.setNextRing(8, 8);
  game.endSortie(PHASE.LANDED, 'Touchdown: SMOOTH — every parcel delivered. Welcome home.');
  game.placePlane();
  return game;
}

/** Set the game to the named scene. Unknown names fall back to the cover. */
export function stageShot(name, game) {
  if (name === 'play') return stagePlay(game);
  if (name === 'approach') return stageApproach(game);
  if (name === 'end') return stageEnd(game);
  return stageStart(game);
}
