// Sky Courier — deterministic screenshot scenes behind ?shot=<name>&seed=N.
// Each scene sets the game to a real moment a player would see — title over
// the parked plane, a ring pass mid-flight, final approach to the runway,
// the sortie-complete screen — so the composed frame is identical on every
// run and shows the game at its best. Nothing here animates: the boot
// module paints the staged frame a few times and stops.
import { PHASE } from './game.js';
import { WORLD } from './config.js';

/** Title screen: plane parked on the runway, first sortie selected. */
function stageStart(game) {
  game.resetToTitle();
  game.phase = PHASE.TITLE;
  // Park the camera's orbit at a flattering angle (the loop still advances
  // a few frames, so the orbit barely moves from here).
  game.position = { x: WORLD.runway.x, y: 27, z: WORLD.runway.z + 120 };
  game.placePlane();
  return game;
}

/** Mid-flight: banking through the second ring, HUD lit, sea and islands below. */
function stagePlay(game) {
  game.startSortie(0);
  // Put the plane just past the first ring, banked into the second.
  const ring = game.sortie.rings[1];
  game.ringsPassed = 1;
  game.score = 250;
  game.world.setNextRing(1, 1);
  game.position = { x: ring[0] + 55, y: ring[1] + 12, z: ring[2] + 95 };
  game.heading = Math.atan2(-(ring[0] - game.position.x), -(ring[2] - game.position.z));
  game.pitch = 0.08;
  game.bank = 0.55;
  game.speed = 68;
  game.throttle = 0.8;
  game.fuel = 78;
  game.timeLeft = 187;
  game.timeFlown = 53;
  game.showMessage('Ring 2/6  +150', 10);
  game.placePlane();
  return game;
}

/** Final approach: low over the sea, runway ahead, gear down, HUD lit. */
function stageApproach(game) {
  game.startSortie(0);
  game.ringsPassed = 6;
  game.score = 1450;
  game.perfectRings = 2;
  game.world.setNextRing(6, 6);
  game.position = { x: 18, y: 62, z: WORLD.runway.z + 520 };
  game.heading = 0;
  game.pitch = -0.06;
  game.bank = 0.02;
  game.speed = 30;
  game.throttle = 0.25;
  game.fuel = 41;
  game.timeLeft = 96;
  game.timeFlown = 144;
  game.showMessage('All rings flown — land on the runway to finish!', 10);
  game.placePlane();
  return game;
}

/** Sortie complete: the results screen over the parked plane. */
function stageEnd(game) {
  game.startSortie(0);
  game.ringsPassed = 6;
  game.perfectRings = 3;
  game.score = 2840;
  game.fuel = 38;
  game.timeLeft = 74;
  game.timeFlown = 166;
  game.position = { x: WORLD.runway.x, y: 27, z: WORLD.runway.z + 40 };
  game.speed = 0;
  game.throttle = 0;
  game.landed = true;
  game.world.setNextRing(6, 6);
  game.endSortie(PHASE.LANDED, 'Sortie complete — welcome home.');
  game.placePlane();
  return game;
}

/** Set the game to the named scene. Unknown names fall back to the title. */
export function stageShot(name, game) {
  if (name === 'play') return stagePlay(game);
  if (name === 'approach') return stageApproach(game);
  if (name === 'end') return stageEnd(game);
  return stageStart(game);
}
