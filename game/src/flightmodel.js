// Sky Courier — the flight model: one integration step of the plane.
// Arcade physics with real discipline: throttle sets a target speed the
// engine chases against drag, bank turns, pitch climbs, and below the
// stall speed she sinks. Cargo and upgrades arrive already folded into
// `plane` (see upgrades.js effectivePlane); the storm wind arrives as a
// push on the ground track. Pure state in, state out — the Game owns
// the state object, this module only moves it.
import { WORLD } from './config.js';
import { clamp, lerp } from './random.js';
import { terrainHeight } from './world.js';

/**
 * Advance the flight state by dt seconds.
 * state: { throttle, speed, pitch, bank, heading, position {x,y,z} }
 * input: { pitch, bank, throttleUp, throttleDown } in -1..1 / booleans
 * plane: effective numbers from effectivePlane()
 * wind:  { x, z } push in m/s (zeros when the sortie has no wind)
 * Returns { stalled, verticalSpeed } for the HUD, the shake and the
 * landing-quality judge.
 */
export function integrateFlight(state, input, dt, plane, wind) {
  // Throttle: Shift / W raises it, S / Ctrl lowers it, 0..1.
  if (input.throttleUp) state.throttle = clamp(state.throttle + dt * 0.55, 0, 1);
  if (input.throttleDown) state.throttle = clamp(state.throttle - dt * 0.55, 0, 1);

  // Pitch and bank ease toward the stick, so the plane feels weighty.
  const targetPitch = clamp(input.pitch, -1, 1) * 0.5;
  const targetBank = clamp(input.bank, -1, 1) * 0.9;
  state.pitch = lerp(state.pitch, targetPitch, Math.min(1, dt * 3.2));
  state.bank = lerp(state.bank, targetBank, Math.min(1, dt * 3.2));

  // Speed chases the throttle; drag grows with speed squared (full
  // throttle tops out near maxSpeed, cruise near 60).
  const accel = state.throttle * plane.throttleAccel - plane.drag * state.speed * state.speed * 0.0164;
  state.speed = clamp(state.speed + accel * dt, 0, plane.maxSpeed);

  // Banking turns the plane; pitching climbs or dives.
  state.heading += state.bank * plane.turnFromBank * dt * clamp(state.speed / plane.cruiseSpeed, 0.25, 1.4);
  const stalled = state.speed < plane.minFlySpeed;
  const ground = terrainHeight(state.position.x, state.position.z);
  // A stalled plane sinks — unless it is already on its wheels, in which
  // case it rolls along the ground until it has flying speed again.
  const clearance = state.position.y - Math.max(ground, WORLD.seaLevel);
  const climb = stalled
    ? (clearance > 6 ? -plane.gravitySink : 0)
    : Math.sin(state.pitch) * state.speed * plane.climbFromPitch;
  const vx = -Math.sin(state.heading) * state.speed + wind.x;
  const vz = -Math.cos(state.heading) * state.speed + wind.z;
  state.position.x += vx * dt;
  state.position.z += vz * dt;
  state.position.y += climb * dt;
  return { stalled, verticalSpeed: climb };
}
