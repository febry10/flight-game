// Sky Courier — weather: the time-of-day looks and the storm wind.
// Each sortie flies at its own hour — Island Hop at dawn, Parcel Run at
// noon, Storm Circuit at dusk — and the world recolours itself to match:
// sky gradient, fog, sun position and colour, sea tone. The storm sortie
// also gets a gusting crosswind the flight model has to lean against.
import { WIND } from './config.js';
import { clamp } from './random.js';

// One palette per hour. `sun` is a direction the directional light and
// the sun disc share; `sunDisc` is where the visible disc hangs.
export const TIME_OF_DAY = {
  dawn: {
    skyTop: 0x39548c,
    skyBottom: 0xffd9a3,
    fog: 0xf0d3ac,
    sea: 0x35748f,
    sunColour: 0xffc98a,
    sunIntensity: 1.35,
    hemiSky: 0xffe3c0,
    hemiGround: 0x51683f,
    hemiIntensity: 0.8,
    sunPosition: { x: 1900, y: 620, z: -900 },
    exposure: 1.02,
  },
  noon: {
    skyTop: 0x2f6fb8,
    skyBottom: 0xbfe3f2,
    fog: 0xcfe8f2,
    sea: 0x2e7f9e,
    sunColour: 0xfff2d0,
    sunIntensity: 1.6,
    hemiSky: 0xcfe8ff,
    hemiGround: 0x4a7a4a,
    hemiIntensity: 0.95,
    sunPosition: { x: -1200, y: 1900, z: -800 },
    exposure: 1.05,
  },
  dusk: {
    skyTop: 0x2c3a6e,
    skyBottom: 0xff9a5c,
    fog: 0xdfa37e,
    sea: 0x2b6a8c,
    sunColour: 0xff8a4a,
    sunIntensity: 1.15,
    hemiSky: 0xd9a37e,
    hemiGround: 0x3d4a35,
    hemiIntensity: 0.85,
    sunPosition: { x: -2100, y: 480, z: 700 },
    exposure: 0.98,
  },
};

/** The palette for a sortie's hour, falling back to noon. */
export function paletteFor(sortie) {
  return TIME_OF_DAY[sortie.tod] || TIME_OF_DAY.noon;
}

/**
 * The gusting crosswind of the storm sortie. `update` advances the gust
 * cycle; `push` is the current wind vector in m/s the flight model adds
 * to the plane's ground track, and `strength` (0..1) drives the HUD's
 * wind gauge and the buffet shake.
 */
export class Wind {
  constructor(active) {
    this.active = active;
    this.time = 0;
    this.push = { x: 0, z: 0 };
    this.strength = 0;
  }

  update(dt) {
    if (!this.active) {
      this.push.x = 0;
      this.push.z = 0;
      this.strength = 0;
      return;
    }
    this.time += dt;
    const swell = 0.5 + 0.5 * Math.sin((this.time / WIND.gustPeriod) * Math.PI * 2);
    const flutter = 0.85 + 0.15 * Math.sin(this.time * 2.7);
    const speed = (WIND.baseSpeed + WIND.gustSpeed * swell) * flutter;
    const len = Math.hypot(WIND.direction.x, WIND.direction.z);
    this.push.x = (WIND.direction.x / len) * speed;
    this.push.z = (WIND.direction.z / len) * speed;
    this.strength = clamp(speed / (WIND.baseSpeed + WIND.gustSpeed), 0, 1);
  }

  /** Wind speed in knots, for the HUD gauge. */
  get knots() {
    return Math.round(Math.hypot(this.push.x, this.push.z) * 1.94);
  }
}
