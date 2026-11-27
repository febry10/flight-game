// Sky Courier — boot and render loop.
// Sets up the renderer, the world and the game, then runs the frame loop:
// read input, step the flight model, move the chase camera, update the HUD.
// A `?shot=<name>&seed=<n>` URL stages a fixed scene for screenshots and
// stops the loop after a few painted frames, so the frame is identical on
// every run. Without it, the game plays normally.
import * as THREE from 'three';
import { AudioEngine } from './audio.js';
import { fovForSpeed } from './camera.js';
import { Effects } from './effects.js';
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
// Sun shadows: one directional shadow map that follows the plane, so
// the ground detail (fields, village, trees) grounds the plane in the
// frame instead of floating over flat colour.
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 2, 9000);

const world = new World(seed);
// Configure the sun's shadow camera once: a 420 m box around wherever
// the light is aimed (the frame loop aims it at the plane each frame).
{
  const sun = world.sunLight;
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -210;
  sun.shadow.camera.right = 210;
  sun.shadow.camera.top = 210;
  sun.shadow.camera.bottom = -210;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 5200;
  sun.shadow.bias = -0.0006;
  world.scene.add(sun.target);
}
const audio = new AudioEngine();
const effects = new Effects(world.scene);
const game = new Game(world, audio, (event) => {
  if (event === 'takeoff' || event === 'ring' || event === 'end') hud.hideOverlay();
}, effects);
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
  const upgradeBtn = e.target.closest('[data-upgrade]');
  if (upgradeBtn && !upgradeBtn.disabled) {
    audio.start();
    audio.resume();
    if (game.buyUpgrade(upgradeBtn.dataset.upgrade)) audio.landing();
    // hideOverlay clears the HUD's overlay cache, so the next frame
    // rebuilds the title screen with the new bank and upgrade levels.
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
  // The staged frame is fixed: snap the FOV kick to its final value
  // instead of letting it ease in over the few painted frames.
  camera.fov = fovForSpeed(game.speed, game.plane.maxSpeed);
  camera.updateProjectionMatrix();
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
    effects.updateExhaust(dt, game, game.throttle, game.phase === PHASE.FLYING);
    effects.updateDamageSmoke(dt, game, game.phase === PHASE.FLYING ? game.damage : 0);
  }
  effects.update(isShot ? 0 : dt);
  world.updateAmbient(now / 1000);
  renderer.toneMappingExposure = world.exposure;

  // Camera: orbit on the title screen, chase cam in flight, frozen on end.
  let pose;
  if (game.phase === PHASE.TITLE) {
    pose = game.titleCameraPose(now / 1000);
  } else {
    pose = game.cameraPose();
  }
  camera.position.set(pose.eye.x, pose.eye.y, pose.eye.z);
  // Cover-shot push-in: the staged start frame sits closer and lower on
  // the plane than the playable chase cam, so the plane fills the frame
  // the way a poster shot would frame it.
  if (isShot && shotName === 'start') {
    camera.position.x += (game.position.x - camera.position.x) * 0.38;
    camera.position.y += (game.position.y + 3 - camera.position.y) * 0.3;
    camera.position.z += (game.position.z - camera.position.z) * 0.38;
  }
  // Aim the sun's shadow box at the plane: the light hangs at the
  // sortie's sun offset from the plane and looks straight at it.
  const sunOff = world.sunOffset || { x: 0, y: 1000, z: 0 };
  world.sunLight.position.set(
    game.position.x + sunOff.x,
    game.position.y + sunOff.y,
    game.position.z + sunOff.z,
  );
  world.sunLight.target.position.set(game.position.x, game.position.y, game.position.z);
  // Stall buffet: a stalled plane shakes in the camera's hands.
  if (!isShot && game.phase === PHASE.FLYING && game.stalled && game.speed > 4) {
    const t = now / 1000;
    camera.position.x += Math.sin(t * 47) * 0.35;
    camera.position.y += Math.sin(t * 59 + 1.3) * 0.3;
  }
  camera.lookAt(pose.look.x, pose.look.y, pose.look.z);
  // Roll the camera a touch with the bank so turns feel banked.
  camera.rotateZ(game.bank * 0.22);
  // Speed FOV kick: the world leans in as she gets fast.
  const targetFov = fovForSpeed(game.speed, game.plane.maxSpeed);
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3 + 0.02);
    camera.updateProjectionMatrix();
  }

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
