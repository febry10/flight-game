// Sky Courier — the world: terrain, sea, sky, runway, clouds, rings and
// the plane itself, all built from Three.js primitives (no model files).
// The terrain height is analytic — the same function the physics uses — so
// the mesh the player sees and the ground the plane can hit always agree.
import * as THREE from 'three';
import { COLOURS, WORLD } from './config.js';
import { clamp, mulberry32, smoothstep } from './random.js';

/** Analytic terrain height at (x, z): sum of smooth island bumps, with the
    runway strip on the home island flattened to 24 m (fully flat over the
    strip, blending back to the island over a 60 m margin). The mesh and the
    physics both call this one function, so they always agree. */
export function terrainHeight(x, z) {
  let h = 0;
  for (const isl of WORLD.islands) {
    const dx = x - isl.x;
    const dz = z - isl.z;
    const d = Math.sqrt(dx * dx + dz * dz) / isl.r;
    if (d < 1) {
      const fall = smoothstep(1, 0.15, d);
      h += isl.h * fall * fall;
    }
  }
  const rw = WORLD.runway;
  const along = Math.abs(z - rw.z);
  const across = Math.abs(x - rw.x);
  const dOut = Math.max(0, along - rw.length / 2, across - rw.width / 2);
  if (dOut < 60) {
    const blend = smoothstep(0, 60, dOut);
    h = 24 * (1 - blend) + h * blend;
  }
  return h;
}

/** Build the low-poly plane from primitives: fuselage, wings, tail, prop. */
export function buildPlane() {
  const plane = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: COLOURS.planeBody, roughness: 0.55, metalness: 0.15 });
  const wingMat = new THREE.MeshStandardMaterial({ color: COLOURS.planeWing, roughness: 0.6, metalness: 0.1 });
  const trimMat = new THREE.MeshStandardMaterial({ color: COLOURS.planeTrim, roughness: 0.5, metalness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.7 });

  // Fuselage: a stretched, tapered body pointing along -Z (nose forward).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.55, 7.2, 12), bodyMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.scale.set(1, 1, 1);
  plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.0, 12), bodyMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.6;
  plane.add(nose);
  // Canopy: a glossy bubble the pilot sits under.
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.15, metalness: 0.4 }),
  );
  canopy.scale.set(1, 0.75, 1.9);
  canopy.position.set(0, 0.85, -0.9);
  plane.add(canopy);
  // Main wings, low on the fuselage, slightly swept.
  const wingGeo = new THREE.BoxGeometry(13.5, 0.22, 2.6);
  const wing = new THREE.Mesh(wingGeo, wingMat);
  wing.position.set(0, -0.25, -0.4);
  plane.add(wing);
  // Wing tips in trim colour.
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.24, 2.6), trimMat);
    tip.position.set(side * 6.4, -0.25, -0.4);
    plane.add(tip);
  }
  // Tail: horizontal stabiliser + vertical fin.
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 1.5), wingMat);
  tailWing.position.set(0, 0.25, 3.1);
  plane.add(tailWing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 1.9), trimMat);
  fin.position.set(0, 1.15, 3.1);
  plane.add(fin);
  // Propeller: hub + two blades, spun by the game loop.
  const prop = new THREE.Group();
  prop.position.set(0, 0, -5.7);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.0, 10), darkMat);
  hub.rotation.x = -Math.PI / 2;
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.5, 4.4, 0.12);
  const blade1 = new THREE.Mesh(bladeGeo, darkMat);
  const blade2 = new THREE.Mesh(bladeGeo, darkMat);
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade1);
  prop.add(blade2);
  plane.add(prop);
  // Landing gear: two fixed wheels + tail wheel.
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), darkMat);
    strut.position.set(side * 1.1, -1.15, -0.9);
    plane.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.1, -1.7, -0.9);
    plane.add(wheel);
  }
  // Navigation lights: red port, green starboard.
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  navL.position.set(-6.9, -0.25, -0.4);
  plane.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  navR.position.set(6.9, -0.25, -0.4);
  plane.add(navR);

  plane.userData.prop = prop;
  return plane;
}

export class World {
  constructor(seed) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xcfe8f2, 900, 3800);
    this.clouds = [];
    this.ringMeshes = [];
    this.cloudDrift = [];
    this.buildSky();
    this.buildLights();
    this.buildSea();
    this.buildTerrain();
    this.buildRunway();
    this.buildClouds();
    this.plane = buildPlane();
    this.scene.add(this.plane);
  }

  buildSky() {
    // A big gradient dome: warm horizon, deep blue above.
    const geo = new THREE.SphereGeometry(4200, 24, 16);
    const top = new THREE.Color(COLOURS.skyTop);
    const bottom = new THREE.Color(COLOURS.skyBottom);
    const colours = [];
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 4200;
      const c = bottom.clone().lerp(top, clamp(y * 1.6 + 0.25, 0, 1));
      colours.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    const dome = new THREE.Mesh(geo, mat);
    this.scene.add(dome);
    // Sun disc + a few distant birds for scale.
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(90, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }),
    );
    sun.position.set(-1600, 1500, -2600);
    sun.lookAt(0, 0, 0);
    this.scene.add(sun);
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a7a4a, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
    sun.position.set(-1200, 1600, -800);
    this.scene.add(sun);
  }

  buildSea() {
    const seaGeo = new THREE.PlaneGeometry(WORLD.size * 2.2, WORLD.size * 2.2, 1, 1);
    const seaMat = new THREE.MeshStandardMaterial({ color: COLOURS.sea, roughness: 0.35, metalness: 0.35 });
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    // A metre and a half above the terrain's flat base so the two never
    // z-fight where the island shelves meet the water.
    sea.position.y = WORLD.seaLevel + 1.5;
    this.scene.add(sea);
  }

  buildTerrain() {
    // One displaced plane, vertex-coloured by height: sand at the shore,
    // grass on the slopes, rock and snow on the peaks.
    const segments = 170;
    const size = WORLD.size;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colours = [];
    const sand = new THREE.Color(COLOURS.sand);
    const grass = new THREE.Color(COLOURS.grass);
    const grassDark = new THREE.Color(COLOURS.grassDark);
    const rock = new THREE.Color(COLOURS.rock);
    const snow = new THREE.Color(COLOURS.snow);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, Math.max(h, -2));
      let c;
      if (h < 3) c = sand.clone();
      else if (h < 26) c = sand.clone().lerp(grass, smoothstep(3, 10, h));
      else if (h < 70) c = grass.clone().lerp(grassDark, smoothstep(26, 70, h));
      else if (h < 120) c = grassDark.clone().lerp(rock, smoothstep(70, 120, h));
      else c = rock.clone().lerp(snow, smoothstep(120, 150, h));
      // Slight variation so the mesh does not look flat-shaded.
      const v = 0.97 + this.rng() * 0.06;
      colours.push(c.r * v, c.g * v, c.b * v);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
    const terrain = new THREE.Mesh(geo, mat);
    this.scene.add(terrain);
  }

  buildRunway() {
    const rw = WORLD.runway;
    const group = new THREE.Group();
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(rw.width, 1.2, rw.length),
      new THREE.MeshStandardMaterial({ color: COLOURS.runway, roughness: 0.85 }),
    );
    strip.position.set(rw.x, 24.2, rw.z);
    group.add(strip);
    // Centre dashes and threshold bars.
    const markMat = new THREE.MeshBasicMaterial({ color: COLOURS.runwayMark });
    for (let d = -rw.length / 2 + 40; d < rw.length / 2 - 20; d += 60) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 26), markMat);
      dash.position.set(rw.x, 24.9, rw.z + d);
      group.add(dash);
    }
    for (const end of [-1, 1]) {
      for (let k = -2; k <= 2; k++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.3, 14), markMat);
        bar.position.set(rw.x + k * 6, 24.9, rw.z + end * (rw.length / 2 - 22));
        group.add(bar);
      }
    }
    // A windsock and a little hangar beside the strip, both sitting on the
    // terrain as the height function reports it.
    const sockX = rw.x + 34;
    const sockZ = rw.z + 60;
    const sockGround = terrainHeight(sockX, sockZ);
    const sockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 16, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
    sockPole.position.set(sockX, sockGround + 8, sockZ);
    group.add(sockPole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 9, 10),
      new THREE.MeshStandardMaterial({ color: 0xff7f2a, roughness: 0.6 }),
    );
    sock.rotation.z = Math.PI / 2;
    sock.position.set(sockX + 4.5, sockGround + 15, sockZ);
    group.add(sock);
    const hangarX = rw.x - 58;
    const hangarZ = rw.z + 90;
    const hangarGround = terrainHeight(hangarX, hangarZ);
    const hangar = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 14, 26, 12, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.7 }),
    );
    hangar.rotation.z = Math.PI / 2;
    hangar.rotation.y = Math.PI / 2;
    hangar.position.set(hangarX, hangarGround, hangarZ);
    hangar.scale.set(1, 1, 1);
    group.add(hangar);
    this.scene.add(group);
  }

  buildClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: COLOURS.cloud, roughness: 1, transparent: true, opacity: 0.92,
      emissive: 0x9fb4c4, emissiveIntensity: 0.55,
    });
    const rng = mulberry32(this.seed ^ 0x5eed);
    for (let i = 0; i < WORLD.cloudCount; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(rng() * 4);
      for (let p = 0; p < puffs; p++) {
        const r = 14 + rng() * 22;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
        puff.position.set((rng() - 0.5) * 70, (rng() - 0.5) * 10, (rng() - 0.5) * 36);
        puff.scale.y = 0.55;
        cloud.add(puff);
      }
      const x = (rng() - 0.5) * WORLD.size * 0.9;
      const z = (rng() - 0.5) * WORLD.size * 0.9;
      const y = WORLD.cloudMinY + rng() * (WORLD.cloudMaxY - WORLD.cloudMinY);
      cloud.position.set(x, y, z);
      this.scene.add(cloud);
      this.clouds.push(cloud);
      this.cloudDrift.push({ vx: (rng() - 0.5) * 4, vz: (rng() - 0.5) * 4, baseY: y, phase: rng() * Math.PI * 2 });
    }
  }

  /** Build the ring meshes for a sortie; returns the meshes in order. */
  buildRings(ringPositions) {
    for (const m of this.ringMeshes) this.scene.remove(m);
    this.ringMeshes = [];
    const geo = new THREE.TorusGeometry(26, 2.2, 12, 40);
    ringPositions.forEach((p, i) => {
      const mat = new THREE.MeshStandardMaterial({
        color: i === 0 ? COLOURS.ringNext : COLOURS.ring,
        emissive: i === 0 ? 0x1d7a33 : 0x7a5a00,
        emissiveIntensity: 0.55,
        roughness: 0.4,
        metalness: 0.2,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.position.set(p[0], p[1], p[2]);
      // Face the ring along the course: look at the next ring (or the runway).
      const next = ringPositions[(i + 1) % ringPositions.length];
      ring.lookAt(next[0], next[1], next[2]);
      ring.userData.index = i;
      this.scene.add(ring);
      this.ringMeshes.push(ring);
    });
    return this.ringMeshes;
  }

  /** Highlight the next ring in green, passed ones dimmed. */
  setNextRing(index, passedCount) {
    this.ringMeshes.forEach((m, i) => {
      if (i < passedCount) {
        m.material.color.setHex(0x3a6b4a);
        m.material.emissive.setHex(0x0a2a14);
      } else if (i === index) {
        m.material.color.setHex(COLOURS.ringNext);
        m.material.emissive.setHex(0x1d7a33);
      } else {
        m.material.color.setHex(COLOURS.ring);
        m.material.emissive.setHex(0x7a5a00);
      }
    });
  }

  /** Drift clouds slowly; storm sorties drift faster. Called per frame. */
  updateClouds(dt, storm) {
    const speed = storm ? 2.2 : 1;
    this.clouds.forEach((c, i) => {
      const d = this.cloudDrift[i];
      c.position.x += d.vx * speed * dt;
      c.position.z += d.vz * speed * dt;
      c.position.y = d.baseY + Math.sin(performance.now() * 0.0002 + d.phase) * 4;
      const half = WORLD.size / 2;
      if (c.position.x > half) c.position.x = -half;
      if (c.position.x < -half) c.position.x = half;
      if (c.position.z > half) c.position.z = -half;
      if (c.position.z < -half) c.position.z = half;
    });
  }
}
