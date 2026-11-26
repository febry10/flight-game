// Sky Courier — boot and render loop.
// Sets up the renderer, the world and the game, then runs the frame loop:
// read input, step the flight model, move the chase camera, update the HUD.
// A `?shot=<name>&seed=<n>` URL stages a fixed scene for screenshots and
// stops the loop after a few painted frames, so the frame is identical on
// every run. Without it, the game plays normally.
import * as THREE from 'three';
import { AudioEngine } from './audio.js';
import { Game, PHASE } from './game.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { hashSeed } from './random.js';
import { stageShot } from './shots.js';
import { World } from './world.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = hashSeed(params.get('seed') || '1');

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 2, 9000);

const world = new World(seed);
const audio = new AudioEngine();
const game = new Game(world, audio, (event) => {
  if (event === 'takeoff' || event === 'ring' || event === 'end') hud.hideOverlay();
});
const hud = new Hud(game);
const input = new Input();

input.onPause = () => {
  if (game.phase === PHASE.FLYING) {
    game.phase = PHASE.PAUSED;
    audio.update(0, 0, false);
  } else if (game.phase === PHASE.PAUSED) {
    game.phase = PHASE.FLYING;
    hud.hideOverlay();
  }
};
input.onMute = () => {
  const muted = audio.toggleMute();
  game.showMessage(muted ? 'Sound off' : 'Sound on', 1.5);
};
input.onAnyGesture = () => {
  audio.start();
  audio.resume();
};

// Overlay buttons: sortie cards, resume/retry/next/menu actions.
document.getElementById('overlay').addEventListener('click', (e) => {
  const sortieBtn = e.target.closest('[data-sortie]');
  if (sortieBtn && !sortieBtn.disabled) {
    audio.start();
    audio.resume();
    game.startSortie(Number(sortieBtn.dataset.sortie));
    hud.hideOverlay();
    return;
  }
  const actionBtn = e.target.closest('[data-action]');
  if (!actionBtn) return;
  audio.start();
  audio.resume();
  const action = actionBtn.dataset.action;
  if (action === 'resume') {
    game.phase = PHASE.FLYING;
    hud.hideOverlay();
  } else if (action === 'retry') {
    game.startSortie(game.sortieIndex);
    hud.hideOverlay();
  } else if (action === 'next') {
    game.startSortie(Math.min(game.sortieIndex + 1, 2));
    hud.hideOverlay();
  } else if (action === 'menu') {
    game.resetToTitle();
  }
});
document.getElementById('mute-btn').addEventListener('click', () => {
  audio.start();
  const muted = audio.toggleMute();
  document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// A staged screenshot scene renders a fixed frame and stops.
let shotFrames = 0;
const isShot = Boolean(shotName);
if (isShot) {
  stageShot(shotName, game, world);
  hud.update(0);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (!isShot) {
    input.poll();
    game.update(dt, input);
    audio.update(game.throttle, game.speed, game.phase === PHASE.FLYING);
  }

  // Camera: orbit on the title screen, chase cam in flight, frozen on end.
  let pose;
  if (game.phase === PHASE.TITLE) {
    pose = game.titleCameraPose(now / 1000);
  } else {
    pose = game.cameraPose();
  }
  camera.position.set(pose.eye.x, pose.eye.y, pose.eye.z);
  camera.lookAt(pose.look.x, pose.look.y, pose.look.z);
  // Roll the camera a touch with the bank so turns feel banked.
  camera.rotateZ(game.bank * 0.22);

  // Spin the prop and bob the rings gently.
  world.plane.userData.prop.rotation.z += (0.3 + game.throttle * 2.2) * dt * 60 * 0.16;
  const t = now / 1000;
  world.ringMeshes.forEach((ring, i) => {
    ring.position.y += Math.sin(t * 1.4 + i * 1.7) * 0.004;
  });

  hud.update(now / 1000);
  renderer.render(world.scene, camera);

  if (isShot) {
    shotFrames += 1;
    // A few frames lets the renderer settle, then stop: the shot is fixed.
    if (shotFrames >= 8) return;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Expose a tiny handle for scripted play-tests: window.__sky = { game, world }.
window.__sky = { game, world, input, audio };
