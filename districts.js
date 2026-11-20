import * as THREE from './vendor/three.module.js';

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const leafGeometry = new THREE.IcosahedronGeometry(1, 0);
const coneGeometry = new THREE.ConeGeometry(1, 1, 5);
const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 9);
const gableGeometry = new THREE.CylinderGeometry(1, 1, 1, 3, 1, false, 0);
const yAxis = new THREE.Vector3(0, 1, 0);
const matte = (color, options) => new THREE.MeshStandardMaterial({ color, roughness: 0.83, ...options });
const glow = color => new THREE.MeshBasicMaterial({ color });
const color = {
  curb: matte(0xa59e85), road: matte(0x263641), lane: matte(0xdfbe80),
  asphalt: matte(0x3d4b4a), pavement: matte(0x838e78), clay: matte(0x80513e),
  freshClay: matte(0xa16b4d), soil: matte(0x6a4e3b), loam: matte(0x4b3b31),
  mineral: matte(0x674f46), rock: matte(0x494d4d), shale: matte(0x37454a),
  dark: matte(0x263b42), lower: matte(0x2b353c), retaining: matte(0x696e63),
  lightStone: matte(0xacac83), bankStone: matte(0x777864),
  crop: [0x4a7342, 0x718d46, 0x819e42, 0x6a8845, 0x52774c, 0xa5914d].map(value => matte(value)),
  cropTip: [0x7eaa4d, 0x9dae52, 0xcac461, 0x97b476, 0x659b62, 0xc9ac53].map(value => matte(value)),
  grass: matte(0x5d793f), park: matte(0x6a8e53), fieldEdge: matte(0x837545),
  foliage: [0x3d6b4b, 0x5b834d, 0x87a266].map(value => matte(value)),
  trunk: matte(0x4a392b), red: matte(0xa3674f), warm: matte(0xbbab89),
  cream: matte(0xd2bf9b), green: matte(0x648273), slate: matte(0x515d61),
  blue: matte(0x455c6a), glass: matte(0x527f82, { roughness: 0.28, metalness: 0.17 }),
  shade: matte(0x243b40), window: matte(0xe7af67, { emissive: 0xf4bd77, emissiveIntensity: 0.32 }),
  sun: glow(0xffedb5), path: glow(0xfdd395), waterMarker: glow(0x98f6ef),
  rail: matte(0xb6c9bd, { roughness: 0.45, metalness: 0.2 }),
  greenGlass: matte(0x77b9a5, { roughness: 0.3, metalness: 0.14 }),
  channel: matte(0x27696b, { roughness: 0.31, metalness: 0.21 }),
  moss: matte(0x50744d), footpath: matte(0xb5a174),
};

function createBuilder(seed) {
  const parents = new Map();
  const transform = new THREE.Object3D();
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function store(parent, material, geometry, x, y, z, w, h, d, yaw = 0, pitch = 0, roll = 0) {
    let materials = parents.get(parent);
    if (!materials) parents.set(parent, materials = new Map());
    let geometries = materials.get(material);
    if (!geometries) materials.set(material, geometries = new Map());
    let pieces = geometries.get(geometry);
    if (!pieces) geometries.set(geometry, pieces = []);
    pieces.push([x, y, z, w, h, d, yaw, pitch, roll]);
  }

  function box(parent, material, x, y, z, w, h, d, yaw = 0) {
    store(parent, material, boxGeometry, x, y, z, w, h, d, yaw);
  }

  function flush() {
    for (const [parent, materials] of parents) {
      for (const [material, geometries] of materials) {
        for (const [geometry, entries] of geometries) {
          const instances = new THREE.InstancedMesh(geometry, material, entries.length);
          entries.forEach(([x, y, z, w, h, d, yaw, pitch, roll], index) => {
            transform.position.set(x, y, z);
            transform.rotation.set(pitch, yaw, roll);
            transform.scale.set(w, h, d);
            transform.updateMatrix();
            instances.setMatrixAt(index, transform.matrix);
          });
          instances.instanceMatrix.needsUpdate = true;
          instances.computeBoundingBox();
          instances.computeBoundingSphere();
          parent.add(instances);
        }
      }
    }
  }
  return { box, random, store, flush };
}

function geometry(parent, material, positions, indices) {
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setIndex(indices);
  result.computeVertexNormals();
  const mesh = new THREE.Mesh(result, material);
  parent.add(mesh);
  return mesh;
}

function ribbon(parent, material, at, segments = 64) {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    positions.push(...at(i / segments, false), ...at(i / segments, true));
    if (i) {
      const prev = (i - 1) * 2;
      indices.push(prev, prev + 1, prev + 2, prev + 1, prev + 3, prev + 2);
    }
  }
  return geometry(parent, material, positions, indices);
}

function tube(parent, material, from, to, radius) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const direction = b.clone().sub(a);
  const mesh = new THREE.Mesh(cylinderGeometry, material);
  mesh.position.copy(a.lerp(b, 0.5));
  mesh.scale.set(radius, direction.length(), radius);
  mesh.quaternion.setFromUnitVectors(yAxis, direction.normalize());
  parent.add(mesh);
}

function tree(parent, builder, x, y, z, size = 1, pine = false) {
  const { box, store, random } = builder;
  box(parent, color.trunk, x, y + 0.44 * size, z, 0.13 * size, 0.9 * size, 0.13 * size);
  if (pine) {
    for (let i = 0; i < 3; i++) {
      const breadth = size * (0.72 - i * 0.12);
      store(parent, color.foliage[i], coneGeometry, x, y + size * (0.92 + i * 0.37), z,
        breadth, size * (1.16 - i * 0.12), breadth, random() * Math.PI, 0, 0);
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const breadth = size * (0.36 + random() * 0.2);
      store(parent, color.foliage[i % 3], leafGeometry, x + (random() - 0.5) * size * 0.73,
        y + size * (0.95 + random() * 0.45), z + (random() - 0.5) * size * 0.68,
        breadth, breadth * 1.26, breadth, random() * Math.PI, 0, 0);
    }
  }
}

function building(parent, builder, { x, y, z, w, d, floors, body, roof = color.slate, gable = false }) {
  const { box, random, store } = builder;
  const level = gable ? 0.66 : 0.88;
  const h = floors * level + 0.22;
  const front = z + d / 2;
  box(parent, color.curb, x, y + 0.045, z, w + 0.26, 0.12, d + 0.25);
  box(parent, body, x, y + h / 2 + 0.08, z, w, h, d);
  if (gable) {
    store(parent, roof, gableGeometry, x, y + h + 0.402, z, w * 0.61, d + 0.24, 0.63, 0, -Math.PI / 2, 0);
  } else {
    box(parent, roof, x, y + h + 0.145, z, w + 0.14, 0.18, d + 0.14);
    box(parent, color.retaining, x + 0.14 * w, y + h + 0.4, z - 0.06 * d, w * 0.3, 0.34, d * 0.35);
    if (floors > 4) box(parent, color.dark, x + 0.16 * w, y + h + 0.69, z - 0.06 * d, 0.055, 0.54, 0.055);
  }
  const columns = Math.max(2, Math.round(w / 0.92));
  for (let floor = 0; floor < floors; floor++) {
    const winY = y + 0.14 + (floor + 0.5) * level;
    for (let col = 0; col < columns; col++) {
      const winX = x + ((col + 0.5) / columns - 0.5) * w;
      box(parent, color.shade, winX, winY, front + 0.018, w / columns * 0.69, level * 0.68, 0.041);
      box(parent, random() > 0.59 ? color.window : color.glass, winX, winY, front + 0.039, w / columns * 0.55, level * 0.56, 0.025);
    }
    for (let side = 0; side < Math.ceil(d / 0.92); side++) {
      const div = Math.ceil(d / 0.92);
      const winZ = z + ((side + 0.5) / div - 0.5) * d;
      box(parent, random() > 0.69 ? color.window : color.glass, x + w / 2 + 0.025, winY, winZ, 0.05, level * 0.61, d / div * 0.61);
    }
    if (!gable) box(parent, roof, x, winY + level * 0.52, front + 0.019, w + 0.056, 0.055, 0.07);
  }
  box(parent, color.shade, x, y + 0.27, front + 0.062, Math.min(w * 0.35, 0.74), 0.62, 0.04);
}

function pathMarkers(parent, material, line, count, spread = 1) {
  const vertices = line.map(point => new THREE.Vector3(...point));
  const curve = new THREE.CurvePath();
  for (let i = 1; i < vertices.length; i++) curve.add(new THREE.LineCurve3(vertices[i - 1], vertices[i]));
  const pips = new THREE.InstancedMesh(leafGeometry, material, count);
  pips.frustumCulled = false;
  const matrix = new THREE.Matrix4();
  const p = new THREE.Vector3();
  parent.add(pips);
  return (elapsed, speed = 0.32) => {
    for (let i = 0; i < count; i++) {
      const value = ((elapsed * speed + (i * spread) / count) % 1 + 1) % 1;
      curve.getPoint(value, p);
      const radius = 0.07 + Math.sin(value * Math.PI) * 0.12;
      matrix.makeScale(radius * 1.38, radius, radius);
      matrix.setPosition(p);
      pips.setMatrixAt(i, matrix);
    }
    pips.instanceMatrix.needsUpdate = true;
  };
}

function makeSoil(root, builder, top, style) {
  const { box, random } = builder;
  const soil = new THREE.Group();
  const rock = new THREE.Group();
  root.add(soil, rock);
  const tint = style === 'river' ? color.freshClay : color.clay;
  const bands = [
    [0.18, color.loam], [0.68, tint], [0.37, color.mineral],
    [1.08, color.soil], [0.68, color.loam], [0.51, color.mineral],
  ];
  let floor = top;
  for (const [height, material] of bands) {
    box(soil, material, 0, floor - height / 2, 0, 32, height, 16);
    floor -= height;
  }
  const rockTop = floor;
  for (const [height, material] of [[0.8, color.rock], [1.46, color.shale], [0.89, color.rock], [0.34, color.lower]]) {
    box(rock, material, 0, floor - height / 2, 0, 32, height, 16);
    floor -= height;
  }
  box(rock, color.dark, 0, floor - 0.16, 0, 32.14, 0.32, 16.14);

  for (let i = 0; i < 94; i++) {
    const x = random() * 31.7 - 15.85;
    const y = top - 0.22 - random() * 3.13;
    box(soil, i % 4 === 0 ? color.freshClay : color.loam, x, y, 8.007,
      0.11 + random() * 0.64, 0.023 + random() * 0.05, 0.019);
  }
  for (let seam = 0; seam < 7; seam++) {
    ribbon(rock, color.lower, (t, lower) => {
      const y = rockTop - 0.21 - seam * 0.457 + Math.sin(t * 12.5 + seam) * 0.165
        + Math.sin(t * 52 + seam) * 0.04;
      return [t * 32 - 16, y + (lower ? -0.047 : 0), 8.013];
    });
  }

  if (style !== 'hill') {
    const aquifer = matte(style === 'river' ? 0x408c8a : 0x557b70, { metalness: 0.16 });
    ribbon(soil, aquifer, (t, lower) => {
      const u = 0.13 + t * 0.76;
      const y = top - 2.55 + Math.sin(t * 9) * 0.21 + Math.cos(t * 25) * 0.09;
      return [u * 32 - 16, y + (lower ? -Math.sin(t * Math.PI) * 0.11 : 0), 8.015];
    });
  }
  function reveal(group, amount, pivot) {
    group.visible = amount > 0.001;
    group.scale.y = Math.max(amount, 0.001);
    group.position.y = pivot * (1 - amount);
  }
  return {
    soil, rock,
    setDepth(depth) {
      reveal(soil, THREE.MathUtils.clamp(depth / 11, 0, 1), top);
      reveal(rock, THREE.MathUtils.clamp((depth - 11) / 13, 0, 1), rockTop);
    },
  };
}

function makeRiver(surface, cutaway, builder) {
  const { box, random } = builder;
  const center = x => -0.69 + Math.sin(x / 5.9) * 1.25 - x * 0.008;
  const floor = -0.77;
  const contours = [
    [x => -8, 2.18, color.pavement], [x => center(x) - 4.2, 2.18, color.bankStone],
    [x => center(x) - 3.46, 1.47, color.lightStone], [x => center(x) - 3.03, 0.78, color.bankStone],
    [x => center(x) - 2.58, -0.59, color.channel], [x => center(x) + 2.57, -0.59, color.bankStone],
    [x => center(x) + 3.02, 0.53, color.park], [x => center(x) + 4.65, 0.53, color.bankStone],
    [x => center(x) + 5.24, 1.3, color.grass], [x => 8, 1.3, color.bankStone],
  ];
  for (let i = 0; i < contours.length - 1; i++) {
    ribbon(surface, contours[i][2], (t, side) => {
      const x = t * 32 - 16;
      const [z, y] = contours[i + Number(side)];
      return [x, y, z(x)];
    });
  }
  for (const [i, z] of [[0, -8], [contours.length - 1, 8]]) {
    const positions = [-16, floor, z, 16, floor, z, -16, contours[i][1], z, 16, contours[i][1], z];
    geometry(surface, color.soil, positions, z > 0 ? [0, 1, 2, 1, 3, 2] : [1, 0, 2, 1, 2, 3]);
  }
  for (const x of [-16, 16]) {
    const positions = contours.flatMap(([z, y]) => [x, y, z(x), x, floor, z(x)]);
    const indices = [];
    for (let i = 0; i < positions.length / 6 - 1; i++) {
      const n = i * 2;
      if (x > 0) indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      else indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
    geometry(surface, color.freshClay, positions, indices);
  }
  box(surface, color.loam, 0, floor - 0.042, 0, 32, 0.084, 16);
  function riverside(parent, material, offset, width, y) {
    return ribbon(parent, material, (t, side) => {
      const x = t * 32 - 16;
      return [x, y, center(x) + offset + (side ? width / 2 : -width / 2)];
    });
  }
  riverside(surface, color.footpath, 6.08, 1.04, 1.314);
  riverside(surface, color.curb, 5.37, 0.09, 1.326);
  riverside(surface, color.footpath, 3.47, 0.51, 0.55);
  riverside(surface, color.pavement, -4.23, 0.13, 2.191);

  for (const [x, w, floors, body] of [
    [-12.5, 4.45, 4, color.red], [-7.75, 3.85, 6, color.green],
    [-3.3, 3.83, 5, color.cream], [6.1, 3.9, 4, color.warm],
    [11.65, 4.49, 5, color.blue],
  ]) {
    box(surface, color.retaining, x, 1.79, -6.57, w + 0.34, 0.78, 2.43);
    building(surface, builder, { x, y: 2.18, z: -6.57, w, d: 2.16, floors, body });
  }

  for (const x of [-13.5, -10.98, -6.7, -4.55, 0.18, 7.6, 11.5, 14]) {
    const pathZ = center(x) + 5.65;
    tree(surface, builder, x, 1.31, pathZ + 0.68, 0.74 + random() * 0.21);
    if (x < 10) box(surface, color.red, x + 0.72, 0.72, center(x) + 3.99, 0.73, 0.18, 0.22, 0.11);
  }
  for (let i = 0; i < 23; i++) {
    const x = i * 1.33 - 15.3;
    if (Math.abs(x - 2.45) < 1.48) continue;
    const z = center(x) + 5.41;
    box(surface, color.dark, x, 1.63, z, 0.046, 0.64, 0.046);
  }
  riverside(surface, color.rail, 5.41, 0.072, 1.932);

  const bridgeX = 2.45;
  const parkedZ = center(bridgeX);
  const zStart = parkedZ - 4.62;
  const zEnd = parkedZ + 5.7;
  const deckY = t => 2.32 + Math.sin(t * Math.PI) * 0.55 - t * 0.85;
  const deckSteps = 34;
  for (let i = 0; i < deckSteps; i++) {
    const t = (i + 0.5) / deckSteps;
    const z = THREE.MathUtils.lerp(zStart, zEnd, t);
    box(surface, color.curb, bridgeX, deckY(t), z, 1.93, 0.15, (zEnd - zStart) / deckSteps + 0.014);
    if (i % 3 === 0) {
      for (const dir of [-1, 1]) {
        const x = bridgeX + dir * 0.88;
        box(surface, color.dark, x, deckY(t) + 0.32, z, 0.075, 0.63, 0.075);
        box(surface, color.sun, x, deckY(t) + 0.45, z, 0.056, 0.085, 0.098);
      }
    }
  }
  for (const side of [-1, 1]) {
    const x = bridgeX + side * 0.88;
    for (const offset of [0.26, 0.62]) {
      for (let j = 0; j < 8; j++) {
        const a = j / 8;
        const b = (j + 1) / 8;
        tube(surface, color.rail, [x, deckY(a) + offset, THREE.MathUtils.lerp(zStart, zEnd, a)],
          [x, deckY(b) + offset, THREE.MathUtils.lerp(zStart, zEnd, b)], 0.039);
      }
    }
  }
  for (const t of [0.26, 0.66]) {
    const z = THREE.MathUtils.lerp(zStart, zEnd, t);
    box(surface, color.retaining, bridgeX, (deckY(t) - 0.56) / 2, z, 1.18, deckY(t) + 0.56, 0.21);
  }

  // A paved playground sits deliberately below the permanent promenade.
  const parkX = 9.07;
  const parkZ = center(parkX) + 4.14;
  box(surface, color.fieldEdge, parkX, 0.556, parkZ, 5.1, 0.044, 0.62);
  for (const x of [7.13, 8.45, 10.03, 11.37]) {
    box(surface, color.retaining, x, 0.59, center(x) + 4.46, 0.43, 0.13, 0.09);
  }
  for (const x of [-12.9, -10.7, -8.2, -2, 3.7, 7.5, 11.4]) {
    const z = center(x) + 3.035;
    box(surface, color.bankStone, x, 0.54, z, 0.53, 0.08, 0.31, -0.12);
  }
  for (const [x, y, w, h] of [[-10.8, -2.31, 8.2, 0.11], [-6.69, -1.78, 0.13, 1.05], [-2.5, -2.31, 8.26, 0.1]]) {
    box(cutaway.soil, color.channel, x, y, 8.046, w, h, 0.12);
  }

  const normalWater = new THREE.Color(0x287795);
  const highWater = new THREE.Color(0x299cbe);
  const waterMaterial = matte(normalWater, { roughness: 0.28, metalness: 0.19, side: THREE.DoubleSide });
  const water = ribbon(surface, waterMaterial, (t, side) => {
    const x = t * 32 - 16;
    return [x, 0.095, center(x) + (side ? 2.84 : -2.83)];
  });
  water.frustumCulled = false;
  const waterPositions = water.geometry.getAttribute('position');
  const transform = new THREE.Object3D();
  const dashes = new THREE.InstancedMesh(boxGeometry, glow(0x79c9d2), 73);
  dashes.frustumCulled = false;
  surface.add(dashes);
  const waves = Array.from({ length: dashes.count }, () => ({
    start: random(), z: random() * 4.9 - 2.45, length: 0.11 + random() * 1.06, speed: 0.023 + random() * 0.026,
  }));
  let active = false;
  let level = 0;
  function update(dt, elapsed) {
    const nextLevel = THREE.MathUtils.damp(level, Number(active), 2.6, dt);
    if (Math.abs(nextLevel - level) > 0.00001) {
      level = nextLevel;
      for (let i = 0; i < waterPositions.count; i++) {
        const x = waterPositions.getX(i);
        waterPositions.setY(i, 0.095 + level * 0.626);
        waterPositions.setZ(i, center(x) + (i % 2 ? 2.84 + level * 1.96 : -2.83 - level * 0.19));
      }
      waterPositions.needsUpdate = true;
      waterMaterial.color.copy(normalWater).lerp(highWater, level);
    }
    waves.forEach((wave, i) => {
      const phase = (wave.start + elapsed * wave.speed) % 1;
      const x = phase * 32 - 16;
      const fade = Math.min(1, phase * 28, (1 - phase) * 28);
      transform.position.set(x, 0.11 + level * 0.626, center(x) + wave.z);
      transform.scale.set(Math.max(0.001, fade * wave.length), 0.009, 0.022);
      transform.rotation.set(0, -Math.cos(x / 5.9) * 0.13, 0);
      transform.updateMatrix();
      dashes.setMatrixAt(i, transform.matrix);
    });
    dashes.instanceMatrix.needsUpdate = true;
  }
  return {
    setStory(value) { active = value; },
    update,
    hotspots: [
      ['bank', -9.24, 2.56, center(-9.24) - 4.25],
      ['bridge', bridgeX, 3.42, parkedZ + 1.02],
      ['retention', parkX, 0.79, parkZ + 0.35],
    ],
  };
}

function makeHill(surface, cutaway, builder) {
  const { box, random } = builder;
  const bands = [
    { y: 0.42, near: 8, far: 4.68, color: color.pavement },
    { y: 2.65, near: 4.68, far: 1.48, color: color.grass },
    { y: 4.89, near: 1.48, far: -1.68, color: color.pavement },
    { y: 6.88, near: -1.68, far: -4.86, color: color.grass },
    { y: 8.49, near: -4.86, far: -8, color: color.park },
  ];
  const floor = -0.14;
  const stairs = [-7.13, -2.32, -7.5, -3.62];
  bands.forEach(({ y, near, far, color: top }, index) => {
    box(surface, index % 2 ? color.soil : color.rock, 0, (y + floor) / 2, (near + far) / 2, 32, y - floor, near - far);
    box(surface, top, 0, y + 0.024, (near + far) / 2, 32, 0.055, near - far);
    if (index === 0) {
      box(surface, color.road, 0, y + 0.06, 6.43, 31.99, 0.029, 1.76);
      for (let x = -15; x < 16; x += 2.25) box(surface, color.lane, x, y + 0.08, 6.43, 0.86, 0.01, 0.054);
      return;
    }
    const lowerY = bands[index - 1].y;
    const stairX = stairs[index - 1];
    box(surface, color.retaining, 0, (y + lowerY) / 2, near + 0.036, 32, y - lowerY, 0.15);
    box(surface, color.curb, 0, y + 0.09, near - 0.023, 32.03, 0.13, 0.26);
    for (let x = -15.64; x < 16; x += 0.78) {
      const stepY = (y + lowerY) / 2 + Math.sin(x * 1.56) * 0.126;
      box(surface, color.bankStone, x, stepY, near + 0.126, 0.72, 0.06, 0.035);
      if (Math.abs(stairX - x) >= 1.06 && (index < 4 || x > -11)) {
        box(surface, color.dark, x, y + 0.33, near - 0.062, 0.054, 0.53, 0.054);
      }
    }
    for (const [from, to] of [[-15.94, stairX - 0.94], [stairX + 0.94, 15.94]]) {
      box(surface, color.rail, (from + to) / 2, y + 0.58, near - 0.062, to - from, 0.051, 0.047);
    }
    box(surface, color.footpath, 0, y + 0.07, near - 0.61, 31.99, 0.022, 0.79);
    const number = 12;
    for (let i = 0; i < number; i++) {
      const fraction = (i + 1) / number;
      const rise = (y - lowerY) * fraction;
      const z = near + (1 - fraction) * 2.28 + 0.10;
      box(surface, color.lightStone, stairX, lowerY + rise / 2, z, 1.67, rise + 0.09, 0.22);
    }
    for (const side of [-1, 1]) {
      const x = stairX + side * 0.80;
      tube(surface, color.rail, [x, lowerY + 0.51, near + 2.33], [x, y + 0.51, near + 0.03], 0.042);
    }
  });
  for (const [index, x, w, floors, body, roof] of [
    [1, -12.3, 3.75, 2, color.red, color.slate], [1, 2.6, 3.2, 2, color.cream, color.green],
    [1, 6, 2.73, 3, color.green, color.slate], [2, -12.4, 3.4, 3, color.warm, color.blue],
    [2, 4, 3.56, 3, color.warm, color.red], [2, 13.5, 3.56, 2, color.blue, color.slate],
    [3, -11.1, 2.95, 3, color.blue, color.slate], [3, 1.8, 3.45, 3, color.red, color.blue],
    [4, -6.37, 3.33, 2, color.cream, color.red], [4, -0.4, 4.1, 3, color.green, color.slate],
    [4, 6.03, 3.67, 2, color.cream, color.blue],
  ]) {
    const band = bands[index];
    building(surface, builder, { x, y: band.y + 0.05, z: band.far + 0.99, w, d: 1.87, floors, body, roof, gable: index >= 3 });
  }
  for (const x of [-15.0, -13.6, -11.86, -10.2, 12.2, 13.6, 14.97]) {
    tree(surface, builder, x, bands[4].y + 0.02, -7.26 + random() * 1.08, 0.88 + random() * 0.44, true);
  }
  for (const i of [1, 2, 3]) {
    for (const x of [-15.3, -5.0, 0.31, 8.35, 14.65]) {
      const z = bands[i].near - 0.9 - random() * 0.3;
      tree(surface, builder, x, bands[i].y + 0.09, z, 0.51 + random() * 0.22, true);
    }
  }
  for (let i = 0; i < 39; i++) {
    const x = random() * 31.7 - 15.85;
    box(cutaway.soil, color.rock, x, -0.58 - random() * 3.1, 8.016, 0.44 + random() * 0.7, 0.048, 0.026);
  }

  const liftX = 10.75;
  const liftZ = 3.48;
  const bottom = 2.86;
  const upper = 8.65;
  for (const dx of [-0.67, 0.67]) for (const dz of [-0.65, 0.65]) {
    box(surface, color.dark, liftX + dx, (bottom + upper + 0.69) / 2, liftZ + dz, 0.13, upper + 0.69 - bottom, 0.13);
  }
  for (const y of [bottom, 4.84, 6.91, upper + 0.55]) {
    box(surface, color.rail, liftX, y, liftZ + 0.67, 1.38, 0.13, 0.11);
    box(surface, color.rail, liftX + 0.67, y, liftZ, 0.11, 0.13, 1.38);
  }
  box(surface, color.rail, liftX, upper + 0.66, liftZ, 1.56, 0.16, 1.48);
  box(surface, color.curb, liftX, upper - 0.06, -0.95, 1.54, 0.20, 7.68);
  for (const dx of [-0.74, 0.74]) {
    box(surface, color.rail, liftX + dx, upper + 0.42, -1.03, 0.061, 0.071, 7.51);
    for (let z = -4.78; z < 2.7; z += 0.86) box(surface, color.dark, liftX + dx, upper + 0.24, z, 0.057, 0.49, 0.058);
  }
  const cabin = new THREE.Group();
  const cabinGlass = matte(0x81c5c9, { opacity: 0.76, transparent: true, roughness: 0.2, metalness: 0.14 });
  box(cabin, cabinGlass, 0, 0, 0, 1.09, 0.77, 1.02);
  box(cabin, color.dark, 0, -0.38, 0, 1.14, 0.184, 1.08);
  box(cabin, color.sun, 0, 0.30, 0.521, 0.92, 0.075, 0.06);
  box(cabin, color.dark, 0, 0.04, 0.522, 0.055, 0.64, 0.051);
  surface.add(cabin);

  const route = new THREE.Group();
  surface.add(route);
  const line = [[-13.3, 0.6, 7.28]];
  stairs.forEach((x, i) => {
    const { y, near } = bands[i + 1];
    line.push([x, bands[i].y + 0.19, near + 2.41],
      [x, y + 0.21, near + 0.08], [x, y + 0.17, near - 0.69]);
  });
  line.push([7.9, 8.66, -5.44], [liftX, 8.79, -4.85], [liftX, 8.80, liftZ],
    [liftX, 3.02, liftZ], [liftX, 2.82, 4.34]);
  for (let i = 1; i < line.length; i++) tube(route, color.path, line[i - 1], line[i], 0.035);
  const animateMarkers = pathMarkers(route, color.sun, line, 14, 0.95);
  let active = false;
  let routeTime = 0;
  return {
    setStory(value) {
      if (active !== value) routeTime = 0;
      active = value;
      route.visible = value;
    },
    update(dt) {
      if (active) routeTime += dt;
      const travel = Math.sin(routeTime * 0.56 - Math.PI / 2) * 0.5 + 0.5;
      cabin.position.set(liftX, THREE.MathUtils.lerp(bottom + 0.43, upper - 0.38, travel), liftZ);
      if (active) animateMarkers(routeTime, 0.15);
    },
    hotspots: [
      ['steps', stairs[0], 2.27, 5.36],
      ['terrace', -9.22, 7.26, -2.96],
      ['lift', liftX + 0.66, 6.08, liftZ + 0.6],
    ],
  };
}

function makeRural(surface, cutaway, builder) {
  const { box, store, random } = builder;
  const center = x => 0.68 + Math.sin(x * 0.17) * 0.45;
  box(surface, color.soil, 0, -0.01, 0, 32, 0.28, 16);
  for (const [low, high, side] of [[-8, -1.0, -1], [1.0, 8, 1]]) {
    ribbon(surface, color.grass, (t, right) => {
      const x = t * 32 - 16;
      const z = right ? high : low;
      return [x, 0.25, z === 8 || z === -8 ? z : center(x) + side];
    });
  }
  function canalRibbon(material, halfWidth, elevation) {
    return ribbon(surface, material, (t, side) => {
      const x = t * 32 - 16;
      return [x, elevation, center(x) + (side ? halfWidth : -halfWidth)];
    });
  }
  canalRibbon(color.fieldEdge, 0.97, 0.158);
  const canal = matte(0x307d7a, { metalness: 0.3, roughness: 0.29 });
  canalRibbon(canal, 0.72, 0.188);
  const story = new THREE.Group();
  surface.add(story);
  const mainPath = Array.from({ length: 22 }, (_, index) => {
    const x = -15.79 + index * 1.50;
    return [x, 0.235, center(x)];
  });
  const mainPips = pathMarkers(story, color.waterMarker, mainPath, 20);
  const branchPips = [];
  for (const x of [-4.67, 2.7, 9.88]) {
    for (const side of [-1, 1]) {
      const start = center(x) + 0.52 * side;
      const end = 7.81 * side;
      const w = 0.38;
      box(surface, color.fieldEdge, x, 0.267, (start + end) / 2, w + 0.27, 0.029, Math.abs(start - end));
      box(surface, color.channel, x, 0.282, (start + end) / 2, w, 0.026, Math.abs(start - end));
      const path = [[x, 0.235, center(x)], [x, 0.31, start], [x, 0.328, end]];
      branchPips.push(pathMarkers(story, color.waterMarker, path, 7));
      box(story, color.waterMarker, x, 0.301, (start + end) / 2, 0.073, 0.011, Math.abs(start - end));
    }
    box(surface, color.bankStone, x, 0.28, center(x) + 0.69, 0.63, 0.087, 0.24);
  }

  const parcels = [
    [-15.81, -10.47, 2.1, 7.7, 5], [-10.07, -5.32, 2.19, 7.69, 1],
    [-4.08, 2.11, 2.24, 7.71, 4], [3.32, 9.29, 2.29, 7.67, 2], [10.46, 15.76, 2.37, 7.66, 0],
    [-4.03, 2.08, -7.69, -0.81, 2], [3.28, 9.27, -7.74, -0.88, 3], [10.47, 15.79, -7.73, -0.88, 1],
  ];
  for (const [left, right, back, front, palette] of parcels) {
    const cx = (left + right) / 2;
    const cz = (back + front) / 2;
    const isOrchard = palette === 4;
    box(surface, color.fieldEdge, cx, 0.279, cz, right - left, 0.057, front - back);
    box(surface, color.crop[palette], cx, 0.338, cz, right - left - 0.19, 0.083, front - back - 0.2);
    if (isOrchard) {
      for (let x = left + 0.63; x < right - 0.36; x += 1.23) {
        for (let z = back + 0.69; z < front - 0.38; z += 1.23) {
          tree(surface, builder, x, 0.385, z, 0.36 + random() * 0.09);
        }
      }
      continue;
    }
    const horizontal = palette % 2 === 0;
    const across = horizontal ? back : left;
    const reach = horizontal ? front : right;
    const length = horizontal ? right - left : front - back;
    for (let row = across + 0.28; row < reach - 0.23; row += 0.39) {
      box(surface, color.cropTip[palette], horizontal ? cx : row, 0.414, horizontal ? row : cz,
        horizontal ? length - 0.28 : 0.135, 0.068, horizontal ? 0.135 : length - 0.28);
      for (let k = -length / 2 + 0.25; k < length / 2 - 0.21; k += 0.52) {
        const height = 0.076 + random() * 0.13;
        store(surface, color.cropTip[palette], coneGeometry, horizontal ? cx + k : row, 0.455,
          horizontal ? row : cz + k, 0.075, height, 0.089, random() * Math.PI, 0, 0);
      }
    }
  }

  box(surface, color.footpath, -10.47, 0.285, -3.62, 10.61, 0.055, 1.15);
  box(surface, color.asphalt, -6.43, 0.272, 0.03, 1.08, 0.062, 4.32);
  box(surface, color.rail, -6.43, 0.343, center(-6.43), 1.31, 0.155, 2.03);
  box(surface, color.curb, -6.43, 0.445, center(-6.43), 1.28, 0.061, 2.1);
  for (const dx of [-0.6, 0.6]) box(surface, color.dark, -6.43 + dx, 0.588, center(-6.43), 0.069, 0.28, 1.92);
  for (const [x, z, w, d, floors, body, roof] of [
    [-13.38, -6.18, 2.94, 2.22, 2, color.cream, color.red], [-9.64, -5.81, 3.03, 2.44, 2, color.warm, color.slate],
    [-6.47, -6.42, 2.0, 1.91, 1, color.cream, color.red], [-14.02, -2.48, 2.08, 1.55, 1, color.warm, color.red],
    [-10.76, -2.37, 2.38, 1.47, 1, color.cream, color.red], [-7.45, -2.11, 2.33, 1.66, 1, color.green, color.slate],
  ]) building(surface, builder, { x, y: 0.31, z, w, d, floors, body, roof, gable: true });
  for (const [x, z] of [[-15.42, -7.02], [-11.37, -6.7], [-8.2, -5.62], [-14.99, -4.68], [-11.53, -2.38], [13.67, -7.59], [15.33, -7.48]]) {
    tree(surface, builder, x, 0.31, z, 0.73 + random() * 0.26);
  }
  // Small greenhouse and tied roof ribs.
  const greenhouse = matte(0x82bfa8, { opacity: 0.82, transparent: true, metalness: 0.1 });
  box(surface, color.lightStone, 11.88, 0.44, -4.34, 1.82, 0.15, 3.35);
  store(surface, greenhouse, gableGeometry, 11.88, 0.81, -4.34, 1.04, 3.2, 0.58, 0, -Math.PI / 2, 0);
  for (let z = -5.87; z < -2.76; z += 0.47) {
    tube(surface, color.rail, [10.98, 0.52, z], [11.88, 1.38, z], 0.027);
    tube(surface, color.rail, [11.88, 1.38, z], [12.78, 0.52, z], 0.027);
  }
  for (const x of [-4.67, 2.7, 9.88]) {
    box(cutaway.soil, color.moss, x, -0.54, 8.022, 0.31, 0.74, 0.14);
    box(cutaway.soil, color.channel, x, -0.94, 8.026, 0.33, 0.16, 0.14);
  }
  let active = false;
  let flowTime = 0;
  const still = new THREE.Color(0x307d7a);
  const flowing = new THREE.Color(0x359a8c);
  return {
    setStory(value) {
      if (active !== value) flowTime = 0;
      active = value;
      story.visible = value;
      canal.color.copy(value ? flowing : still);
    },
    update(dt) {
      if (!active) return;
      flowTime += dt;
      mainPips(flowTime, 0.19);
      branchPips.forEach((animate, i) => animate(flowTime * 0.77 + i * 0.13, 0.37));
    },
    hotspots: [
      ['canal', 0.43, 0.51, center(0.43)],
      ['fields', 7.24, 0.60, 4.88],
      ['village', -10.83, 2.57, -4.11],
    ],
  };
}

const districtTypes = {
  river: { terrain: makeRiver, pivot: -0.85, seed: 8320, maxY: 8.7 },
  hill: { terrain: makeHill, pivot: -0.14, seed: 7424, maxY: 11.9 },
  rural: { terrain: makeRural, pivot: -0.15, seed: 5219, maxY: 3.2 },
};

export function createDistrict(scene, id) {
  const definition = districtTypes[id];
  if (!definition) throw new Error('Unknown cutaway district: ' + id);
  const group = new THREE.Group();
  const surface = new THREE.Group();
  const builder = createBuilder(definition.seed);
  scene.add(group);
  group.add(surface);
  const cutaway = makeSoil(group, builder, definition.pivot, id);
  const terrain = definition.terrain(surface, cutaway, builder);
  builder.flush();
  cutaway.setDepth(14);
  terrain.setStory(false);
  terrain.update(0, 0);
  return {
    group,
    setDepth: cutaway.setDepth,
    setStory: terrain.setStory,
    update: terrain.update,
    hotspots: terrain.hotspots.map(([id, x, y, z]) => ({
      id,
      position: new THREE.Vector3(x, y, z),
      minimumDepth: id === 'retention' ? 11 : 0,
    })),
    bounds: new THREE.Box3(new THREE.Vector3(-16.16, definition.pivot - 7.34, -8.22), new THREE.Vector3(16.16, definition.maxY, 8.13)),
  };
}
