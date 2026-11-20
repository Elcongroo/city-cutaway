import * as THREE from './vendor/three.module.js';

const WIDTH = 58;
const LENGTH = 34;
const WATER_LEVEL = -0.31;
const { clamp, lerp, smoothstep } = THREE.MathUtils;

function riverCenter(z) {
  return 1.5 + 1.4 * Math.sin(z * 0.24 + 0.55) + 2.9 * Math.sin(z * 0.12 - 0.38) + z * 0.07;
}

function riverWidth(z) {
  return 2.17 + 0.37 * Math.cos(z * 0.3 - 0.18);
}

function hillHeight(x, z) {
  const peak = (cx, cz, rx, rz) => Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));
  const relief = 8.3 * peak(18, -10.4, 8.8, 6.7)
    + 4.2 * peak(26, -11.8, 4.6, 5.5)
    + 2.4 * peak(24.6, -5, 5.7, 5.8)
    + 1.1 * peak(8.6, -13, 4.6, 4.6);
  return relief * smoothstep(x, 3.8, 9.8) * (1 - smoothstep(z, -2, 4.2));
}

function elevation(x, z) {
  const riverDistance = Math.abs(x - riverCenter(z));
  const bank = smoothstep(riverDistance, riverWidth(z) - 0.42, riverWidth(z) + 0.75);
  const hill = hillHeight(x, z);
  const stepped = lerp(hill, Math.floor((hill + 0.13) / 0.68) * 0.68, smoothstep(hill, 0.55, 2.3) * 0.68);
  return lerp(-0.91, 0.32 + stepped, bank);
}

function makeTerrain() {
  // The shared ground mesh keeps the river, hill toe and foreground in the same cross-section.
  const columns = 116;
  const rows = 68;
  const points = [];
  const colors = [];
  const faces = [];
  const meadow = new THREE.Color(0x788752);
  const farmland = new THREE.Color(0x899b5e);
  const grassySlope = new THREE.Color(0x62875b);
  const highestSlope = new THREE.Color(0x5f7460);
  const riverbank = new THREE.Color(0xae9e72);
  const riverbed = new THREE.Color(0x234c48);
  const color = new THREE.Color();
  for (let row = 0; row <= rows; row++) {
    const z = row * LENGTH / rows - LENGTH / 2;
    for (let column = 0; column <= columns; column++) {
      const x = column * WIDTH / columns - WIDTH / 2;
      const y = elevation(x, z);
      const offset = Math.abs(x - riverCenter(z)) - riverWidth(z);
      const hills = hillHeight(x, z);
      color.copy(meadow).lerp(farmland, smoothstep(z, 1.3, 7.3));
      color.lerp(grassySlope, smoothstep(hills, 0.28, 4.2));
      color.lerp(highestSlope, smoothstep(hills, 5.3, 9.7));
      color.lerp(riverbank, 1 - smoothstep(offset, 0.11, 1.44));
      color.lerp(riverbed, 1 - smoothstep(y, -0.6, -0.17));
      color.multiplyScalar(0.98 + Math.sin(x * 1.26) * Math.cos(z * 1.13) * 0.055);
      points.push(x, y, z);
      colors.push(color.r, color.g, color.b);
      if (column === columns || row === rows) continue;
      const a = row * (columns + 1) + column;
      const next = a + columns + 1;
      faces.push(a, next + 1, a + 1, a, next, next + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.98,
    flatShading: true,
  }));
}

function standard(color, options) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...options });
}

function makeRibbon(points, material, width, useCrossSections = false) {
  const positions = [];
  const indices = [];
  for (let i = 0; i < points.length; i++) {
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const point = points[i];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const halfWidth = (typeof width === 'function' ? width(point) : width) / 2;
    const factor = halfWidth / Math.hypot(dx, dz);
    const lateral = useCrossSections ? halfWidth : dz * factor;
    const longitudinal = useCrossSections ? 0 : dx * factor;
    positions.push(point.x - lateral, point.y, point.z + longitudinal);
    positions.push(point.x + lateral, point.y, point.z - longitudinal);
    if (i < points.length - 1) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function boxBatch(group) {
  const boxes = [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const size = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  const geometry = new THREE.BoxGeometry();
  return {
    box(material, x, y, z, width, height, length, yaw = 0, shape = geometry) {
      position.set(x, y, z);
      size.set(width, height, length);
      rotation.setFromAxisAngle(axis, yaw);
      matrix.compose(position, rotation, size);
      boxes.push({ material, shape, transform: matrix.clone() });
    },
    flush() {
      const batches = new Map();
      for (const entry of boxes) {
        const key = entry.material.id + ':' + entry.shape.id;
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key).push(entry);
      }
      for (const batch of batches.values()) {
        const { material, shape } = batch[0];
        const instances = new THREE.InstancedMesh(shape, material, batch.length);
        batch.forEach((entry, index) => instances.setMatrixAt(index, entry.transform));
        instances.computeBoundingSphere();
        group.add(instances);
      }
    },
  };
}

function terrainPath(group, coordinates, material, width, height = 0.049) {
  const curve = new THREE.CatmullRomCurve3(coordinates.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const points = curve.getPoints(Math.max(24, coordinates.length * 12));
  points.forEach(point => { point.y = elevation(point.x, point.z) + height; });
  group.add(makeRibbon(points, material, width));
}

export function createAtlas(scene) {
  const model = new THREE.Group();
  model.name = 'Regional atlas';
  scene.add(model);
  const { box, flush } = boxBatch(model);
  const colors = {
    earth1: standard(0x4c443c),
    earth2: standard(0x585248),
    earth3: standard(0x75624b),
    edge: standard(0x343d47),
    soil: standard(0x807459),
    concrete: standard(0x8d9890),
    path: standard(0xc8af7e),
    road: standard(0x26323b),
    roadEdge: standard(0xa0a99f),
    marking: standard(0xe3d0a2),
    curb: standard(0xb4bab0),
    landing: standard(0x8d8270),
    farmRoad: standard(0xa4936b),
    gate: standard(0xd8b692),
    brick: standard(0xb5684e),
    roofs: [standard(0x9a5240), standard(0x2d5b60), standard(0x7f453e)],
    walls: [standard(0xc9a681), standard(0xd6c6a4), standard(0x978b69)],
    plot: [standard(0xaa9d53), standard(0x6d8442), standard(0x7c6947), standard(0x9b9249), standard(0x748d4a)],
    crop: [standard(0xd0b75c), standard(0x94a752), standard(0xb88959), standard(0xb2a762), standard(0x9ebf60)],
    forest: [standard(0x456647), standard(0x638650), standard(0x7a8b53), standard(0x395d53), standard(0x889655)],
    deck: standard(0xad9a78),
    glass: [standard(0x345d68), standard(0x6b8f91), standard(0x6b777e), standard(0x667c8a)],
    steel: [standard(0x52757d), standard(0xb49b7b), standard(0x93a4a2), standard(0xc1b292)],
    glassDark: standard(0x45616b),
    glow: standard(0xf1d49d, { emissive: 0xe3ac50, emissiveIntensity: 0.27 }),
    warm: standard(0xffe5a9, { emissive: 0xe3ac50, emissiveIntensity: 0.37 }),
    canal: standard(0x4d8f95, { metalness: 0.15, roughness: 0.42 }),
  };
  const water = standard(0x286b8a, { roughness: 0.26, metalness: 0.24, emissive: 0x0a2e36, emissiveIntensity: 0.3 });
  const sphere = new THREE.IcosahedronGeometry(1, 0);
  const cone = new THREE.ConeGeometry(1, 1, 5);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  const trunk = standard(0x614d36);
  const gable = new THREE.Shape();
  gable.moveTo(-0.5, 0);
  gable.lineTo(0.5, 0);
  gable.lineTo(0, 1);
  gable.closePath();
  const roofShape = new THREE.ExtrudeGeometry(gable, { depth: 1, bevelEnabled: false });
  roofShape.translate(0, 0, -0.5);
  let seed = 135789;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  }

  box(colors.edge, 0, -2.94, 0, WIDTH + 0.12, 0.19, LENGTH + 0.12);
  box(colors.earth1, 0, -2.48, 0, WIDTH, 0.75, LENGTH);
  box(colors.earth2, 0, -1.95, 0, WIDTH, 0.3, LENGTH);
  box(colors.earth3, 0, -1.4, 0, WIDTH, 0.8, LENGTH);
  model.add(makeTerrain());

  function coverTerrainSide(fixed, from, to, asPoint) {
    const points = [];
    const indices = [];
    for (let i = 0; i <= 116; i++) {
      const [x, z] = asPoint(fixed, lerp(from, to, i / 116));
      points.push(x, -0.999, z, x, elevation(x, z), z);
      const a = i * 2;
      if (i < 116) indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = colors.soil.clone();
    material.side = THREE.DoubleSide;
    model.add(new THREE.Mesh(geometry, material));
  }
  coverTerrainSide(17, -29, 29, (fixed, value) => [value, fixed]);
  coverTerrainSide(-17, 29, -29, (fixed, value) => [value, fixed]);
  coverTerrainSide(29, 17, -17, (fixed, value) => [fixed, value]);
  coverTerrainSide(-29, -17, 17, (fixed, value) => [fixed, value]);

  const river = Array.from({ length: 101 }, (_, i) => {
    const z = lerp(-17, 17, i / 100);
    return new THREE.Vector3(riverCenter(z), WATER_LEVEL, z);
  });
  model.add(makeRibbon(river, water, point => 2 * riverWidth(point.z) + 0.73, true));
  const wakeMaterial = new THREE.MeshBasicMaterial({ color: 0x9ee5e2, transparent: true, opacity: 0.33, depthWrite: false });
  const wakeGeometry = new THREE.PlaneGeometry().rotateX(-Math.PI / 2);
  const wakeSamples = Array.from({ length: 31 }, () => ({
    width: 0.025 + random() * 0.035,
    length: 0.48 + random() * 0.79,
    phase: random() * 31.5,
    offset: (random() - 0.5) * 3.1,
    speed: 0.25 + random() * 0.48,
  }));
  const wakes = new THREE.InstancedMesh(wakeGeometry, wakeMaterial, wakeSamples.length);
  wakes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wakes.frustumCulled = false;
  const wakeMatrix = new THREE.Matrix4();
  model.add(wakes);

  function tree(x, z, scale, conifer = false) {
    const base = elevation(x, z);
    const tone = colors.forest[Math.floor(random() * colors.forest.length)];
    box(trunk, x, base + scale * 0.24, z, scale * 0.076, scale * 0.48, scale * 0.076);
    if (conifer) {
      box(tone, x, base + scale * 0.66, z, 0.28 * scale, 0.8 * scale, 0.28 * scale, random(), cone);
      box(tone, x, base + scale * 0.87, z, 0.21 * scale, 0.64 * scale, 0.21 * scale, random(), cone);
    } else {
      box(tone, x, base + scale * 0.82, z, 0.35 * scale, 0.48 * scale, 0.35 * scale, random(), sphere);
    }
  }

  function house(x, z, width, length, height, style = 0) {
    const floor = elevation(x, z);
    const lowest = Math.min(floor, elevation(x - width / 2, z), elevation(x + width / 2, z), elevation(x, z - length / 2), elevation(x, z + length / 2));
    const platform = floor + 0.18;
    box(colors.landing, x, (lowest + platform) / 2, z, width + 0.21, platform - lowest, length + 0.23);
    box(colors.walls[style], x, platform + height * 0.5, z, width, height, length);
    box(colors.roofs[style], x, platform + height - 0.025, z, width + 0.21, height * 0.48, length + 0.21, 0, roofShape);
    box(colors.glassDark, x - width * 0.23, platform + height * 0.61, z + length / 2 + 0.008, width * 0.19, height * 0.22, 0.023);
    box(colors.glow, x + width * 0.18, platform + height * 0.58, z + length / 2 + 0.008, width * 0.25, height * 0.26, 0.023);
    box(colors.brick, x, platform + height * 0.23, z + length / 2 + 0.01, width * 0.13, height * 0.46, 0.025);
  }

  function tower(x, z, width, length, height, style) {
    const y = elevation(x, z);
    const frame = colors.steel[style];
    const glass = colors.glass[style];
    box(colors.curb, x, y + 0.053, z, width + 0.28, 0.105, length + 0.29);
    box(frame, x, y + height * 0.5, z, width, height, length);
    box(glass, x, y + (height + 0.46) / 2, z, width + 0.018, height - 0.46, length + 0.018);
    box(frame, x, y + height, z, width + 0.14, 0.27, length + 0.14);
    box(colors.glassDark, x + width * 0.125, y + height + 0.31, z - length * 0.12, width * 0.48, 0.49, length * 0.54);
    if (height > 5.7) {
      box(colors.steel[2], x + width * 0.25, y + height + 0.82, z - length * 0.19, 0.048, 0.72, 0.058);
      box(colors.warm, x + width * 0.25, y + height + 1.2, z - length * 0.19, 0.11, 0.11, 0.11);
    }
    const floors = Math.max(2, Math.round(height / 0.61));
    for (let floor = 1; floor < floors; floor++) {
      const row = y + height * floor / floors;
      box(frame, x, row + 0.19, z, width + 0.06, 0.048, length + 0.07);
      for (let j = 0; j < 3; j++) {
        const dx = (j - 1) * width * 0.29;
        const dz = (j - 1) * length * 0.292;
        const front = random() > 0.43 ? colors.glow : colors.glassDark;
        const side = random() > 0.5 ? colors.glow : colors.glassDark;
        box(front, x + dx, row, z + length / 2 + 0.018, width * 0.215, 0.225, 0.025);
        box(side, x + width / 2 + 0.018, row, z + dz, 0.025, 0.225, length * 0.206);
      }
    }
    for (let column = -1; column <= 1; column += 2) {
      box(frame, x + column * width * 0.29, y + height * 0.52, z + length / 2 + 0.025, 0.034, height * 0.93, 0.028);
      box(frame, x + width / 2 + 0.025, y + height * 0.52, z + column * length * 0.29, 0.027, height * 0.93, 0.037);
    }
  }

  // The dense district is a regular grid connected to a continuous cross-region road.
  box(colors.concrete, -17.23, 0.359, -7.96, 22.25, 0.105, 16.95);
  for (let j = 0; j < 4; j++) {
    const z = -15.46 + j * 4.37;
    box(colors.road, -17.2, 0.432, z, 22.15, 0.075, 1.06);
    for (let x = -27.9; x < -6.35; x += 1.28) box(colors.marking, x, 0.474, z, 0.47, 0.013, 0.035);
  }
  for (let j = 0; j < 5; j++) {
    const x = -26.52 + j * 4.26;
    box(colors.road, x, 0.433, -7.45, 1.01, 0.077, 17.92);
    for (let z = -15.3; z < 0.8; z += 1.25) box(colors.marking, x, 0.475, z, 0.037, 0.012, 0.45);
  }
  const heights = [
    [3.4, 6.54, 7.8, 5.14, 3.18],
    [4.44, 7.21, 9.45, 6.66, 3.95],
    [2.15, 3.48, 4.84, 3.05, 1.71],
  ];
  for (let row = 0; row < heights.length; row++) {
    for (let column = 0; column < heights[row].length; column++) {
      const x = -27.55 + column * 4.28;
      const z = -13.3 + row * 4.37;
      const width = column === 0 ? 1.16 : 2.28 + random() * 0.47;
      tower(x + (column ? -1.17 : 0), z, width, 1.93 + random() * 0.85, heights[row][column], (column + row) % 4);
      tree(x + (column ? -0.2 : 0.8), z + 1.52, 0.78 + random() * 0.21);
    }
  }

  // Both bridge decks are built and connected to street or footpaths on the bank.
  function bridge(x1, x2, z, width, height) {
    box(colors.deck, (x1 + x2) / 2, height - 0.109, z, x2 - x1, 0.24, width + 0.19);
    box(colors.road, (x1 + x2) / 2, height + 0.034, z, x2 - x1, 0.055, width);
    for (const side of [-1, 1]) {
      box(colors.gate, (x1 + x2) / 2, height + 0.267, z + side * (width * 0.5 + 0.03), x2 - x1, 0.055, 0.06);
      for (let x = x1 + 0.28; x < x2 - 0.1; x += 0.62) {
        box(colors.curb, x, height + 0.16, z + side * (width * 0.5 + 0.03), 0.074, 0.28, 0.087);
      }
    }
    for (const x of [x1 + 0.46, (x1 + x2) * 0.5, x2 - 0.46]) {
      box(colors.landing, x, height * 0.5 - 0.38, z, 0.34, height + 0.62, width * 0.9);
    }
    for (let x = x1 + 0.15; x < x2 - 0.15; x += 0.98) box(colors.marking, x, height + 0.065, z, 0.37, 0.013, 0.043);
  }

  const mainZ = 0.69;
  const roadA = riverCenter(mainZ) - riverWidth(mainZ) - 0.57;
  const roadB = riverCenter(mainZ) + riverWidth(mainZ) + 0.56;
  bridge(roadA, roadB, mainZ, 1.66, 0.424);
  terrainPath(model, [[-28.75, 0.95], [-16.5, 0.84], [-10.8, 0.69], [roadA, mainZ]], colors.road, 1.67, 0.132);
  terrainPath(model, [[roadB, mainZ], [9.1, 0.95], [12.4, 2.45], [18.7, 2.64], [22.5, 1.62], [28.6, 2.01]], colors.road, 1.43);
  for (let x = -28; x < roadA - 0.24; x += 1.26) box(colors.marking, x, 0.473, 0.82, 0.43, 0.015, 0.038);

  const northZ = -11.1;
  const northA = riverCenter(northZ) - riverWidth(northZ) - 0.65;
  const northB = riverCenter(northZ) + riverWidth(northZ) + 0.67;
  bridge(northA, northB, northZ, 1.28, 0.422);
  terrainPath(model, [[-10.35, -11.1], [-7.4, -11.1], [northA, northZ]], colors.road, 1.28, 0.12);
  terrainPath(model, [[northB, northZ], [0.51, -11.0], [4.9, -10.5], [8.3, -12.1], [12.2, -14.2], [19.7, -14.9], [25.5, -14.1]], colors.path, 0.72, 0.135);

  // Low riverfront buildings leave the inner shore open for park terraces.
  for (const [x, z, h, style] of [[-22, 5.3, 2.01, 1], [-17.3, 5.2, 3.6, 0], [-12.4, 5.1, 2.35, 3], [-22.15, 10.2, 2.42, 1], [-17.5, 10.4, 2.8, 2], [-23, 13.8, 1.4, 1]]) {
    tower(x, z, 2.62, 2.22, h, style);
  }
  terrainPath(model, [[-27.8, 9.1], [-21.3, 8.12], [-16.4, 8.05], [-12.8, 7.31], [-8.9, 4.1], [-6.5, 1.9]], colors.path, 0.61, 0.077);
  terrainPath(model, Array.from({ length: 13 }, (_, i) => {
    const z = 2 + i * 1.14;
    return [riverCenter(z) - riverWidth(z) - 1.42, z];
  }), colors.deck, 0.62, 0.17);
  for (const [x, z] of [[-9.1, 6.3], [-7.2, 9.8], [-5.2, 6.7], [-5.05, 13.7], [-0.24, 12.37], [-4.8, 15.8], [-13.5, 11.3], [-8.3, 13.1], [-11.4, 14.55], [-6.2, 5.3], [-14.8, 9.2]]) {
    tree(x, z, 0.77 + random() * 0.67);
  }
  box(colors.landing, -8.2, 0.38, 10.55, 3.48, 0.12, 2.27, -0.16, cylinder);
  box(colors.canal, -8.2, 0.457, 10.55, 3.03, 0.029, 1.87, -0.16, cylinder);
  for (let i = 0; i < 4; i++) {
    box(colors.deck, -8.5 - i * 0.16, 0.57 - i * 0.024, 12.27 - i * 0.28, 2.78, 0.09, 0.21, -0.12);
  }
  for (let i = 0; i < 6; i++) {
    const z = 5.2 + i * 1.72;
    const x = riverCenter(z) - riverWidth(z) - 0.85;
    box(colors.deck, x, elevation(x, z) + 0.12, z, 0.62, 0.155, 0.38, -0.21);
  }

  // A pedestrian route switches back up the hill, passing houses on successive levels.
  terrainPath(model, [[10.7, 1.4], [13.35, -0.1], [18.25, -1.1], [20.1, -3.55], [15.35, -3.77], [14.6, -6.4], [20.4, -8.12], [25.2, -9.15]], colors.path, 0.58, 0.20);
  const hillHomes = [
    [11.62, -2.25, 1.67, 1.34, 1.03, 0],
    [14.35, -3.22, 1.62, 1.32, 1.1, 1],
    [17.78, -2.71, 1.71, 1.45, 1.08, 0],
    [22.34, -4.2, 1.83, 1.44, 1.14, 1],
    [19.4, -5.38, 1.64, 1.29, 1.25, 2],
    [16.51, -5.18, 1.77, 1.3, 1.24, 0],
    [14.45, -7.05, 1.64, 1.38, 1.09, 1],
    [21.6, -7.36, 1.74, 1.4, 1.08, 0],
    [25.22, -7.56, 1.93, 1.67, 1.16, 0],
    [23.35, -11.67, 1.74, 1.5, 0.93, 1],
  ];
  hillHomes.forEach(args => house(...args));
  const hillTrees = [[9.6, -3.25], [11.2, -6.3], [10, -9], [11.1, -12.95], [14.1, -11.3], [15.4, -10.7], [16.6, -12.8], [19.2, -12.1], [20.9, -13.1], [22.9, -14.05], [25.8, -13.45], [27.45, -12.35], [28, -9.5], [27.4, -7], [26.6, -5.15], [22.55, -2.85], [20.15, -0.69]];
  hillTrees.forEach(([x, z]) => tree(x, z, 0.74 + random() * 0.85, true));
  for (let i = 0; i < 5; i++) {
    const x = 15.86 + i * 0.54;
    const z = -2.3 - i * 0.18;
    box(colors.deck, x, elevation(x, z) + 0.16, z, 0.57, 0.14, 0.83, 0.16);
  }
  const liftX = 24.8;
  const liftZ = -3.08;
  const liftFoot = elevation(liftX, liftZ);
  const liftTop = liftFoot + 2.1;
  box(colors.steel[0], liftX, (liftFoot + liftTop) / 2, liftZ, 0.38, 2.1, 0.44);
  box(colors.warm, liftX, liftTop - 0.43, liftZ + 0.24, 0.31, 0.49, 0.029);
  box(colors.deck, liftX - 0.6, liftTop - 0.22, liftZ - 0.49, 1.86, 0.13, 0.82);

  // Irrigation lines and crop rows distinguish the front farming block from the streets.
  const fields = [
    [9.26, 5.7, 3.19, 3.14, 0], [13.24, 5.7, 3.48, 3.14, 1], [17.65, 5.7, 4.1, 3.14, 3], [22.74, 5.7, 4.78, 3.14, 2],
    [9.41, 10.18, 3.27, 3.55, 1], [13.24, 10.18, 3.48, 3.55, 4], [17.72, 10.18, 4.1, 3.55, 0], [23.12, 10.18, 5.13, 3.55, 4],
    [9.37, 14.6, 3.19, 3.35, 3], [13.24, 14.6, 3.48, 3.35, 2], [17.71, 14.6, 4.1, 3.35, 1],
  ];
  for (const [x, z, width, length, type] of fields) {
    const y = elevation(x, z) + 0.042;
    box(colors.plot[type], x, y, z, width, 0.092, length);
    const rows = Math.round(width * 3.2);
    for (let i = 0; i < rows; i++) {
      const offset = (i - (rows - 1) / 2) * (width / rows);
      box(colors.crop[type], x + offset, y + 0.075 + random() * 0.052, z, 0.09 + random() * 0.044, 0.055 + random() * 0.065, length * 0.92);
    }
  }
  terrainPath(model, [[6.5, 4.28], [8.3, 4.1], [11.35, 4.1], [11.65, 7.81], [11.67, 12.51], [11.65, 16.45]], colors.canal, 0.25, 0.16);
  terrainPath(model, [[11.59, 7.63], [16.8, 7.67], [20.5, 7.63], [25.33, 7.82], [27.8, 8.08]], colors.canal, 0.22, 0.16);
  terrainPath(model, [[7.55, 12.49], [11.45, 12.42], [17.82, 12.41], [22.86, 12.46], [26.84, 12.72], [28.17, 14.2]], colors.farmRoad, 0.53, 0.066);
  box(colors.deck, 11.63, 0.58, 12.43, 0.58, 0.1, 0.48);
  for (const [x, z, w, d, h, color] of [[22.2, 14.53, 2.32, 1.83, 1.16, 0], [25.03, 14.05, 1.54, 1.4, 0.95, 2], [27.16, 15.4, 1.77, 1.63, 0.98, 0], [24.42, 16.12, 1.77, 1.05, 0.72, 1], [27.37, 10.77, 1.7, 1.52, 0.95, 0], [27.61, 6.32, 1.55, 1.52, 0.95, 1]]) {
    house(x, z, w, d, h, color);
  }
  for (const [x, z] of [[26.2, 13.53], [27.95, 11.97], [20.4, 15.45], [23.4, 15.8], [25.63, 15.98], [9.18, 3.42], [14.66, 2.99], [18.92, 3.31], [28.1, 5.12]]) {
    tree(x, z, 0.76 + random() * 0.49);
  }
  flush();

  const travelers = [];
  const carGeometry = new THREE.BoxGeometry(0.72, 0.26, 0.38);
  const canopyGeometry = new THREE.BoxGeometry(0.35, 0.15, 0.32);
  for (const color of [0xe09a62, 0xbfd5c7, 0x58a6ae, 0xd1b664]) {
    const body = new THREE.Group();
    body.add(new THREE.Mesh(carGeometry, standard(color)));
    const canopy = new THREE.Mesh(canopyGeometry, colors.glassDark);
    canopy.position.y = 0.17;
    body.add(canopy);
    model.add(body);
    travelers.push(body);
  }

  const hotspots = [
    { id: 'plain', position: new THREE.Vector3(-17.9, 9.85, -10.2) },
    { id: 'river', position: new THREE.Vector3(-8.1, 2.5, 10.9) },
    { id: 'hill', position: new THREE.Vector3(19.3, 11.4, -8.6) },
    { id: 'rural', position: new THREE.Vector3(18.4, 2.06, 11.45) },
  ];

  function update(dt, elapsed) {
    wakeSamples.forEach(({ phase, offset, speed, width, length }, index) => {
      const z = ((elapsed * speed + phase) % 32) - 16;
      wakeMatrix.makeScale(width, 1, length);
      wakeMatrix.setPosition(riverCenter(z) + offset, WATER_LEVEL + 0.015, z);
      wakes.setMatrixAt(index, wakeMatrix);
    });
    wakes.instanceMatrix.needsUpdate = true;
    wakeMaterial.opacity = 0.29 + Math.sin(elapsed * 1.23) * 0.065;
    for (let i = 0; i < travelers.length; i++) {
      const heading = i % 2 ? -1 : 1;
      const t = (elapsed * (1.8 + i * 0.11) + i * 7.6) % 33.2;
      const x = -11.7 + heading * (t - 16.6);
      const z = mainZ + heading * 0.36;
      const body = travelers[i];
      body.rotation.y = heading === 1 ? 0 : Math.PI;
      body.position.set(x, Math.max(0.47, elevation(x, z) + 0.075) + 0.13, z);
    }
  }
  update(0, 0);
  return { hotspots, update };
}
