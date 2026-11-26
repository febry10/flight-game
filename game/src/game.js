// Sky Courier — game state, flight physics, missions and scoring.
// The plane flies an arcade model: throttle sets target speed, banking
// turns, pitching climbs and dives, and slow flight stalls. Rings, fuel,
// damage and landings turn a flight into decisions, not just sightseeing.
import { PLANE, RING, SCORE, SORTIES, WORLD } from './config.js';
import { clamp, lerp } from './random.js';
import { terrainHeight } from './world.js';

export const PHASE = {
  TITLE: 'title',
  FLYING: 'flying',
  PAUSED: 'paused',
  CRASHED: 'crashed',
  LANDED: 'landed', // sortie complete, on the runway
  OUT_OF_FUEL: 'out-of-fuel',
  TIME_UP: 'time-up',
};

export class Game {
  constructor(world, audio, onEvent) {
    this.world = world;
    this.audio = audio;
    this.onEvent = onEvent || (() => {});
    this.sortieIndex = 0;
    this.unlocked = 1; // sorties unlocked (1-based count)
    this.best = this.loadBest();
    this.resetToTitle();
  }

  loadBest() {
    try {
      const raw = localStorage.getItem('sky-courier-best');
      if (raw) return JSON.parse(raw);
    } catch {
      // Storage unavailable (private mode): best scores just don't persist.
    }
    return {};
  }

  saveBest() {
    try {
      localStorage.setItem('sky-courier-best', JSON.stringify(this.best));
    } catch {
      // Ignore persistence failures.
    }
  }

  /** Title-screen state: plane parked on the runway, camera orbiting. */
  resetToTitle() {
    this.phase = PHASE.TITLE;
    this.sortie = SORTIES[this.sortieIndex];
    this.score = 0;
    this.ringsPassed = 0;
    this.perfectRings = 0;
    this.fuel = this.sortie.fuel;
    this.damage = 0;
    this.timeLeft = this.sortie.timeLimit;
    this.timeFlown = 0;
    this.throttle = 0;
    this.speed = 0;
    this.pitch = 0;
    this.bank = 0;
    this.heading = 0;
    this.landed = false;
    this.message = '';
    this.messageUntil = 0;
    this.warnedFuel = false;
    this.crashReason = '';
    this.position = { x: WORLD.runway.x, y: 27, z: WORLD.runway.z + 120 };
    this.world.buildRings(this.sortie.rings);
    this.world.setNextRing(0, 0);
    this.placePlane();
  }

  /** Start the selected sortie from the runway. */
  startSortie(index) {
    this.sortieIndex = index;
    this.resetToTitle();
    this.phase = PHASE.FLYING;
    this.throttle = 0.35;
    this.onEvent('takeoff', { sortie: this.sortie.name });
    this.showMessage(`${this.sortie.name} — fly through the green ring!`, 4);
  }

  showMessage(text, seconds) {
    this.message = text;
    this.messageUntil = this.timeFlown + seconds;
  }

  /** Per-frame update. `input` is {pitch, bank, throttleUp, throttleDown}. */
  update(dt, input) {
    if (this.phase === PHASE.FLYING) this.updateFlying(dt, input);
    // Clouds drift in every phase so the title screen stays alive.
    this.world.updateClouds(dt, this.sortie.storm && this.phase === PHASE.FLYING);
    this.placePlane();
  }

  updateFlying(dt, input) {
    this.timeFlown += dt;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      return this.endSortie(PHASE.TIME_UP, 'Out of time — the sortie window closed.');
    }

    // Throttle: Shift / W raises it, S / Ctrl lowers it, 0..1.
    if (input.throttleUp) this.throttle = clamp(this.throttle + dt * 0.55, 0, 1);
    if (input.throttleDown) this.throttle = clamp(this.throttle - dt * 0.55, 0, 1);

    // Pitch and bank ease toward the stick, so the plane feels weighty.
    const targetPitch = clamp(input.pitch, -1, 1) * 0.5;
    const targetBank = clamp(input.bank, -1, 1) * 0.9;
    this.pitch = lerp(this.pitch, targetPitch, Math.min(1, dt * 3.2));
    this.bank = lerp(this.bank, targetBank, Math.min(1, dt * 3.2));

    // Speed chases the throttle; drag grows with speed squared (full
    // throttle tops out near 85 m/s, cruise near 60).
    const targetSpeed = this.throttle * PLANE.maxSpeed;
    const accel = this.throttle * PLANE.throttleAccel - PLANE.drag * this.speed * this.speed * 0.0164;
    this.speed = clamp(this.speed + accel * dt, 0, PLANE.maxSpeed);

    // Banking turns the plane; pitching climbs or dives.
    this.heading += this.bank * PLANE.turnFromBank * dt * clamp(this.speed / PLANE.cruiseSpeed, 0.25, 1.4);
    const stalled = this.speed < PLANE.minFlySpeed;
    const ground = terrainHeight(this.position.x, this.position.z);
    // A stalled plane sinks — unless it is already on its wheels, in which
    // case it rolls along the ground until it has flying speed again.
    const clearance = this.position.y - Math.max(ground, WORLD.seaLevel);
    const climb = stalled
      ? (clearance > 6 ? -PLANE.gravitySink : 0)
      : Math.sin(this.pitch) * this.speed * PLANE.climbFromPitch;
    const vx = -Math.sin(this.heading) * this.speed;
    const vz = -Math.cos(this.heading) * this.speed;
    this.position.x += vx * dt;
    this.position.z += vz * dt;
    this.position.y += climb * dt;

    // Fuel burns with throttle; empty tank means gliding down.
    const burn = PLANE.fuelBurnIdle + (PLANE.fuelBurn - PLANE.fuelBurnIdle) * this.throttle;
    this.fuel = Math.max(0, this.fuel - burn * dt);
    if (this.fuel < 20 && !this.warnedFuel) {
      this.warnedFuel = true;
      this.showMessage('LOW FUEL — head for the runway!', 3);
      this.audio.warning();
    }
    if (this.fuel <= 0) {
      this.throttle = 0;
      if (this.position.y <= terrainHeight(this.position.x, this.position.z) + 3) {
        return this.endSortie(PHASE.OUT_OF_FUEL, 'Out of fuel — she came down short of the runway.');
      }
    }

    this.checkRings();
    this.checkClouds(dt);
    this.checkGround(dt);
    this.checkLanding();
    this.checkBounds();
  }

  /** Fly through the next ring (in order) to score. */
  checkRings() {
    if (this.ringsPassed >= this.sortie.rings.length) return;
    const ring = this.sortie.rings[this.ringsPassed];
    const dx = this.position.x - ring[0];
    const dy = this.position.y - ring[1];
    const dz = this.position.z - ring[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < RING.radius) {
      const perfect = dist < 9;
      const points = perfect ? SCORE.perfectRing : SCORE.ring;
      this.score += points;
      if (perfect) this.perfectRings += 1;
      this.ringsPassed += 1;
      this.timeLeft += RING.timeBonus;
      this.fuel = Math.min(this.sortie.fuel, this.fuel + RING.fuelBonus);
      this.audio.ring(perfect);
      this.showMessage(
        perfect
          ? `PERFECT RING! +${points}`
          : `Ring ${this.ringsPassed}/${this.sortie.rings.length}  +${points}`,
        2.2,
      );
      this.world.setNextRing(this.ringsPassed, this.ringsPassed);
      this.onEvent('ring', { index: this.ringsPassed, perfect, score: this.score });
      if (this.ringsPassed === this.sortie.rings.length) {
        this.showMessage('All rings flown — land on the runway to finish!', 4);
      }
    }
  }

  /** Storm clouds (and any cloud on the hard sortie) damage the plane. */
  checkClouds(dt) {
    if (!this.sortie.storm && this.sortie.clouds < 12) return;
    for (const cloud of this.world.clouds) {
      const dx = this.position.x - cloud.position.x;
      const dy = this.position.y - cloud.position.y;
      const dz = this.position.z - cloud.position.z;
      if (Math.abs(dx) < 42 && Math.abs(dy) < 16 && Math.abs(dz) < 30) {
        this.damage = Math.min(PLANE.maxDamage, this.damage + 26 * dt);
        if (this.damage >= PLANE.maxDamage) {
          return this.endSortie(PHASE.CRASHED, 'Torn apart inside a storm cloud.');
        }
      }
    }
  }

  /** Terrain and sea are solid: hit either one at speed and the sortie ends.
      Touch down gently and the plane rolls along the ground instead — the
      landing check then decides whether it counts as a landing. */
  checkGround(dt) {
    const ground = terrainHeight(this.position.x, this.position.z);
    const minAlt = Math.max(ground, WORLD.seaLevel) + 2.2;
    if (this.position.y <= minAlt) {
      if (this.speed > 25) {
        this.position.y = minAlt;
        const reason =
          ground > 2 ? 'Crashed into the mountainside.' : 'Ditched in the sea.';
        return this.endSortie(PHASE.CRASHED, reason);
      }
      this.position.y = minAlt;
      // Rolling friction on the ground.
      this.speed = Math.max(0, this.speed - 6 * dt);
    }
  }

  /** A landing counts when slow, low, level and over the runway strip —
      and only after the plane has actually flown (no instant landing on
      takeoff: the sortie needs a few seconds in the air first). */
  checkLanding() {
    const rw = WORLD.runway;
    const overStrip =
      Math.abs(this.position.x - rw.x) < rw.width / 2 + 6 &&
      Math.abs(this.position.z - rw.z) < rw.length / 2;
    const low = this.position.y < 30;
    const slow = this.speed < 34;
    const level = Math.abs(this.bank) < 0.25 && Math.abs(this.pitch) < 0.18;
    const hasFlown = this.timeFlown > 8;
    if (overStrip && low && slow && level && hasFlown) {
      const smooth = this.speed < 24 && this.damage < 40;
      this.score += smooth ? SCORE.smoothLanding : SCORE.landing;
      this.score += Math.round(this.timeLeft) * SCORE.timeBonusPerSecond;
      this.score += Math.round(this.fuel) * SCORE.fuelBonusPerUnit;
      this.landed = true;
      this.position.y = 27;
      this.speed = 0;
      this.throttle = 0;
      this.audio.landing();
      const finishedAllRings = this.ringsPassed === this.sortie.rings.length;
      this.endSortie(PHASE.LANDED, finishedAllRings ? 'Sortie complete — welcome home.' : 'Landed safely, but rings were missed.');
    }
  }

  /** Flying out of the archipelago turns the plane back with a warning. */
  checkBounds() {
    const half = WORLD.size / 2 - 60;
    if (Math.abs(this.position.x) > half || Math.abs(this.position.z) > half) {
      this.heading += Math.PI;
      this.position.x = clamp(this.position.x, -half, half);
      this.position.z = clamp(this.position.z, -half, half);
      this.showMessage('Edge of the chart — turning back!', 2.5);
    }
  }

  endSortie(phase, reason) {
    this.phase = phase;
    this.crashReason = reason;
    if (phase === PHASE.CRASHED) this.audio.crash();
    const key = this.sortie.id;
    const prevBest = this.best[key] || 0;
    if (this.score > prevBest) {
      this.best[key] = this.score;
      this.saveBest();
    }
    if (phase === PHASE.LANDED && this.ringsPassed === this.sortie.rings.length) {
      this.unlocked = Math.max(this.unlocked, Math.min(SORTIES.length, this.sortieIndex + 2));
    }
    this.onEvent('end', { phase, reason, score: this.score });
  }

  /** Position the 3D plane mesh from the flight state. */
  placePlane() {
    const p = this.world.plane;
    p.position.set(this.position.x, this.position.y, this.position.z);
    // Yaw from heading, then pitch and bank in the plane's own frame.
    p.rotation.order = 'YXZ';
    p.rotation.y = this.heading;
    p.rotation.x = -this.pitch;
    p.rotation.z = this.bank;
    // Spin the prop with throttle (and a slow idle on the title screen).
    const spin = (0.25 + this.throttle * 2.4) * (this.phase === PHASE.TITLE ? 0.4 : 1);
    p.userData.prop.rotation.z += spin;
  }

  /** Chase camera: behind and above the plane, looking ahead. */
  cameraPose() {
    const back = 26;
    const up = 8;
    const cx = this.position.x + Math.sin(this.heading) * back;
    const cz = this.position.z + Math.cos(this.heading) * back;
    const cy = this.position.y + up;
    const lx = this.position.x - Math.sin(this.heading) * 40;
    const lz = this.position.z - Math.cos(this.heading) * 40;
    const ly = this.position.y + Math.sin(this.pitch) * 24 - 2;
    return { eye: { x: cx, y: cy, z: cz }, look: { x: lx, y: ly, z: lz } };
  }

  /** Slow orbit around the parked plane for the title screen. The look
      target sits to the right of the plane so the plane reads at the left
      of the frame, clear of the centred menu panel. */
  titleCameraPose(t) {
    const a = t * 0.12;
    const r = 55;
    return {
      eye: { x: this.position.x + Math.sin(a) * r, y: 44 + Math.sin(t * 0.3) * 3, z: this.position.z + Math.cos(a) * r },
      look: { x: this.position.x + 26, y: 28, z: this.position.z - 20 },
    };
  }

  get bestScore() {
    return this.best[this.sortie.id] || 0;
  }

  get ringsTotal() {
    return this.sortie.rings.length;
  }
}
