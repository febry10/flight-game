// Sky Courier — shared constants for the flight game.
// One place for every number the game balances on, so a tweak here retunes
// the whole game: the world, the plane, the sorties and the scoring.
export const WORLD = {
  size: 4200, // world spans -size/2 .. size/2 on x and z
  seaLevel: 0,
  maxTerrainHeight: 170,
  // Islands: [x, z, radius, height] — hand-placed so the runway island, the
  // ring circuit and the mountain peaks read as one archipelago.
  islands: [
    { x: 0, z: 0, r: 620, h: 46 }, // home island, holds the runway
    { x: -1150, z: -750, r: 520, h: 95 }, // green island, west
    { x: 1250, z: -900, r: 560, h: 150 }, // mountain island, north-east
    { x: 1150, z: 950, r: 480, h: 70 }, // palm island, south-east
    { x: -1250, z: 900, r: 430, h: 120 }, // crag island, south-west
    { x: 300, z: -1500, r: 380, h: 88 }, // far north islet, holds the lighthouse
    { x: -500, z: 1500, r: 360, h: 60 }, // far south islet
  ],
  runway: { x: 0, z: -60, heading: 0, length: 420, width: 34 }, // north-south strip
  cloudCount: 26,
  cloudMinY: 260,
  cloudMaxY: 420,
};

export const PLANE = {
  cruiseSpeed: 62, // m/s at full throttle, level
  maxSpeed: 95,
  minFlySpeed: 26, // below this the plane stalls and sinks
  throttleAccel: 26,
  drag: 0.22,
  pitchRate: 0.85, // rad/s
  bankRate: 1.5, // rad/s
  turnFromBank: 0.55, // yaw rate per radian of bank
  climbFromPitch: 1.0,
  gravitySink: 9, // m/s sink when stalled
  fuelCapacity: 100,
  fuelBurn: 0.55, // per second at full throttle
  fuelBurnIdle: 0.12,
  maxDamage: 100,
  propRadius: 2.2,
};

export const RING = {
  radius: 26,
  tube: 2.2,
  passScore: 150,
  perfectScore: 250, // through the centre (within 8 m of centre)
  timeBonus: 6, // seconds added per ring on timed sorties
  fuelBonus: 6,
};

// Combo: consecutive rings flown without taking damage raise a score
// multiplier. The chain survives for COMBO.windowSeconds after each ring;
// storm damage or a long gap resets it. Multiplier grows a quarter step
// per chained ring, capped at COMBO.maxMultiplier.
export const COMBO = {
  windowSeconds: 24,
  stepPerRing: 0.25,
  maxMultiplier: 3,
};

// Wind: only the storm sortie has real wind. A steady push from the west
// plus gusts that swell and fade on a slow sine, so the pilot has to hold
// a crab angle on the ring line and on final approach.
export const WIND = {
  direction: { x: 1, z: 0.35 }, // blowing toward +x (from the west)
  baseSpeed: 5, // m/s of steady push
  gustSpeed: 9, // extra m/s at the top of a gust
  gustPeriod: 11, // seconds per gust swell
};

// Landing quality, judged at touchdown from airspeed and sink rate.
// The readout (SMOOTH / FIRM / HARD) and its bonus land in the results.
export const LANDING = {
  smooth: { maxSpeed: 24, maxSink: 2.5, bonus: 700, label: 'SMOOTH' },
  firm: { maxSpeed: 31, maxSink: 5, bonus: 400, label: 'FIRM' },
  hard: { bonus: 150, label: 'HARD' },
};

// Three sorties, each a different way to fly the same archipelago.
// Rings are [x, y, z] waypoints; the sortie ends when the last ring is flown
// and the plane lands back on the runway (or the timer / fuel runs out).
// `tod` picks the time-of-day look, `cargo` is the load in kilograms the
// flight model feels, `wind` turns on the gusting crosswind.
export const SORTIES = [
  {
    id: 'island-hop',
    name: 'Island Hop',
    brief:
      'Fly the ring circuit around the islands and bring her home. 6 rings, then land on the runway.',
    rings: [
      [0, 150, -700],
      [-700, 180, -750],
      [-1150, 220, -200],
      [-900, 200, 700],
      [0, 160, 1100],
      [900, 200, 600],
    ],
    timeLimit: 240,
    fuel: 100,
    clouds: 6,
    storm: false,
    tod: 'dawn',
    cargo: 0,
    wind: false,
  },
  {
    id: 'parcel-run',
    name: 'Parcel Run',
    brief:
      'Eight drop rings, one fuel tank, no second chances. Thread the mountains and deliver every parcel.',
    rings: [
      [0, 150, -700],
      [500, 260, -1250],
      [1250, 320, -900],
      [1250, 240, -200],
      [1150, 180, 950],
      [300, 200, 1400],
      [-700, 260, 1250],
      [-1250, 300, 400],
    ],
    timeLimit: 300,
    fuel: 85,
    clouds: 12,
    storm: false,
    tod: 'noon',
    cargo: 140,
    wind: false,
  },
  {
    id: 'storm-circuit',
    name: 'Storm Circuit',
    brief:
      'Ten rings in a rising storm. Clouds drift across the course — clip one and she takes damage. Land her home.',
    rings: [
      [0, 150, -700],
      [-600, 240, -1100],
      [300, 300, -1500],
      [1250, 340, -900],
      [1400, 260, 0],
      [1150, 200, 950],
      [0, 220, 1300],
      [-900, 280, 1100],
      [-1250, 320, 300],
      [-700, 220, -500],
    ],
    timeLimit: 330,
    fuel: 100,
    clouds: 20,
    storm: true,
    tod: 'dusk',
    cargo: 60,
    wind: true,
  },
];

export const SCORE = {
  ring: RING.passScore,
  perfectRing: RING.perfectScore,
  landing: LANDING.firm.bonus,
  smoothLanding: LANDING.smooth.bonus,
  hardLanding: LANDING.hard.bonus,
  parcel: 100,
  timeBonusPerSecond: 5,
  fuelBonusPerUnit: 4,
};

export const COLOURS = {
  skyTop: 0x2f6fb8,
  skyBottom: 0xbfe3f2,
  sea: 0x2e7f9e,
  seaDeep: 0x1d5a78,
  sand: 0xe8d49a,
  grass: 0x5da24a,
  grassDark: 0x3f7d33,
  rock: 0x8a7f72,
  snow: 0xf2f5f7,
  runway: 0x3a3f46,
  runwayMark: 0xf5f2e8,
  planeBody: 0xe8542f,
  planeWing: 0xf5f2e8,
  planeTrim: 0x1f3a5f,
  ring: 0xffc233,
  ringNext: 0x35d05a,
  cloud: 0xffffff,
};
