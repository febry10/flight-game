// Sky Courier — the HUD: instruments, minimap and overlays, all DOM.
// The canvas shows the 3D world; everything the pilot reads lives here:
// speed, altitude, heading, throttle, fuel, damage, score and the mission.
// Instruments are lit and updated every frame from the game state.
import { SORTIES, WORLD } from './config.js';
import { PHASE } from './game.js';
import { terrainHeight } from './world.js';

function compassLabel(heading) {
  const deg = ((Math.atan2(-Math.sin(heading), -Math.cos(heading)) * 180) / Math.PI + 360) % 360;
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return { deg: Math.round(deg), point: points[Math.round(deg / 22.5) % 16] };
}

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {};
    for (const id of [
      'speed', 'alt', 'heading', 'throttle', 'fuel', 'fuelbar', 'damage', 'damagebar',
      'score', 'rings', 'timer', 'message', 'sortie-name', 'overlay', 'overlay-title',
      'overlay-body', 'overlay-stats', 'menu-list', 'minimap', 'hint',
    ]) {
      this.el[id] = document.getElementById(id);
    }
    this.mapCtx = this.el.minimap.getContext('2d');
    this.lastOverlay = '';
  }

  /** Per-frame refresh of every instrument. */
  update(now) {
    const g = this.game;
    const knots = Math.round(g.speed * 1.94);
    this.el.speed.textContent = String(knots);
    const altFt = Math.max(0, Math.round((g.position.y - 24) * 3.28));
    this.el.alt.textContent = String(altFt);
    const c = compassLabel(g.heading);
    this.el.heading.textContent = `${String(c.deg).padStart(3, '0')}° ${c.point}`;
    this.el.throttle.textContent = `${Math.round(g.throttle * 100)}%`;
    this.el.fuel.textContent = `${Math.round(g.fuel)}`;
    this.el.fuelbar.style.width = `${g.fuel}%`;
    this.el.fuelbar.classList.toggle('low', g.fuel < 20);
    this.el.damage.textContent = `${Math.round(g.damage)}%`;
    this.el.damagebar.style.width = `${g.damage}%`;
    this.el.score.textContent = String(g.score);
    this.el.rings.textContent = `${g.ringsPassed}/${g.ringsTotal}`;
    const t = Math.max(0, Math.ceil(g.timeLeft));
    this.el.timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    this.el.timer.classList.toggle('low', t < 30 && g.phase === PHASE.FLYING);
    this.el['sortie-name'].textContent = g.sortie.name;
    const showMsg = g.message && g.timeFlown < g.messageUntil;
    this.el.message.textContent = showMsg ? g.message : '';
    this.el.message.classList.toggle('visible', showMsg);
    this.drawMinimap();
    this.updateOverlay();
  }

  /** Top-down chart: islands, runway, rings and the plane. */
  drawMinimap() {
    const g = this.game;
    const ctx = this.mapCtx;
    const W = 150;
    const H = 150;
    const scale = W / WORLD.size;
    const toMap = (x, z) => [W / 2 + x * scale, H / 2 + z * scale];
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(20, 60, 90, 0.75)';
    ctx.fillRect(0, 0, W, H);
    // Islands as green blobs.
    for (const isl of WORLD.islands) {
      const [mx, mz] = toMap(isl.x, isl.z);
      ctx.fillStyle = '#4d8a4a';
      ctx.beginPath();
      ctx.arc(mx, mz, Math.max(2, isl.r * scale), 0, Math.PI * 2);
      ctx.fill();
    }
    // Runway.
    const [rx, rz] = toMap(WORLD.runway.x, WORLD.runway.z);
    ctx.fillStyle = '#f5f2e8';
    ctx.fillRect(rx - 2, rz - 8, 4, 16);
    // Rings: next one green, passed ones dim, rest amber.
    g.sortie.rings.forEach((r, i) => {
      const [mx, mz] = toMap(r[0], r[2]);
      ctx.fillStyle = i < g.ringsPassed ? '#33553a' : i === g.ringsPassed ? '#35d05a' : '#ffc233';
      ctx.beginPath();
      ctx.arc(mx, mz, i === g.ringsPassed ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    });
    // Plane arrow, rotated by heading.
    const [px, pz] = toMap(g.position.x, g.position.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.PI - g.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Title / pause / end overlays. Rebuilt only when the phase changes. */
  updateOverlay() {
    const g = this.game;
    const key = `${g.phase}|${g.sortieIndex}|${g.score}`;
    if (key === this.lastOverlay) return;
    this.lastOverlay = key;
    const ov = this.el.overlay;
    if (g.phase === PHASE.FLYING) {
      ov.classList.add('hidden');
      return;
    }
    const title = this.el['overlay-title'];
    const body = this.el['overlay-body'];
    const stats = this.el['overlay-stats'];
    const menu = this.el['menu-list'];
    menu.innerHTML = '';
    stats.innerHTML = '';
    ov.classList.remove('hidden');

    if (g.phase === PHASE.TITLE) {
      title.textContent = 'SKY COURIER';
      body.innerHTML =
        'A little cargo plane, a whole archipelago, and a storm on the way. ' +
        'Fly the rings, mind your fuel, and bring her home to the runway.';
      const list = document.createElement('div');
      list.className = 'sortie-list';
      SORTIES.forEach((s, i) => {
        const btn = document.createElement('button');
        btn.className = 'sortie-btn';
        btn.dataset.sortie = String(i);
        const locked = i >= g.unlocked;
        btn.disabled = locked;
        const best = g.best[s.id] || 0;
        btn.innerHTML =
          `<span class="sortie-num">${locked ? '🔒' : `0${i + 1}`}</span>` +
          `<span class="sortie-name">${s.name}</span>` +
          `<span class="sortie-meta">${s.rings.length} rings · ${Math.floor(s.timeLimit / 60)}:${String(s.timeLimit % 60).padStart(2, '0')} · best ${best}</span>` +
          `<span class="sortie-brief">${s.brief}</span>`;
        list.appendChild(btn);
      });
      menu.appendChild(list);
      const hint = document.createElement('p');
      hint.className = 'controls-hint';
      hint.textContent =
        'W/S pitch · A/D bank · Shift/Ctrl throttle · Space airbrake · P pause · M mute · click a sortie to fly';
      menu.appendChild(hint);
    } else if (g.phase === PHASE.PAUSED) {
      title.textContent = 'PAUSED';
      body.textContent = 'The sky will wait. Take a breath, pilot.';
      menu.appendChild(this.makeButton('Resume flying', 'resume'));
      menu.appendChild(this.makeButton('Back to menu', 'menu'));
    } else if (g.phase === PHASE.LANDED) {
      const complete = g.ringsPassed === g.ringsTotal;
      title.textContent = complete ? 'SORTIE COMPLETE' : 'LANDED';
      body.textContent = g.crashReason;
      stats.innerHTML =
        `<div><span>Score</span><b>${g.score}</b></div>` +
        `<div><span>Rings</span><b>${g.ringsPassed}/${g.ringsTotal}</b></div>` +
        `<div><span>Perfect rings</span><b>${g.perfectRings}</b></div>` +
        `<div><span>Time left</span><b>${Math.max(0, Math.ceil(g.timeLeft))}s</b></div>` +
        `<div><span>Fuel left</span><b>${Math.round(g.fuel)}%</b></div>` +
        `<div><span>Best on this sortie</span><b>${g.bestScore}</b></div>`;
      menu.appendChild(this.makeButton('Fly it again', 'retry'));
      if (complete && g.sortieIndex + 1 < SORTIES.length) {
        menu.appendChild(this.makeButton(`Next sortie: ${SORTIES[g.sortieIndex + 1].name}`, 'next'));
      }
      menu.appendChild(this.makeButton('Back to menu', 'menu'));
    } else {
      title.textContent =
        g.phase === PHASE.CRASHED ? 'CRASHED' : g.phase === PHASE.TIME_UP ? "OUT OF TIME" : 'OUT OF FUEL';
      body.textContent = g.crashReason;
      stats.innerHTML =
        `<div><span>Score</span><b>${g.score}</b></div>` +
        `<div><span>Rings</span><b>${g.ringsPassed}/${g.ringsTotal}</b></div>` +
        `<div><span>Best on this sortie</span><b>${g.bestScore}</b></div>`;
      menu.appendChild(this.makeButton('Try again', 'retry'));
      menu.appendChild(this.makeButton('Back to menu', 'menu'));
    }
  }

  makeButton(label, action) {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.dataset.action = action;
    btn.textContent = label;
    return btn;
  }

  hideOverlay() {
    this.el.overlay.classList.add('hidden');
    this.lastOverlay = '';
  }
}
