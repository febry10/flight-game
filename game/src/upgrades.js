// Sky Courier — hangar upgrades, bought with banked score.
// Every sortie's score is banked when it ends; between sorties the pilot
// can spend the bank on the plane: a tuned engine, a bigger tank, a
// feathering prop. Levels and the bank persist in localStorage next to
// the best scores. This module owns the catalogue and the arithmetic;
// the game asks it for the plane's effective numbers.
import { PLANE } from './config.js';

export const UPGRADES = [
  {
    id: 'engine',
    name: 'Engine tune',
    blurb: '+6% top speed, +8% climb power per level',
    costs: [300, 650],
  },
  {
    id: 'tank',
    name: 'Long-range tank',
    blurb: '+15 fuel at takeoff per level',
    costs: [250, 550],
  },
  {
    id: 'prop',
    name: 'Feathering prop',
    blurb: '−8% drag, −6% fuel burn per level',
    costs: [250, 550],
  },
];

const STORE_KEY = 'sky-courier-hangar';

export function loadHangar() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { bank: parsed.bank || 0, levels: parsed.levels || {} };
    }
  } catch {
    // Storage unavailable: the hangar just starts empty.
  }
  return { bank: 0, levels: {} };
}

export function saveHangar(hangar) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(hangar));
  } catch {
    // Ignore persistence failures.
  }
}

export function upgradeLevel(hangar, id) {
  return hangar.levels[id] || 0;
}

/** Cost of the next level of an upgrade, or null when it is maxed. */
export function nextCost(hangar, id) {
  const def = UPGRADES.find((u) => u.id === id);
  const level = upgradeLevel(hangar, id);
  return level < def.costs.length ? def.costs[level] : null;
}

/** Try to buy the next level; returns true when the purchase went through. */
export function buyUpgrade(hangar, id) {
  const cost = nextCost(hangar, id);
  if (cost === null || hangar.bank < cost) return false;
  hangar.bank -= cost;
  hangar.levels[id] = upgradeLevel(hangar, id) + 1;
  saveHangar(hangar);
  return true;
}

/**
 * The plane's effective flight numbers for a sortie: base PLANE figures
 * bent by the hangar upgrades and by the sortie's cargo load. Cargo makes
 * her heavier — slower to accelerate, wider to turn, quicker to stall —
 * which is the Parcel Run's whole problem.
 */
export function effectivePlane(sortie, hangar) {
  const engine = upgradeLevel(hangar, 'engine');
  const prop = upgradeLevel(hangar, 'prop');
  const cargoFactor = 1 - Math.min(0.3, (sortie.cargo || 0) / 900);
  return {
    ...PLANE,
    maxSpeed: PLANE.maxSpeed * (1 + 0.06 * engine),
    throttleAccel: PLANE.throttleAccel * (1 + 0.08 * engine) * cargoFactor,
    drag: PLANE.drag * (1 - 0.08 * prop),
    fuelBurn: PLANE.fuelBurn * (1 - 0.06 * prop),
    fuelBurnIdle: PLANE.fuelBurnIdle * (1 - 0.06 * prop),
    turnFromBank: PLANE.turnFromBank * (0.75 + 0.25 * cargoFactor),
    minFlySpeed: PLANE.minFlySpeed + (sortie.cargo || 0) / 60,
    gravitySink: PLANE.gravitySink / cargoFactor,
    fuelBonus: 15 * upgradeLevel(hangar, 'tank'),
  };
}
