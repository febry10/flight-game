// Sky Courier — camera poses: the chase view and the title orbit.
// The chase camera sits behind and above the plane and looks ahead of
// it, so the next ring or the runway is in frame; the title camera
// orbits the parked plane slowly. The boot module adds the bank roll,
// the speed FOV kick and the stall buffet on top of these poses.
import { clamp } from './random.js';

/** Chase pose for a flight state { position, heading, pitch }. */
export function chaseCameraPose(state) {
  const back = 26;
  const up = 8;
  return {
    eye: {
      x: state.position.x + Math.sin(state.heading) * back,
      y: state.position.y + up,
      z: state.position.z + Math.cos(state.heading) * back,
    },
    look: {
      x: state.position.x - Math.sin(state.heading) * 40,
      y: state.position.y + Math.sin(state.pitch) * 24 - 2,
      z: state.position.z - Math.cos(state.heading) * 40,
    },
  };
}

/** Slow orbit around the parked plane for the title screen. The look
    target sits to the right of the plane so the plane reads at the left
    of the frame, clear of the centred menu panel. */
export function titleCameraPose(state, t) {
  const a = t * 0.12;
  const r = 55;
  return {
    eye: {
      x: state.position.x + Math.sin(a) * r,
      y: 44 + Math.sin(t * 0.3) * 3,
      z: state.position.z + Math.cos(a) * r,
    },
    look: { x: state.position.x + 26, y: 28, z: state.position.z - 20 },
  };
}

/** Field of view for an airspeed: a gentle kick as she speeds up, so
    fast flight feels fast. Base 62°, up to +8° at full throttle. */
export function fovForSpeed(speed, maxSpeed) {
  return 62 + clamp((speed - 35) / Math.max(1, maxSpeed - 35), 0, 1) * 8;
}
