// Sky Courier — home-island scenery: crop fields, a village and dirt
// roads, so the island the player takes off from reads as a lived-in
// place from the air instead of one flat sheet of green. Everything is
// placed by the seeded rng on gentle ground near the runway and the
// harbour, and every quad is draped at the analytic terrain height, so
// the scenery hugs the same ground the physics uses. One job: build the
// static decoration group the World adds to its scene.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { mulberry32 } from './random.js';
import { terrainHeight } from './world.js';

// Field colours: ploughed earth, wheat, young crop, fallow — a patchwork
// the eye reads as farmland from a few hundred metres up.
const FIELD_COLOURS = [0xc9a86a, 0x8fbf5a, 0x6f9e4a, 0xb5894a, 0xd8c078, 0x7fae56];
const ROOF_COLOURS = [0xc23b2a, 0x8a4a2a, 0x5a6e7a, 0xb5894a];
const WALL_COLOURS = [0xf2ede0, 0xe8dcc2, 0xd8cfc0];

/** A flat quad draped over the terrain: a plane whose four corners sit
    on the height function, lifted a touch so it never z-fights. */
function drapedQuad(cx, cz, w, d, rotY, colour, lift) {
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: colour, roughness: 0.95 }),
  );
  mesh.position.set(cx, 0, cz);
  // Bake the rotation into the corner offsets, then set each corner's
  // height from the world point that corner lands on.
  const pos = geo.attributes.position;
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const rx = lx * cos - lz * sin;
    const rz = lx * sin + lz * cos;
    pos.setX(i, rx);
    pos.setZ(i, rz);
    pos.setY(i, terrainHeight(cx + rx, cz + rz) + lift);
  }
  geo.computeVertexNormals();
  mesh.receiveShadow = true;
  return mesh;
}

/** Crop fields on the home island's gentle slopes, kept clear of the
    runway strip, its approach and the village green. */
function buildFields(group, rng) {
  let placed = 0;
  for (let i = 0; i < 300 && placed < 26; i++) {
    const x = (rng() - 0.5) * 760;
    const z = (rng() - 0.5) * 860 + 40;
    const h = terrainHeight(x, z);
    if (h < 27 || h > 44) continue; // gentle, low ground only
    if (Math.abs(x - WORLD.runway.x) < 95) continue; // keep the strip clear
    if (Math.hypot(x - 120, z - 300) < 130) continue; // keep the village clear
    const w = 46 + rng() * 54;
    const d = 36 + rng() * 48;
    const colour = FIELD_COLOURS[Math.floor(rng() * FIELD_COLOURS.length)];
    group.add(drapedQuad(x, z, w, d, (rng() - 0.5) * 0.9, colour, 0.55));
    placed += 1;
  }
}

/** A house: walls, a pitched roof and a chimney, sitting on the ground
    the height function reports. */
function buildHouse(rng) {
  const house = new THREE.Group();
  const w = 9 + rng() * 4;
  const d = 8 + rng() * 3;
  const h = 4.5 + rng() * 1.5;
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: WALL_COLOURS[Math.floor(rng() * WALL_COLOURS.length)], roughness: 0.9 }),
  );
  walls.position.y = h / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  house.add(walls);
  // Pitched roof: a prism made from a cylinder with three segments.
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, Math.max(w, d) * 0.72, d + 1.6, 3, 1),
    new THREE.MeshStandardMaterial({ color: ROOF_COLOURS[Math.floor(rng() * ROOF_COLOURS.length)], roughness: 0.85 }),
  );
  roof.rotation.x = Math.PI / 2;
  roof.rotation.z = Math.PI;
  roof.scale.set(1, 1, 0.62);
  roof.position.y = h + Math.max(w, d) * 0.22;
  roof.castShadow = true;
  house.add(roof);
  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 2.6, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.95 }),
  );
  chimney.position.set(w * 0.28, h + 1.6, 0);
  house.add(chimney);
  return house;
}

/** The village: a loose cluster of houses around the harbour shore,
    south-east of the runway, each turned a little differently. */
function buildVillage(group, rng) {
  const centre = { x: 120, z: 300 };
  for (let i = 0; i < 14; i++) {
    const a = rng() * Math.PI * 2;
    const r = 18 + rng() * 95;
    const x = centre.x + Math.cos(a) * r;
    const z = centre.z + Math.sin(a) * r * 0.8;
    if (Math.abs(x - WORLD.runway.x) < 80) continue;
    const house = buildHouse(rng);
    house.position.set(x, terrainHeight(x, z), z);
    house.rotation.y = rng() * Math.PI;
    group.add(house);
  }
  // A little church with a tower at the village heart — the landmark
  // the cover shot flies toward.
  const church = new THREE.Group();
  const nave = new THREE.Mesh(
    new THREE.BoxGeometry(11, 7, 20),
    new THREE.MeshStandardMaterial({ color: 0xf2ede0, roughness: 0.9 }),
  );
  nave.position.y = 3.5;
  nave.castShadow = true;
  church.add(nave);
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(5, 15, 5),
    new THREE.MeshStandardMaterial({ color: 0xe8dcc2, roughness: 0.9 }),
  );
  tower.position.set(0, 7.5, -11);
  tower.castShadow = true;
  church.add(tower);
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(3.6, 7, 4),
    new THREE.MeshStandardMaterial({ color: 0x5a6e7a, roughness: 0.8 }),
  );
  spire.position.set(0, 18.5, -11);
  spire.rotation.y = Math.PI / 4;
  church.add(spire);
  church.position.set(centre.x, terrainHeight(centre.x, centre.z), centre.z);
  group.add(church);
}

/** Dirt roads: from the runway to the village and down to the harbour,
    drawn as chains of short draped quads following the terrain. */
function buildRoads(group) {
  const roadMat = 0x9a7d55;
  const paths = [
    // Runway east side down to the village.
    [[46, 120], [80, 190], [104, 250], [118, 292]],
    // Village green to the harbour crates.
    [[140, 330], [168, 372], [196, 408], [206, 424]],
    // A farm track west of the strip.
    [[-52, -160], [-88, -90], [-104, -10], [-96, 70]],
  ];
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const [x0, z0] = path[i];
      const [x1, z1] = path[i + 1];
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const rotY = Math.atan2(z1 - z0, x1 - x0);
      group.add(drapedQuad(cx, cz, len + 4, 7, rotY, roadMat, 0.7));
    }
  }
}

/** Build all home-island scenery; returns the group for the scene. */
export function buildScenery(seed) {
  const rng = mulberry32(seed ^ 0xf1e1d);
  const group = new THREE.Group();
  buildFields(group, rng);
  buildVillage(group, rng);
  buildRoads(group);
  return group;
}
