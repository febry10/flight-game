// Sky Courier — mission rules: what makes a sortie succeed or fail.
// Rings in order, storm-cloud damage, terrain contact, the landing
// judgement and the edge of the chart. The Game owns the state and the
// score; this class reads the state each frame and calls back into the
// Game when something happens (scoreRing, endSortie), so the rules sit
// in one file and the flight model stays pure physics.
import { LANDING, PLANE, RING, SCORE, WORLD } from './config.js';
import { clamp } from './random.js';
import { terrainHeight } from './world.js';

export class MissionRules {
  constructor(game) {
    this.game = game;
  }

  /** Run every rule for this frame, in the order they can end a sortie. */
  checkAll(dt) {
    this.checkRings();
    this.checkClouds(dt);
    this.checkGround(dt);
    this.checkLanding();
    this.checkBounds();
  }

  /** Fly through the next ring (in order) to score. */
  checkRings() {
    const g = this.game;
    if (g.ringsPassed >= g.sortie.rings.length) return;
    const ring = g.sortie.rings[g.ringsPassed];
    const dx = g.position.x - ring[0];
    const dy = g.position.y - ring[1];
    const dz = g.position.z - ring[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < RING.radius) {
      const perfect = dist < 9;
      g.scoreRing(perfect);
      g.world.setNextRing(g.ringsPassed, g.ringsPassed);
      const ringMesh = g.world.ringMeshes[g.ringsPassed - 1];
      if (ringMesh && g.effects) g.effects.ringPulse(ringMesh);
      if (g.ringsPassed === g.sortie.rings.length) {
        g.showMessage('All rings flown — land on the runway to finish!', 4);
      }
    }
  }

  /** Storm clouds (and any cloud on the hard sortie) damage the plane.
      Taking damage also breaks the combo chain: clean flying pays. */
  checkClouds(dt) {
    const g = this.game;
    if (!g.sortie.storm && g.sortie.clouds < 12) return;
    for (const cloud of g.world.clouds) {
      const dx = g.position.x - cloud.position.x;
      const dy = g.position.y - cloud.position.y;
      const dz = g.position.z - cloud.position.z;
      if (Math.abs(dx) < 42 && Math.abs(dy) < 16 && Math.abs(dz) < 30) {
        g.damage = Math.min(PLANE.maxDamage, g.damage + 26 * dt);
        g.breakCombo();
        if (g.damage >= PLANE.maxDamage) {
          return g.endSortie('crashed', 'Torn apart inside a storm cloud.');
        }
      }
    }
  }

  /** Terrain and sea are solid: hit either one at speed and the sortie
      ends. Touch down gently and the plane rolls along the ground
      instead — the landing check then decides whether it counts. */
  checkGround(dt) {
    const g = this.game;
    const ground = terrainHeight(g.position.x, g.position.z);
    const minAlt = Math.max(ground, WORLD.seaLevel) + 2.2;
    if (g.position.y <= minAlt) {
      if (g.speed > 25) {
        g.position.y = minAlt;
        const reason = ground > 2 ? 'Crashed into the mountainside.' : 'Ditched in the sea.';
        return g.endSortie('crashed', reason);
      }
      g.position.y = minAlt;
      // Rolling friction on the ground.
      g.speed = Math.max(0, g.speed - 6 * dt);
    }
  }

  /** A landing counts when slow, low, level and over the runway strip —
      and only after the plane has actually flown (no instant landing on
      takeoff: the sortie needs a few seconds in the air first). The
      touchdown is graded SMOOTH / FIRM / HARD from speed and sink. */
  checkLanding() {
    const g = this.game;
    const rw = WORLD.runway;
    const overStrip =
      Math.abs(g.position.x - rw.x) < rw.width / 2 + 6 &&
      Math.abs(g.position.z - rw.z) < rw.length / 2;
    const low = g.position.y < 30;
    const slow = g.speed < 34;
    const level = Math.abs(g.bank) < 0.25 && Math.abs(g.pitch) < 0.18;
    const hasFlown = g.timeFlown > 8;
    if (!(overStrip && low && slow && level && hasFlown)) return;
    const sink = Math.max(0, -g.verticalSpeed);
    let quality;
    if (g.speed <= LANDING.smooth.maxSpeed && sink <= LANDING.smooth.maxSink && g.damage < 40) {
      quality = { ...LANDING.smooth };
    } else if (g.speed <= LANDING.firm.maxSpeed && sink <= LANDING.firm.maxSink) {
      quality = { ...LANDING.firm };
    } else {
      quality = { ...LANDING.hard };
    }
    g.landingQuality = quality.label;
    g.score += quality.bonus;
    g.score += Math.round(g.timeLeft) * SCORE.timeBonusPerSecond;
    g.score += Math.round(g.fuel) * SCORE.fuelBonusPerUnit;
    g.landed = true;
    g.position.y = 27;
    g.speed = 0;
    g.throttle = 0;
    g.audio.landing();
    if (g.effects) g.effects.touchdownSmoke(g.position);
    const finishedAllRings = g.ringsPassed === g.sortie.rings.length;
    g.endSortie(
      'landed',
      finishedAllRings
        ? `Touchdown: ${quality.label} — sortie complete, welcome home.`
        : `Touchdown: ${quality.label} — landed safely, but rings were missed.`,
    );
  }

  /** Flying out of the archipelago turns the plane back with a warning. */
  checkBounds() {
    const g = this.game;
    const half = WORLD.size / 2 - 60;
    if (Math.abs(g.position.x) > half || Math.abs(g.position.z) > half) {
      g.heading += Math.PI;
      g.position.x = clamp(g.position.x, -half, half);
      g.position.z = clamp(g.position.z, -half, half);
      g.showMessage('Edge of the chart — turning back!', 2.5);
    }
  }
}
