// Sky Courier — particle effects: exhaust puffs, touchdown smoke,
// damage smoke and the pulse that bursts out of a ring as you fly it.
// A fixed pool of sprites is recycled, so effects never allocate in the
// frame loop. The puff texture is drawn on a canvas at boot — a soft
// radial disc — so the game still ships no image files.
import * as THREE from 'three';

const POOL_SIZE = 90;

/** Soft round puff texture, drawn once. Shared with the world's clouds. */
export function makePuffTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.38)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    const texture = makePuffTexture();
    this.particles = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const material = new THREE.SpriteMaterial({
        map: texture, transparent: true, opacity: 0, depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      scene.add(sprite);
      this.particles.push({
        sprite, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0,
        grow: 0, startScale: 1, startOpacity: 0.5,
      });
    }
    this.cursor = 0;
    // Ring pulses: expanding flat rings that fade out.
    this.pulses = [];
    const pulseGeo = new THREE.RingGeometry(0.86, 1, 40);
    for (let i = 0; i < 4; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0x7dff9a, transparent: true, opacity: 0, side: THREE.DoubleSide,
        depthWrite: false, fog: false,
      });
      const mesh = new THREE.Mesh(pulseGeo, material);
      mesh.visible = false;
      scene.add(mesh);
      this.pulses.push({ mesh, life: 0 });
    }
    this.pulseCursor = 0;
    this.exhaustTimer = 0;
  }

  /** Spawn one puff. Colour is a hex number; the pool wraps around. */
  spawn(x, y, z, options) {
    const p = this.particles[this.cursor];
    this.cursor = (this.cursor + 1) % POOL_SIZE;
    p.sprite.position.set(x, y, z);
    p.sprite.material.color.setHex(options.color);
    p.sprite.material.rotation = Math.random() * Math.PI;
    p.life = 0;
    p.maxLife = options.life;
    p.vx = options.vx || 0;
    p.vy = options.vy || 0;
    p.vz = options.vz || 0;
    p.grow = options.grow || 0;
    p.startScale = options.scale;
    p.startOpacity = options.opacity;
    p.sprite.visible = true;
  }

  /** A burst of puffs in every direction (a ring flown, a touchdown). */
  burst(position, color, count, speed, scale, life) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.spawn(position.x, position.y, position.z, {
        color,
        vx: Math.cos(a) * speed * (0.4 + Math.random() * 0.6),
        vy: (Math.random() - 0.3) * speed * 0.5,
        vz: Math.sin(a) * speed * (0.4 + Math.random() * 0.6),
        scale: scale * (0.7 + Math.random() * 0.6),
        life: life * (0.7 + Math.random() * 0.6),
        grow: 6,
        opacity: 0.55,
      });
    }
  }

  /** The expanding pulse at a ring the moment it is flown through. */
  ringPulse(ringMesh) {
    const pulse = this.pulses[this.pulseCursor];
    this.pulseCursor = (this.pulseCursor + 1) % this.pulses.length;
    pulse.mesh.position.copy(ringMesh.position);
    pulse.mesh.quaternion.copy(ringMesh.quaternion);
    pulse.life = 0.55;
    pulse.mesh.visible = true;
  }

  /** Exhaust puffs behind the plane while the throttle is up. */
  updateExhaust(dt, plane, throttle, flying) {
    if (!flying || throttle < 0.35) return;
    this.exhaustTimer -= dt;
    if (this.exhaustTimer > 0) return;
    this.exhaustTimer = 0.07;
    const back = {
      x: plane.position.x + Math.sin(plane.heading) * 6,
      y: plane.position.y - 0.4,
      z: plane.position.z + Math.cos(plane.heading) * 6,
    };
    this.spawn(back.x, back.y, back.z, {
      color: 0xd8dee2,
      vx: Math.sin(plane.heading) * 4,
      vy: 0.6,
      vz: Math.cos(plane.heading) * 4,
      scale: 1.6 + throttle * 1.6,
      life: 0.55,
      grow: 5,
      opacity: 0.16 + throttle * 0.14,
    });
  }

  /** Dark smoke trailing a badly damaged plane. */
  updateDamageSmoke(dt, plane, damage) {
    if (damage < 55) return;
    this.spawn(plane.position.x, plane.position.y + 0.6, plane.position.z, {
      color: 0x2c2c30,
      vx: (Math.random() - 0.5) * 2,
      vy: 2.2,
      vz: (Math.random() - 0.5) * 2,
      scale: 2.6,
      life: 0.8,
      grow: 7,
      opacity: 0.4,
    });
  }

  /** White dust kicked up at the moment of touchdown. */
  touchdownSmoke(position) {
    this.burst(position, 0xf2ede0, 10, 7, 3.2, 0.7);
  }

  /** Advance every live particle and pulse. */
  update(dt) {
    for (const p of this.particles) {
      if (!p.sprite.visible) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.sprite.visible = false;
        p.sprite.material.opacity = 0;
        continue;
      }
      const k = p.life / p.maxLife;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      const s = p.startScale + p.grow * p.life;
      p.sprite.scale.set(s, s, 1);
      p.sprite.material.opacity = p.startOpacity * (1 - k);
    }
    for (const pulse of this.pulses) {
      if (!pulse.mesh.visible) continue;
      pulse.life -= dt;
      if (pulse.life <= 0) {
        pulse.mesh.visible = false;
        pulse.mesh.material.opacity = 0;
        continue;
      }
      const k = 1 - pulse.life / 0.55;
      const s = 26 + k * 30;
      pulse.mesh.scale.set(s, s, s);
      pulse.mesh.material.opacity = 0.75 * (1 - k);
    }
  }
}
