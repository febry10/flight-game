// Sky Courier — deterministic screenshot scenes behind ?shot=<name>&seed=N.
// Each scene sets the game to a real moment a player would see — a dawn
// takeoff in chase view with the runway and the first ring ahead, the
// storm sortie mid-combo with damage and fuel on the gauges, a noon
// final approach lined up on the strip, and the results screen with the
// touchdown grade — so the composed frame is identical on every run and
// shows the game at its best. Nothing here animates: the boot module
// paints the staged frame a few times and stops.
import { PHASE } from './game.js';
import { WORLD } from './config.js';

/** Cover: just airborne at dawn, low chase view — the runway ahead
    below, the first green ring beyond it, every instrument lit. */
function stageStart(game) {
  game.startSortie(0);
  game.position = { x: 24, y: 78, z: WORLD.runway.z + 390 };
  game.heading = 0.04;
  game.pitch = 0.06;
  game.bank = 0.05;
  game.speed = 55;
  game.throttle = 0.75;
  game.fuel = 96;
  game.timeFlown = 12;
  game.timeLeft = 228;
  game.showMessage('Island Hop — fly through the green ring!', 10);
  game.placePlane();
  return game;
}

/** The storm sortie at dusk: banked onto the fifth ring, combo running,
    damage and low fuel on the gauges, the crosswind up. */
function stagePlay(game) {
  game.startSortie(2);
  const ring = game.sortie.rings[4];
  game.ringsPassed = 4;
  game.score = 2650;
  game.perfectRings = 1;
  game.comboCount = 3;
  game.bestCombo = 3;
  game.comboTimer = 20;
  game.damage = 46;
  game.world.setNextRing(4, 4);
  game.position = { x: ring[0] - 250, y: ring[1] + 15, z: ring[2] + 130 };
  game.heading = Math.atan2(-(ring[0] - game.position.x), -(ring[2] - game.position.z));
  game.pitch = 0.02;
  game.bank = 0.5;
  game.speed = 74;
  game.throttle = 0.85;
  game.fuel = 34;
  game.timeFlown = 150;
  game.timeLeft = 180;
  game.wind.push = { x: 9.4, z: 3.3 };
  game.showMessage('COMBO ×1.75 — keep her out of the clouds!', 10);
  game.placePlane();
  return game;
}

/** Final approach at noon: every parcel delivered, lined up on the
    runway with the strip filling the view ahead. */
function stageApproach(game) {
  game.startSortie(1);
  game.ringsPassed = 8;
  game.score = 3100;
  game.perfectRings = 3;
  game.bestCombo = 4;
  game.world.setNextRing(8, 8);
  game.position = { x: 12, y: 52, z: WORLD.runway.z + 430 };
  game.heading = 0;
  game.pitch = -0.05;
  game.bank = 0.01;
  game.speed = 31;
  game.throttle = 0.3;
  game.fuel = 22;
  game.verticalSpeed = -1.6;
  game.timeFlown = 210;
  game.timeLeft = 90;
  game.showMessage('All parcels delivered — land on the runway!', 10);
  game.placePlane();
  return game;
}

/** Sortie complete: the results screen over the parked plane — score,
    touchdown grade, best combo and the hangar bank all on show. */
function stageEnd(game) {
  game.startSortie(1);
  game.ringsPassed = 8;
  game.perfectRings = 3;
  game.bestCombo = 5;
  game.score = 3950;
  game.fuel = 19;
  game.timeLeft = 41;
  game.timeFlown = 259;
  game.landingQuality = 'SMOOTH';
  game.position = { x: WORLD.runway.x, y: 27, z: WORLD.runway.z + 40 };
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
