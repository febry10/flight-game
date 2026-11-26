// Sky Courier — all sound is synthesised with WebAudio, no audio files.
// An engine hum whose pitch follows the throttle, wind noise that grows
// with speed, and short chimes for rings, landings and crashes. The audio
// context is created on the first user gesture (browsers require it).

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.windSource = null;
    this.windGain = null;
    this.windFilter = null;
    this.muted = false;
    this.started = false;
  }

  /** Create the context and the always-on engine/wind voices. Call from a gesture. */
  start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // Engine: two detuned sawtooths through a low-pass filter.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'sawtooth';
    this.engineOsc2.frequency.value = 82;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(engineFilter);
    this.engineOsc2.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.engineOsc2.start();

    // Wind: looped white noise through a band-pass filter.
    const len = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = buffer;
    this.windSource.loop = true;
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 600;
    this.windFilter.Q.value = 0.6;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    this.windSource.start();

    this.started = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Per-frame update: engine pitch from throttle, wind from airspeed. */
  update(throttle, speed, flying) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const targetEngine = flying ? 0.05 + throttle * 0.075 : 0.0;
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : targetEngine, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(48 + throttle * 95, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(72 + throttle * 140, t, 0.1);
    const wind = flying ? Math.min(0.16, (speed / 95) * 0.16) : 0;
    this.windGain.gain.setTargetAtTime(this.muted ? 0 : wind, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(400 + speed * 9, t, 0.15);
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  /** Short two-note chime when a ring is flown. `perfect` adds a third note. */
  ring(perfect) {
    if (!this.started) return;
    const notes = perfect ? [880, 1174, 1568] : [784, 1046];
    notes.forEach((freq, i) => this.tone(freq, 0.18, i * 0.09, 'sine', 0.22));
  }

  /** Landing jingle: a rising major arpeggio. */
  landing() {
    if (!this.started) return;
    [523, 659, 784, 1046].forEach((freq, i) => this.tone(freq, 0.22, i * 0.1, 'triangle', 0.22));
  }

  /** Crash: a burst of filtered noise plus a low thud. */
  crash() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const len = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
    this.tone(70, 0.4, 0, 'sine', 0.4);
  }

  /** Low-fuel warning beep. */
  warning() {
    if (!this.started) return;
    this.tone(440, 0.12, 0, 'square', 0.1);
    this.tone(440, 0.12, 0.18, 'square', 0.1);
  }

  /** One synthesised note. */
  tone(freq, duration, delay, type, volume) {
    if (!this.started || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }
}
