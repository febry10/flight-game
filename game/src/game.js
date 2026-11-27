// Sky Courier — game state and orchestration.
// The Game owns the sortie state (score, fuel, damage, combo, plane) and
// the phase machine; the moving parts live in their own modules: the
// flight model integrates the physics (flightmodel.js), the mission
// rules judge rings, damage and landings (missions.js), the camera
// poses sit in camera.js, wind and hours in weather.js, and the hangar
// upgrades in upgrades.js. This file wires them together per frame.
import { COMBO, RING, SCORE, SORTIES, WORLD } from './config.js';
import { chaseCameraPose, titleCameraPose } from './camera.js';
import { integrateFlight } from './flightmodel.js';
import { MissionRules } from './missions.js';
import { buyUpgrade, effectivePlane, loadHangar, saveHangar } from './upgrades.js';
import { Wind } from './weather.js';
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
  constructor(world, audio, onEvent, effects) {
    this.world = world;
    this.audio = audio;
    this.effects = effects || null;
    this.onEvent = onEvent || (() => {});
    this.rules = new MissionRules(this);
    this.sortieIndex = 0;
    this.unlocked = 1; // sorties unlocked (1-based count)
    this.best = this.loadBest();
    this.hangar = loadHangar();
    this.elapsed = 0;
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
    this.plane = effectivePlane(this.sortie, this.hangar);
    this.fuelCapacity = this.sortie.fuel + this.plane.fuelBonus;
    this.wind = new Wind(this.sortie.wind);
    this.score = 0;
    this.ringsPassed = 0;
    this.perfectRings = 0;
    this.nearMisses = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.fuel = this.fuelCapacity;
    this.damage = 0;
    this.timeLeft = this.sortie.timeLimit;
    this.timeFlown = 0;
    this.throttle = 0;
    this.speed = 0;
    this.pitch = 0;
    this.bank = 0;
    this.heading = 0;
    this.verticalSpeed = 0;
    this.stalled = false;
    this.landed = false;
    this.landingQuality = '';
    this.message = '';
    this.messageUntil = 0;
    this.warnedFuel = false;
    this.crashReason = '';
    this.position = { x: WORLD.runway.x, y: 27, z: WORLD.runway.z + 120 };
    this.world.buildRings(this.sortie.rings);
    this.world.setNextRing(0, 0);
    this.world.applySortieLook(this.sortie);
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

  /** The score multiplier the next ring earns at the current chain. */
  get comboMultiplier() {
    return Math.min(1 + this.comboCount * COMBO.stepPerRing, COMBO.maxMultiplier);
  }

  /** Damage or a long gap between rings breaks the combo chain. */
  breakCombo() {
    this.comboCount = 0;
    this.comboTimer = 0;
  }

  /** Score a flown ring: base points times the combo multiplier, plus
      the ring's time and fuel bonuses. Called by the mission rules. */
  scoreRing(perfect) {
    const base = perfect ? SCORE.perfectRing : SCORE.ring;
    const points = Math.round(base * this.comboMultiplier);
    this.score += points;
    if (perfect) this.perfectRings += 1;
    this.ringsPassed += 1;
    this.comboCount += 1;
    this.bestCombo = Math.max(this.bestCombo, this.comboCount);
    this.comboTimer = COMBO.windowSeconds;
    this.timeLeft += RING.timeBonus;
    this.fuel = Math.min(this.fuelCapacity, this.fuel + RING.fuelBonus);
    this.audio.ring(perfect);
    const chain = this.comboMultiplier > 1 ? `  COMBO ×${this.comboMultiplier.toFixed(2)}` : '';
    this.showMessage(
      perfect
        ? `PERFECT RING! +${points}${chain}`
        : `Ring ${this.ringsPassed}/${this.sortie.rings.length}  +${points}${chain}`,
      2.2,
    );
    this.onEvent('ring', { index: this.ringsPassed, perfect, score: this.score });
  }

  /** Score a near miss: the mission rules spot the close call, this
      banks the bonus and pops the message the HUD shows. */
  scoreNearMiss(kind) {
    this.nearMisses += 1;
    this.score += SCORE.nearMiss;
    this.showMessage(
      kind === 'ring'
        ? `NEAR MISS! +${SCORE.nearMiss} — threaded the ring's edge!`
        : `NEAR MISS! +${SCORE.nearMiss} — skimmed the treetops!`,
      1.8,
    );
    this.onEvent('near-miss', { kind, score: this.score });
  }

  /** Buy the next hangar upgrade level with banked score. */
  buyUpgrade(id) {
    const bought = buyUpgrade(this.hangar, id);
    if (bought) {
      // The plane the title screen shows wears the new numbers at once.
      this.plane = effectivePlane(this.sortie, this.hangar);
      this.fuelCapacity = this.sortie.fuel + this.plane.fuelBonus;
      this.fuel = this.fuelCapacity;
    }
    return bought;
  }

  /** Per-frame update. `input` is {pitch, bank, throttleUp, throttleDown}. */
  update(dt, input) {
    this.elapsed += dt;
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

    // The combo chain decays: dawdle too long and it is gone.
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.breakCombo();
    }

    this.wind.update(dt);
    const result = integrateFlight(this, input, dt, this.plane, this.wind.push);
    this.stalled = result.stalled;
    this.verticalSpeed = result.verticalSpeed;

    // Fuel burns with throttle; empty tank means gliding down.
    const burn = this.plane.fuelBurnIdle + (this.plane.fuelBurn - this.plane.fuelBurnIdle) * this.throttle;
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

    this.rules.checkAll(dt);
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
    // Every point scored is banked for the hangar, win or lose.
    if (this.score > 0) {
      this.hangar.bank += this.score;
      saveHangar(this.hangar);
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
    // The blur disc fades in as the prop spins up; the blades fade out.
    const disc = p.userData.propDisc;
    if (disc) {
      const blur = Math.min(1, Math.max(0, (this.throttle - 0.2) * 1.6));
      disc.material.opacity = blur * 0.5;
      for (const blade of p.userData.blades) blade.material.opacity = 1 - blur * 0.75;
    }
    // Navigation lights blink twice a second.
    const lit = Math.floor(this.elapsed * 2) % 2 === 0;
    p.userData.navL.material.color.setHex(lit ? 0xff2222 : 0x661111);
    p.userData.navR.material.color.setHex(lit ? 0x22ff66 : 0x116633);
    // The parcel crates ride only on sorties that carry cargo.
    if (p.userData.crate) p.userData.crate.visible = (this.sortie.cargo || 0) > 0;
  }

  /** Chase camera: behind and above the plane, looking ahead. */
  cameraPose() {
    return chaseCameraPose(this);
  }

  /** Slow orbit around the parked plane for the title screen. */
  titleCameraPose(t) {
    return titleCameraPose(this, t);
  }

  get bestScore() {
    return this.best[this.sortie.id] || 0;
  }

  get ringsTotal() {
    return this.sortie.rings.length;
  }
}
