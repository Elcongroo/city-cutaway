import * as THREE from './vendor/three.module.js';
import { groundY } from './coast-terrain.js';

const BOX = new THREE.BoxGeometry();
const CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const ARCH = new THREE.TorusGeometry(1, 0.075, 5, 24, Math.PI);
const UP = new THREE.Vector3(0, 1, 0);
const NORTH_LIMIT = -25.45;
const SOUTH_LIMIT = 60.4;
const CENTER_METRO = -16.2;
const TRACKS = [-18.05, -14.35];
const METRO_FLOOR_Y = -14.15;
const VEHICLE_CUT = [
  new THREE.Plane(new THREE.Vector3(0, 0, 1), -NORTH_LIMIT),
  new THREE.Plane(new THREE.Vector3(0, 0, -1), SOUTH_LIMIT),
];

function finish(color, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.64, ...extras });
}

function glow(color, intensity = 0.8, extras = {}) {
  return finish(color, { emissive: color, emissiveIntensity: intensity, ...extras });
}

function batches(target) {
  const items = new Map();
  const pose = new THREE.Object3D();
  const direction = new THREE.Vector3();

  function stash(material, geometry) {
    if (!items.has(material)) items.set(material, new Map());
    const geometries = items.get(material);
    if (!geometries.has(geometry)) geometries.set(geometry, []);
    pose.updateMatrix();
    geometries.get(geometry).push(pose.matrix.clone());
  }

  function piece(material, x, y, z, width, height, length, ax = 0, ay = 0, az = 0, geometry = BOX) {
    pose.position.set(x, y, z);
    pose.scale.set(width, height, length);
    pose.rotation.set(ax, ay, az);
    stash(material, geometry);
  }

  function rod(material, a, b, width) {
    direction.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = direction.length();
    if (length < 0.001) return;
    pose.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    pose.scale.set(width, length, width);
    pose.quaternion.setFromUnitVectors(UP, direction.divideScalar(length));
    stash(material, CYLINDER);
  }

  function flush() {
    for (const [material, geometries] of items) {
      for (const [geometry, matrices] of geometries) {
        const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
        matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
        mesh.computeBoundingSphere();
        target.add(mesh);
      }
    }
  }
  return { piece, rod, flush };
}

const stock = {
  pavement: finish(0x303742),
  concrete: finish(0x657988),
  wall: finish(0x405766),
  dark: finish(0x24323d),
  steel: finish(0x939ca7, { metalness: 0.38, roughness: 0.35 }),
  amber: glow(0xffa33e, 0.68),
  orange: finish(0xd88a44),
  teal: glow(0x32f4d3, 0.82),
  tealSteel: finish(0x3e9f99),
  blue: glow(0x62cdfc, 0.62),
  pipe: finish(0x388cb3, { metalness: 0.26 }),
  coupling: finish(0x86bac7, { metalness: 0.32 }),
  violet: glow(0xa18cff, 0.66),
  purple: finish(0x655983),
  glass: finish(0x407f9b, { metalness: 0.24, roughness: 0.24, transparent: true, opacity: 0.68 }),
  white: glow(0xfff2cf, 0.56),
  line: finish(0xc5cdd1),
  warning: finish(0xf1c26b),
  curb: finish(0xd1dce0),
  rubber: finish(0x1b2530),
  vehicleGlass: finish(0x2e4c65, { metalness: 0.34, roughness: 0.32 }),
};

const carPalette = [
  finish(0xde6c56, { metalness: 0.24 }),
  finish(0xf0c67b, { metalness: 0.27 }),
  finish(0x85accb, { metalness: 0.31 }),
  finish(0xd3dbe0, { metalness: 0.33 }),
  finish(0x79af9a, { metalness: 0.26 }),
  finish(0xaf84c1, { metalness: 0.27 }),
];
const lampFront = glow(0xfff2ce, 1.65);
const lampRear = glow(0xff634a, 1.0);
const clipped = new Map();
function moving(material) {
  if (!clipped.has(material)) {
    const clone = material.clone();
    clone.clippingPlanes = VEHICLE_CUT;
    clipped.set(material, clone);
  }
  return clipped.get(material);
}

function modelCar(parts, x, y, z, yaw, body, scale = 1, motion = false) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const material = motion ? moving : item => item;
  function set(surface, dx, dy, dz, sx, sy, sz, geometry = BOX, tilt = 0) {
    parts.piece(material(surface), x + (cos * dx + sin * dz) * scale, y + dy * scale, z + (cos * dz - sin * dx) * scale,
      sx * scale, sy * scale, sz * scale, 0, yaw, tilt, geometry);
  }
  set(body, 0, 0.38, 0, 1.40, 0.37, 3.02);
  set(body, 0, 0.59, 0.90, 1.31, 0.16, 1.18);
  set(stock.vehicleGlass, 0, 0.77, -0.18, 1.25, 0.49, 1.58);
  set(body, 0, 1.04, -0.22, 1.16, 0.14, 1.51);
  set(stock.dark, 0, 0.24, 1.50, 1.29, 0.14, 0.10);
  set(stock.dark, 0, 0.24, -1.50, 1.29, 0.14, 0.10);
  for (const side of [-1, 1]) {
    set(lampFront, side * 0.45, 0.46, 1.532, 0.25, 0.13, 0.047);
    set(lampRear, side * 0.49, 0.47, -1.53, 0.19, 0.12, 0.047);
    for (const axle of [-1, 1]) {
      set(stock.rubber, side * 0.68, 0.25, axle * 0.95, 0.51, 0.21, 0.51, CYLINDER, Math.PI / 2);
      set(stock.steel, side * 0.795, 0.25, axle * 0.95, 0.21, 0.035, 0.21, CYLINDER, Math.PI / 2);
    }
  }
}

function utilityGallery(parent) {
  const parts = batches(parent);
  const paths = [
    [[-16, -3.45, 50], [3.5, -3.45, 50], [3.5, -3.45, 33], [10.5, -3.45, 27]],
    [[-15.1, -3.82, 52.05], [5.4, -3.82, 52.05], [5.4, -3.82, 34], [12.25, -3.82, 29]],
    [[-14.7, -3.16, 54.05], [7.75, -3.16, 54.05], [7.75, -3.16, 34], [14.2, -3.16, 30.7]],
  ];
  parts.piece(stock.wall, 2, -4.15, 52, 34, 0.38, 6.2);
  parts.piece(stock.wall, 6, -4.24, 41.7, 6.95, 0.46, 17.65);
  paths.forEach((path, index) => {
    const diameter = 1.02 - index * 0.16;
    for (let point = 1; point < path.length; point++) {
      parts.rod(index === 0 ? stock.blue : stock.pipe, path[point - 1], path[point], diameter);
      const start = new THREE.Vector3(...path[point - 1]);
      const end = new THREE.Vector3(...path[point]);
      const separation = start.distanceTo(end);
      for (let at = 1.8; at < separation; at += 3.4) {
        const left = start.clone().lerp(end, (at - 0.10) / separation);
        const right = start.clone().lerp(end, (at + 0.10) / separation);
        parts.rod(stock.coupling, left.toArray(), right.toArray(), diameter + 0.26);
      }
    }
  });
  for (const x of [-9.6, -0.6, 8.8]) {
    parts.piece(stock.coupling, x, -3.77, 52.16, 0.36, 0.65, 6.4);
    parts.piece(stock.blue, x, -2.94, 52.20, 0.19, 0.17, 5.9);
  }
  parts.piece(stock.wall, 9, -3.98, 49, 4.7, 0.44, 4.8);
  parts.piece(stock.pipe, 10, -2.96, 48.2, 1.76, 1.81, 2.2);
  parts.piece(stock.steel, 10, -1.99, 48.2, 1.94, 0.19, 2.36);
  parts.piece(stock.blue, 9.43, -2.66, 49.34, 0.62, 0.30, 0.06);
  parts.flush();

  const curve = new THREE.CurvePath();
  for (let i = 1; i < paths[0].length; i++) {
    curve.add(new THREE.LineCurve3(new THREE.Vector3(...paths[0][i - 1]), new THREE.Vector3(...paths[0][i])));
  }
  const liveFlow = new THREE.InstancedMesh(BOX, glow(0xbbf2ff, 1.6), 12);
  liveFlow.frustumCulled = false;
  liveFlow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  parent.add(liveFlow);
  const pulse = new THREE.Object3D();
  const up = new THREE.Vector3(0, 0.52, 0);
  pulse.scale.set(0.18, 0.10, 0.38);
  return elapsed => {
    for (let index = 0; index < liveFlow.count; index++) {
      const at = (elapsed * 0.19 + index / liveFlow.count) % 1;
      pulse.position.copy(curve.getPointAt(at)).add(up);
      pulse.updateMatrix();
      liveFlow.setMatrixAt(index, pulse.matrix);
    }
    liveFlow.instanceMatrix.needsUpdate = true;
  };
}

function garageDeck(target, y, start, end, rank) {
  const parts = batches(target);
  const middle = (start + end) / 2;
  const length = end - start;
  const width = 18.6;
  const x = -1.5;
  parts.piece(stock.concrete, x, y - 0.24, middle, width, 0.48, length);
  parts.piece(stock.pavement, x, y + 0.029, middle, width - 0.28, 0.06, length - 0.33);
  for (const side of [-1, 1]) {
    const edge = x + side * width * 0.5;
    parts.piece(stock.purple, edge, y + 0.26, middle, 0.36, 0.55, length);
    parts.piece(stock.violet, edge + side * 0.19, y + 0.34, middle, 0.07, 0.08, length - 0.2);
    for (let z = start + 0.9; z < end; z += 4.8) {
      parts.piece(stock.concrete, edge, y + 1.32, z, 0.46, 2.70, 0.58);
      parts.piece(stock.purple, edge, y + 0.78, z, 0.49, 0.43, 0.61);
      parts.piece(stock.white, edge - side * 0.2, y + 2.55, z, 0.31, 0.11, 1.52);
    }
    for (let spot = 0; spot < 8; spot++) {
      const z = start + 1.05 + spot * (length - 1.75) / 8;
      parts.piece(stock.line, x + side * 6.08, y + 0.073, z, 5.1, 0.025, 0.062);
      const onRamp = rank === 1 && side < 0 && z < 37.7;
      const occupied = !onRamp && (spot + (side + 1) + rank * 2) % 5 !== 0;
      if (occupied && z + 0.99 < end - 0.7) {
        modelCar(parts, x + side * 5.9, y + 0.074, z + 0.99, side * Math.PI * 0.5,
          carPalette[(spot * 3 + side + 2 + rank) % carPalette.length], 0.92);
      }
    }
    parts.piece(stock.line, x + side * 3.50, y + 0.073, middle, 0.12, 0.022, length - 0.58);
  }
  for (let z = start + 1.8; z < end; z += 4) {
    parts.piece(stock.warning, x, y + 0.081, z, 0.116, 0.03, 1.36);
    parts.piece(stock.line, x + 1.2, y + 0.081, z, 0.14, 0.03, 0.83, 0, 0.46);
    parts.piece(stock.line, x + 1.60, y + 0.081, z, 0.14, 0.03, 0.83, 0, -0.46);
  }
  for (const z of [start + 1.2, end - 1.9]) {
    parts.piece(stock.dark, x + 7.25, y + 0.72, z, 0.61, 1.40, 0.61);
    parts.piece(stock.teal, x + 7.25, y + 0.99, z - 0.33, 0.34, 0.42, 0.04);
  }
  parts.piece(stock.violet, x - width * 0.3, y + 0.62, end + 0.03, width * 0.42, 0.19, 0.085);
  parts.flush();
}

function slopingBox(parts, material, x, z0, z1, y0, y1, width, thickness) {
  const pitch = -Math.atan2(y1 - y0, z1 - z0);
  parts.piece(material, x, (y0 + y1) * 0.5, (z0 + z1) * 0.5, width, thickness, Math.hypot(z1 - z0, y1 - y0), pitch);
}

function parking(upper, lower) {
  garageDeck(upper, -5.95, 27.4, 44.5, 1);
  garageDeck(lower, -10.20, 37.6, 54.8, 2);
  const upperRamp = batches(upper);
  const entryHeight = groundY(-8, 26.9) + 0.03;
  slopingBox(upperRamp, stock.pavement, -8, 26.9, 37.1, entryHeight, -5.82, 2.45, 0.25);
  slopingBox(upperRamp, stock.violet, -9.27, 26.9, 37.1, entryHeight + 0.17, -5.65, 0.115, 0.145);
  slopingBox(upperRamp, stock.violet, -6.73, 26.9, 37.1, entryHeight + 0.17, -5.65, 0.115, 0.145);
  upperRamp.flush();
  const lowerRamp = batches(lower);
  slopingBox(lowerRamp, stock.pavement, -0.35, 41.1, 52.9, -5.72, -10.08, 2.8, 0.26);
  slopingBox(lowerRamp, stock.violet, 1.07, 41.1, 52.9, -5.49, -9.85, 0.12, 0.17);
  slopingBox(lowerRamp, stock.violet, -1.77, 41.1, 52.9, -5.49, -9.85, 0.12, 0.17);
  lowerRamp.flush();
}

function metroTrack(target) {
  const parts = batches(target);
  const length = SOUTH_LIMIT - NORTH_LIMIT;
  const middle = (SOUTH_LIMIT + NORTH_LIMIT) / 2;
  parts.piece(stock.wall, CENTER_METRO, METRO_FLOOR_Y - 0.23, middle, 8.5, 0.5, length);
  for (const x of TRACKS) {
    parts.piece(stock.dark, x, METRO_FLOOR_Y + 0.055, middle, 2.36, 0.12, length);
    for (const side of [-1, 1]) {
      parts.piece(stock.steel, x + side * 0.55, METRO_FLOOR_Y + 0.39, middle, 0.11, 0.19, length);
    }
    for (let z = NORTH_LIMIT + 0.7; z < SOUTH_LIMIT; z += 1.08) {
      parts.piece(stock.concrete, x, METRO_FLOOR_Y + 0.22, z, 1.94, 0.13, 0.31);
    }
  }
  for (const side of [-1, 1]) {
    const wallX = CENTER_METRO + side * 4.02;
    parts.piece(stock.tealSteel, wallX, METRO_FLOOR_Y + 0.88, middle, 0.34, 1.38, length);
    parts.piece(stock.teal, wallX + side * 0.192, METRO_FLOOR_Y + 0.84, middle, 0.066, 0.13, length - 0.3);
    for (let z = NORTH_LIMIT + 1.45; z < SOUTH_LIMIT; z += 6.43) {
      parts.piece(stock.concrete, wallX, METRO_FLOOR_Y + 2.31, z, 0.23, 3.0, 0.27);
    }
  }
  for (const z of [-24.5, -7.9, -2.2, 4, 10.1, 16.2, 22.3, 43.5, 52, 59]) {
    parts.piece(stock.tealSteel, CENTER_METRO, METRO_FLOOR_Y + 1.61, z, 4.01, 3.15, 1.65, 0, 0, 0, ARCH);
    parts.piece(stock.teal, CENTER_METRO, METRO_FLOOR_Y + 1.66, z + 0.11, 3.93, 3.02, 0.45, 0, 0, 0, ARCH);
  }
  parts.flush();
}

function metroStation(target, start, end, entranceZ) {
  const parts = batches(target);
  const middle = (start + end) / 2;
  const length = end - start;
  const x = CENTER_METRO;
  const platformY = METRO_FLOOR_Y + 1.1;
  parts.piece(stock.curb, x + 0.02, platformY - 0.20, middle, 1.75, 0.43, length);
  parts.piece(stock.wall, x + 3.65, platformY - 0.24, middle, 1.05, 0.51, length);
  for (const s of [-1, 1]) {
    parts.piece(stock.teal, x + s * 0.87, platformY + 0.043, middle, 0.14, 0.08, length - 0.24);
    parts.piece(stock.warning, x + s * 0.62, platformY + 0.02, middle, 0.14, 0.05, length - 0.24);
  }
  for (let z = start + 1.15; z < end; z += 3.45) {
    parts.piece(stock.concrete, x, platformY + 1.45, z, 0.27, 2.9, 0.32);
    parts.piece(stock.tealSteel, x, platformY + 0.97, z, 0.29, 0.89, 0.35);
    parts.piece(stock.wall, x, platformY + 2.87, z, 3.55, 0.16, 0.25);
    parts.piece(stock.white, x + 0.75, platformY + 2.80, z, 0.72, 0.069, 0.11);
    parts.piece(stock.white, x - 0.75, platformY + 2.80, z, 0.72, 0.069, 0.11);
  }
  for (let z = start + 3.25; z < end - 1; z += 6.9) {
    parts.piece(stock.tealSteel, x, platformY + 0.45, z, 0.42, 0.16, 1.46);
    parts.piece(stock.steel, x + 0.11, platformY + 0.25, z - 0.39, 0.14, 0.45, 0.17);
    parts.piece(stock.steel, x - 0.11, platformY + 0.25, z + 0.39, 0.14, 0.45, 0.17);
    parts.piece(stock.dark, x, platformY + 1.9, z - 0.8, 0.83, 0.42, 0.17);
    parts.piece(stock.teal, x, platformY + 1.9, z - 0.902, 0.53, 0.13, 0.052);
  }

  const stairX = x + 4.3;
  const topLanding = groundY(stairX, entranceZ) + 0.24;
  const direction = entranceZ > 0 ? 1 : -1;
  for (let step = 0; step < 23; step++) {
    const routeZ = entranceZ + (step - 22) * 0.40 * direction;
    const routeY = THREE.MathUtils.lerp(-11.62, topLanding, step / 22);
    parts.piece(stock.steel, stairX, routeY - 0.13, routeZ, 1.33, 0.32, 0.52);
    if (step % 3 === 0) {
      parts.piece(stock.tealSteel, stairX - 0.72, routeY + 0.41, routeZ, 0.10, 0.71, 0.10);
      parts.piece(stock.tealSteel, stairX + 0.72, routeY + 0.41, routeZ, 0.10, 0.71, 0.10);
    }
  }
  for (const sides of [-1, 1]) {
    parts.rod(stock.teal, [stairX + sides * 0.72, -10.94, entranceZ - direction * 8.78],
      [stairX + sides * 0.72, topLanding + 0.7, entranceZ], 0.082);
    parts.piece(stock.concrete, stairX + sides * 1.11, topLanding + 0.20, entranceZ, 0.16, 0.69, 3.2);
  }
  parts.flush();
}

function mainEntrance(scene, x, z, orientation) {
  const entry = new THREE.Group();
  entry.position.set(x, groundY(x, z) + 0.17, z);
  entry.rotation.y = orientation;
  const parts = batches(entry);
  parts.piece(stock.concrete, 0, -0.12, 0, 3.8, 0.36, 4.2);
  parts.piece(stock.dark, 0, 0.06, 0, 2.92, 0.1, 3.7);
  parts.piece(stock.tealSteel, 0, 2.25, -0.19, 3.71, 0.22, 4.05);
  parts.piece(stock.teal, 0, 2.14, 1.78, 3.68, 0.13, 0.12);
  for (const x of [-1.64, 1.64]) {
    parts.piece(stock.steel, x, 1.07, -1.95, 0.15, 2.26, 0.17);
    parts.piece(stock.steel, x, 1.07, 1.66, 0.15, 2.26, 0.17);
    parts.piece(stock.glass, x, 1.02, -0.13, 0.08, 1.89, 3.21);
  }
  for (const side of [-1, 1]) {
    parts.piece(stock.teal, side * 0.30, 2.71, 1.82, 0.13, 0.62, 0.14);
    parts.piece(stock.teal, side * 0.15, 2.76, 1.82, 0.12, 0.44, 0.14, 0, 0, -side * 0.62);
  }
  parts.flush();
  scene.add(entry);
}

function trainModel() {
  const train = new THREE.Group();
  const parts = batches(train);
  const skin = moving(finish(0xc3d3de, { metalness: 0.33, roughness: 0.34 }));
  const belt = moving(glow(0x32ead3, 0.62));
  const dark = moving(stock.vehicleGlass);
  const lit = moving(glow(0xffe5ad, 1.08));
  const rail = moving(stock.dark);
  const cars = [-7.65, -2.55, 2.55, 7.65];
  for (const z of cars) {
    parts.piece(skin, 0, 1.21, z, 1.72, 1.53, 4.88);
    parts.piece(skin, 0, 2.04, z, 1.60, 0.23, 4.78);
    parts.piece(rail, 0, 0.40, z, 1.52, 0.17, 4.76);
    parts.piece(rail, 0, 2.19, z + 0.74, 0.87, 0.18, 1.03);
    parts.piece(rail, 0, 2.19, z - 0.68, 0.87, 0.18, 1.03);
    for (const side of [-1, 1]) {
      parts.piece(belt, side * 0.87, 1.06, z, 0.059, 0.20, 4.88);
      parts.piece(dark, side * 0.881, 1.61, z, 0.069, 0.59, 4.73);
      for (const frame of [-1.75, -0.81, 0, 0.81, 1.75]) {
        parts.piece(lit, side * 0.922, 1.64, z + frame, 0.029, 0.39, 0.57);
      }
      for (const cabin of [-1.22, 1.22]) {
        parts.piece(skin, side * 0.927, 1.20, z + cabin, 0.046, 1.41, 0.15);
        parts.piece(rail, side * 0.954, 1.12, z + cabin, 0.025, 0.17, 0.073);
      }
      for (const pair of [-1.55, -1.04, 1.04, 1.55]) {
        parts.piece(rail, side * 0.74, 0.26, z + pair, 0.46, 0.17, 0.46, 0, 0, Math.PI / 2, CYLINDER);
      }
    }
  }
  for (const z of [-5.10, 0, 5.10]) parts.piece(rail, 0, 1.08, z, 1.26, 1.56, 0.38);
  for (const side of [-1, 1]) {
    const z = side * 10.09;
    parts.piece(dark, 0, 1.64, z, 1.52, 0.63, 0.27);
    parts.piece(belt, 0, 0.92, z + side * 0.16, 1.58, 0.16, 0.11);
    for (const x of [-0.53, 0.53]) {
      parts.piece(moving(side > 0 ? lampFront : lampRear), x, 0.79, z + side * 0.22, 0.24, 0.20, 0.11);
    }
  }
  parts.flush();
  return train;
}

function roadCourse(z) {
  const t = (z - 13) / 46.5;
  const span = SOUTH_LIMIT - NORTH_LIMIT;
  const theta = (z - NORTH_LIMIT) / span * Math.PI;
  const bend = Math.sin(theta);
  return {
    x: 16 + 5.4 * bend * bend,
    y: -21.65 + 4.55 * t * t,
    yaw: Math.atan(10.8 * bend * Math.cos(theta) * Math.PI / span),
    pitch: -Math.atan(9.1 * t / 46.5),
  };
}

function roadway(target) {
  const parts = batches(target);
  for (let z = NORTH_LIMIT + 0.6; z < SOUTH_LIMIT; z += 1.26) {
    const path = roadCourse(z);
    parts.piece(stock.concrete, path.x, path.y - 0.35, z, 9.7, 0.65, 1.30, path.pitch, path.yaw);
    parts.piece(stock.pavement, path.x, path.y, z, 8.9, 0.16, 1.30, path.pitch, path.yaw);
    for (const side of [-1, 1]) {
      const offset = side * 4.14;
      parts.piece(stock.warning, path.x + offset * Math.cos(path.yaw), path.y + 0.23, z - offset * Math.sin(path.yaw),
        0.22, 0.19, 1.33, path.pitch, path.yaw);
    }
  }
  for (let z = NORTH_LIMIT + 1.0; z < SOUTH_LIMIT; z += 3.05) {
    const path = roadCourse(z);
    parts.piece(stock.line, path.x, path.y + 0.091, z, 0.14, 0.031, 1.69, path.pitch, path.yaw);
    for (const side of [-1, 1]) {
      const offset = side * 4.63;
      parts.piece(stock.amber, path.x + offset * Math.cos(path.yaw), path.y + 0.30, z - offset * Math.sin(path.yaw),
        0.18, 0.095, 1.24, path.pitch, path.yaw);
    }
  }
  for (let z = NORTH_LIMIT + 0.9; z < SOUTH_LIMIT; z += 7.02) {
    const path = roadCourse(z);
    const section = (z < -21 || z > 55) ? stock.amber : stock.orange;
    parts.piece(stock.wall, path.x, path.y + 1.14, z, 4.72, 3.23, 2.04, 0, path.yaw, 0, ARCH);
    parts.piece(section, path.x, path.y + 1.13, z + 0.13, 4.59, 3.07, 0.53, 0, path.yaw, 0, ARCH);
    for (const side of [-1, 1]) {
      const offset = side * 4.68;
      const x = path.x + offset * Math.cos(path.yaw);
      const at = z - offset * Math.sin(path.yaw);
      parts.piece(stock.wall, x, path.y + 0.67, at, 0.41, 1.26, 0.31, 0, path.yaw);
      parts.piece(stock.white, x - side * 0.42, path.y + 1.19, at, 0.43, 0.10, 0.25, 0, path.yaw);
    }
    if (z > -7 && z < 23) {
      for (const side of [-1, 1]) {
        parts.piece(stock.concrete, path.x + side * 3.45, path.y - 1.03, z, 0.49, 1.68, 0.70);
      }
    }
  }
  parts.flush();
}

function portalSigns(scene) {
  const parts = batches(scene);
  for (const z of [-25.1, 63.2]) {
    const y = groundY(16, z);
    for (const side of [-1, 1]) {
      parts.piece(stock.concrete, 16 + side * 2.18, y + 1.22, z, 0.22, 2.44, 0.28);
      parts.piece(stock.orange, 16 + side * 2.18, y + 0.47, z, 0.31, 0.86, 0.32);
    }
    parts.piece(stock.dark, 16, y + 2.61, z, 4.58, 0.48, 0.36);
    parts.piece(stock.amber, 16, y + 2.63, z, 3.19, 0.17, 0.41);
  }
  parts.flush();
}

function roadTraffic(parent) {
  const cars = [];
  for (let i = 0; i < 9; i++) {
    const node = new THREE.Group();
    const parts = batches(node);
    modelCar(parts, 0, 0.07, 0, 0, carPalette[i % carPalette.length], i % 5 === 0 ? 1.05 : 0.94, true);
    parts.flush();
    parent.add(node);
    cars.push(node);
  }
  return elapsed => {
    const span = SOUTH_LIMIT - NORTH_LIMIT + 5.2;
    cars.forEach((car, index) => {
      const heading = index % 2 ? -1 : 1;
      const along = (elapsed * (5.9 + index % 3 * 0.22) + index * 17.27) % span - 2.6;
      const z = heading > 0 ? NORTH_LIMIT + along : SOUTH_LIMIT - along;
      const { x, y, yaw, pitch } = roadCourse(z);
      car.position.set(x + heading * 2.12 * Math.cos(yaw), y + 0.035, z - heading * 2.12 * Math.sin(yaw));
      car.rotation.set(heading * pitch, yaw + (heading === -1 ? Math.PI : 0), 0, 'YXZ');
    });
  };
}

export function createCoastInfrastructure(scene) {
  const underground = new THREE.Group();
  underground.name = 'Coastal underground network';
  scene.add(underground);
  const utilities = new THREE.Group();
  const parkUpper = new THREE.Group();
  const parkLower = new THREE.Group();
  const metro = new THREE.Group();
  const road = new THREE.Group();
  underground.add(utilities, parkUpper, parkLower, metro, road);
  const moveUtilities = utilityGallery(utilities);
  parking(parkUpper, parkLower);
  metroTrack(metro);
  metroStation(metro, -25.2, -9.7, -18.4);
  metroStation(metro, 24.3, 43.2, 49.9);
  mainEntrance(scene, -11.9, -18.4, Math.PI);
  mainEntrance(scene, -11.9, 49.9, 0);
  portalSigns(scene);
  roadway(road);
  const moveCars = roadTraffic(road);
  const trains = [trainModel(), trainModel()];
  metro.add(...trains);
  const features = {
    utilities: new THREE.Vector3(4, -2.65, 54),
    parking: new THREE.Vector3(-2, -6.2, 41),
    metro: new THREE.Vector3(-15.8, -11.0, 34),
    tunnel: new THREE.Vector3(19.0, -19.2, 11),
  };

  function update(_dt, elapsed, depth) {
    const level = THREE.MathUtils.clamp(Number(depth) || 0, 0, 30);
    underground.visible = level > 2.4;
    utilities.visible = level > 2.8;
    parkUpper.visible = level > 4.4;
    parkLower.visible = level > 8.45;
    metro.visible = level > 9.1;
    road.visible = level > 15.8;
    if (utilities.visible) moveUtilities(elapsed);
    if (road.visible) moveCars(elapsed);

    const fullLength = SOUTH_LIMIT - NORTH_LIMIT + 20.4;
    trains.forEach((train, index) => {
      const offset = (elapsed * 5.65 + (index ? 75.3 : 42.5)) % fullLength - 10.2;
      const z = index ? SOUTH_LIMIT - offset : NORTH_LIMIT + offset;
      train.position.set(TRACKS[index], METRO_FLOOR_Y + 0.26, z);
      train.rotation.y = index ? Math.PI : 0;
    });
  }

  function getTrainPosition(out) {
    return out.set(trains[0].position.x, trains[0].position.y + 1.06,
      THREE.MathUtils.clamp(trains[0].position.z, NORTH_LIMIT + 2, SOUTH_LIMIT - 2));
  }

  update(0, 0, 0);
  return { update, getTrainPosition, features };
}
