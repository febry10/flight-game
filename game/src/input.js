// Sky Courier — keyboard, mouse and touch input, one small object.
// Keys are read per frame (held state), so the flight model sees a smooth
// stick instead of key events. Touch buttons set the same flags.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pitch = 0; // -1 (nose down) .. +1 (nose up)
    this.bank = 0; // -1 (left) .. +1 (right)
    this.throttleUp = false;
    this.throttleDown = false;
    this.airbrake = false;
    this.onPause = null;
    this.onMute = null;
    this.onAnyGesture = null;
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.bindTouchButtons();
  }

  keyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === 'KeyP' || e.code === 'Escape') this.onPause?.();
    if (e.code === 'KeyM') this.onMute?.();
    this.onAnyGesture?.();
  }

  /** Read the held keys into the per-frame stick values. */
  poll() {
    const k = this.keys;
    const pitchUp = k.has('KeyW') || k.has('ArrowUp') || this.touch.pitchUp;
    const pitchDown = k.has('KeyS') || k.has('ArrowDown') || this.touch.pitchDown;
    const bankLeft = k.has('KeyA') || k.has('ArrowLeft') || this.touch.bankLeft;
    const bankRight = k.has('KeyD') || k.has('ArrowRight') || this.touch.bankRight;
    this.pitch = (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0);
    this.bank = (bankRight ? 1 : 0) - (bankLeft ? 1 : 0);
    this.throttleUp = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyE') || this.touch.throttleUp;
    this.throttleDown = k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyQ') || this.touch.throttleDown;
    this.airbrake = k.has('Space') || this.touch.airbrake;
    if (this.airbrake) this.throttleDown = true;
    return this;
  }

  bindTouchButtons() {
    this.touch = {
      pitchUp: false, pitchDown: false, bankLeft: false, bankRight: false,
      throttleUp: false, throttleDown: false, airbrake: false,
    };
    const bind = (id, flag) => {
      const el = document.getElementById(id);
      if (!el) return;
      const on = (e) => { e.preventDefault(); this.touch[flag] = true; this.onAnyGesture?.(); };
      const off = (e) => { e.preventDefault(); this.touch[flag] = false; };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointerleave', off);
      el.addEventListener('pointercancel', off);
    };
    bind('btn-pitch-up', 'pitchUp');
    bind('btn-pitch-down', 'pitchDown');
    bind('btn-bank-left', 'bankLeft');
    bind('btn-bank-right', 'bankRight');
    bind('btn-throttle-up', 'throttleUp');
    bind('btn-throttle-down', 'throttleDown');
    // Show the touch pad only on coarse-pointer devices.
    if (window.matchMedia('(pointer: coarse)').matches) {
      document.getElementById('touch-pad')?.classList.remove('hidden');
    }
  }
}
