import * as THREE from './vendor/three.module.js';
import { coastX, groundY, riverRadius, riverZ, waterAt } from './coast-terrain.js';

const boxGeometry = new THREE.BoxGeometry();
const segmentGeometry = new THREE.CylinderGeometry(1, 1, 1, 7);
const crownGeometry = new THREE.IcosahedronGeometry(1, 0);
const up = new THREE.Vector3(0, 1, 0);
const depth = new THREE.Vector3(0, 0, 1);
const standard = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, ...extra });
const ribbonBatches = new WeakMap();

function makeBatches(group) {
  const geometries = new Map();
  const position = new THREE.Vector3();
  const dimensions = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const target = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const transform = new THREE.Matrix4();

  function add(geometry, material) {
    const key = geometry.id + ':' + material.id;
    if (!geometries.has(key)) geometries.set(key, { geometry, material, matrices: [] });
    geometries.get(key).matrices.push(transform.clone());
  }

  function object(material, x, y, z, w, h, l, yaw = 0, geometry = boxGeometry) {
    position.set(x, y, z);
    dimensions.set(w, h, l);
    rotation.setFromAxisAngle(up, yaw);
    transform.compose(position, rotation, dimensions);
    add(geometry, material);
  }

  function segment(material, a, b, radius) {
    position.set(...a);
    target.set(...b);
    direction.subVectors(target, position);
    const length = direction.length();
    if (!length) return;
    dimensions.set(radius, length, radius);
    rotation.setFromUnitVectors(up, direction.divideScalar(length));
    position.lerp(target, 0.5);
    transform.compose(position, rotation, dimensions);
    add(segmentGeometry, material);
  }

  function flush() {
    for (const { geometry, material, matrices } of geometries.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  }

  return { object, segment, flush };
}

function makePath(coordinates, elevation) {
  const vertices = [];
  for (let index = 0; index < coordinates.length - 1; index++) {
    const [a, b] = coordinates.slice(index, index + 2);
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.65));
    for (let index = 0; index < steps; index++) {
      const fraction = index / steps;
      const x = THREE.MathUtils.lerp(a[0], b[0], fraction);
      const z = THREE.MathUtils.lerp(a[1], b[1], fraction);
      vertices.push(new THREE.Vector3(x, elevation(x, z), z));
    }
  }
  const [x, z] = coordinates[coordinates.length - 1];
  vertices.push(new THREE.Vector3(x, elevation(x, z), z));
  return vertices;
}

function addRibbon(group, points, width, material, offset = 0, profile) {
  if (!ribbonBatches.has(group)) ribbonBatches.set(group, new Map());
  const materials = ribbonBatches.get(group);
  if (!materials.has(material)) materials.set(material, { positions: [], indices: [] });
  const { positions, indices } = materials.get(material);
  const base = positions.length / 3;
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - previous.x, dz = next.z - previous.z;
    const side = width / (2 * (Math.hypot(dx, dz) || 1));
    for (const direction of [-1, 1]) {
      const x = point.x + direction * dz * side;
      const z = point.z - direction * dx * side;
      const y = profile ? profile(x, z) : point.y;
      positions.push(x, y + offset, z);
    }
    if (index) {
      const a = base + index * 2 - 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
}

function flushRibbons(group) {
  for (const [material, { positions, indices }] of ribbonBatches.get(group)) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    group.add(new THREE.Mesh(geometry, material));
  }
  ribbonBatches.delete(group);
}

export function createCoastCity(scene) {
  const city = new THREE.Group();
  city.name = 'Connected coastal city';
  scene.add(city);
  const { object: box, segment, flush } = makeBatches(city);
  let seed = 26363;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const pick = array => array[Math.floor(random() * array.length)];
  const gray = standard(0x9d9c90);
  const concrete = standard(0xb2b5ac);
  const dockConcrete = standard(0x7c8c8c);
  const walkway = standard(0xa69b83, { side: THREE.DoubleSide });
  const pavement = standard(0x4b565a, { side: THREE.DoubleSide });
  const asphalt = standard(0x303c47, { side: THREE.DoubleSide });
  const stripe = standard(0xcdbd92);
  const bridgeSteel = standard(0xd9ded4, { metalness: 0.30 });
  const cables = standard(0xcddbd5, { metalness: 0.45 });
  const black = standard(0x24323b);
  const moss = [0x547448, 0x476b4f, 0x65885a, 0x809658, 0x365b46].map(color => standard(color));
  const trunk = standard(0x5b5140);
  const urbanMaterials = [0x51727d, 0x647984, 0xa49b83, 0xc3bb9f, 0x799aa4, 0x577986].map(color => standard(color));
  const glass = standard(0x5d8e9d, { metalness: 0.26, roughness: 0.34, emissive: 0x183c52, emissiveIntensity: 0.18 });
  const warmGlass = standard(0xe3bd76, { emissive: 0xffa047, emissiveIntensity: 0.22 });
  const paleGlass = standard(0xa2c5ca, { emissive: 0x9ddcff, emissiveIntensity: 0.11 });
  const lightWindow = [warmGlass, paleGlass];
  const windowMats = [glass, glass, glass, warmGlass, paleGlass];
  const lamps = standard(0xffdaa0, { emissive: 0xffb23f, emissiveIntensity: 0.35 });
  const aquaLamp = standard(0x7bdccf, { emissive: 0x55ddcd, emissiveIntensity: 0.30 });
  const redLamp = standard(0xf27950, { emissive: 0xff4a29, emissiveIntensity: 0.5 });
  const roofs = [0x94573e, 0x876347, 0xa77351, 0x546568].map(color => standard(color));
  const plaster = [0xe0d7bb, 0xd8c6a5, 0xb8bbab, 0xf1dfba].map(color => standard(color));
  const trafficRoutes = [];
  const safeFromCut = (x, z) => x < -23.8 || x > 29.8 || z < -26.8 || z > 61.8;
  const ground = (x, z) => Math.max(0.14, groundY(x, z));

  function road(coordinates, width, options = {}) {
    const elevation = options.elevation ?? ((x, z) => ground(x, z) + 0.25);
    const points = makePath(coordinates, elevation);
    const flat = options.fixed ? undefined : elevation;
    addRibbon(city, points, width + (options.walkway ?? 1.35), pavement, -0.035, flat);
    addRibbon(city, points, width, asphalt, 0, flat);
    if (options.markings !== false) {
      for (let i = 1; i < points.length; i += 3) {
        const a = points[i - 1], b = points[i];
        const yaw = Math.atan2(b.x - a.x, b.z - a.z);
        box(stripe, a.x, a.y + 0.075, a.z, 0.10, 0.022, Math.min(1.35, a.distanceTo(b)), yaw);
      }
    }
    if (options.traffic) trafficRoutes.push({ curve: new THREE.CatmullRomCurve3(points, false, 'centripetal'), width, count: options.traffic });
    return points;
  }

  function tree(x, z, size = 1, y = ground(x, z)) {
    if (waterAt(x, z)) return;
    const mat = pick(moss);
    box(trunk, x, y + size * 0.60, z, 0.13 * size, 1.2 * size, 0.16 * size);
    box(mat, x, y + size * 1.47, z, 0.86 * size, 1.13 * size, 0.84 * size, random() * 2, crownGeometry);
    box(mat, x + size * 0.38, y + size * 1.09, z + size * 0.12, 0.55 * size, 0.62 * size, 0.58 * size, random(), crownGeometry);
  }

  function lamp(x, z, y = ground(x, z), tall = 2.4) {
    box(black, x, y + tall * 0.5, z, 0.12, tall, 0.12);
    box(black, x + .22, y + tall, z, 0.54, 0.10, 0.15);
    box(lamps, x + .38, y + tall - .055, z, 0.24, 0.075, 0.13);
  }

  function roof(x, y, z, w, l, mat, direction = 0) {
    box(mat, x, y, z, w * 0.56, 0.15, l * .59, direction);
    const height = Math.min(w, l) * .27;
    const slope = Math.atan2(height, w * .54);
    const wSlope = Math.hypot(height, w * .54);
    const rotation = new THREE.Quaternion();
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const size = new THREE.Vector3(wSlope, .17, l * 1.13);
    const pieces = city.userData.roofs ?? new Map();
    city.userData.roofs = pieces;
    if (!pieces.has(mat)) pieces.set(mat, []);
    for (const side of [-1, 1]) {
      position.set(x + Math.cos(direction) * side * w * .27, y + height * .5, z - Math.sin(direction) * side * w * .27);
      rotation.setFromAxisAngle(up, direction).multiply(new THREE.Quaternion().setFromAxisAngle(depth, -side * slope));
      pieces.get(mat).push(matrix.compose(position, rotation, size).clone());
    }
  }

  function dwelling(x, z, w, l, h, flattened = false) {
    if (waterAt(x, z)) return;
    const y = ground(x, z) + (flattened ? .7 : .12);
    const body = pick(plaster);
    box(concrete, x, y - .55, z, w * 1.12, 1.25, l * 1.12);
    box(body, x, y + h * .5, z, w, h, l);
    roof(x, y + h, z, w, l, pick(roofs));
    box(warmGlass, x - w * .24, y + h * .60, z + l * .502, w * .23, h * .27, .04);
    box(paleGlass, x + w * .30, y + h * .60, z + l * .502, w * .20, h * .27, .04);
    box(black, x + w * .03, y + h * .29, z + l * .505, w * .19, h * .60, .065);
    box(gray, x - w * .25, y + h + .76, z + l * .25, .28, .86, .38);
  }

  function facadeTier(x, z, bottom, width, length, height, wall, pitch = 1.10, yaw = 0) {
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    box(wall, x, bottom + height / 2, z, width, height, length, yaw);
    const floors = Math.max(1, Math.floor(height / pitch));
    const onCell = (px, py, pz, w, h, l, material) => box(material, x + px * cos + pz * sin, py, z + pz * cos - px * sin, w, h, l, yaw);
    const rows = [Math.max(2, Math.round(width / 1.55)), Math.max(2, Math.round(length / 1.55))];
    const windowSeed = Math.floor(random() * windowMats.length);
    for (let floor = 0; floor < floors; floor++) {
      const y = bottom + (floor + .52) * height / floors;
      for (let side = -1; side <= 1; side += 2) {
        for (let pane = 0; pane < rows[0]; pane++) {
          const p = ((pane + .5) / rows[0] - .5) * (width - .75);
          const mat = windowMats[(windowSeed + pane * 3 + floor + side * side * floor * pane) % windowMats.length];
          onCell(p, y, side * (length / 2 + .022), width / rows[0] * .64, height / floors * .60, .062, mat);
        }
        for (let pane = 0; pane < rows[1]; pane++) {
          const p = ((pane + .5) / rows[1] - .5) * (length - .75);
          const mat = windowMats[(windowSeed + pane * 2 + floor * 3) % windowMats.length];
          onCell(side * (width / 2 + .022), y, p, .062, height / floors * .61, length / rows[1] * .64, mat);
        }
      }
    }
  }

  function tower(x, z, width, length, height, signature = '') {
    if (waterAt(x, z)) return;
    const y = ground(x, z) + .25;
    const wall = signature ? urbanMaterials[0] : pick(urbanMaterials);
    box(concrete, x, y - .22, z, width + 2.3, .50, length + 2.2);
    facadeTier(x, z, y, width + .8, length + .8, 2.25, pick(urbanMaterials), 1.4);
    box(gray, x, y + 2.3, z, width + .95, .23, length + .90);
    const start = y + 2.40;
    const upper = height - 2.40;
    if (signature === 'crown') {
      facadeTier(x, z, start, width, length, upper * .67, wall);
      facadeTier(x, z, start + upper * .67, width * .76, length * .76, upper * .25, urbanMaterials[4]);
      facadeTier(x, z, start + upper * .92, width * .49, length * .49, upper * .08, wall);
      box(bridgeSteel, x, y + height + 1.35, z, .18, 3.45, .18);
      box(redLamp, x, y + height + 3.08, z, .24, .24, .24);
      for (const side of [-1, 1]) {
        box(aquaLamp, x + side * width * .34, start + upper * .335, z + length * .507, .17, upper * .66, .20);
      }
    } else if (signature === 'spiral') {
      for (let step = 0; step < 8; step++) {
        const fraction = step / 8;
        const yaw = fraction * .65;
        facadeTier(x, z, start + upper * fraction, width * (1 - fraction * .22), length * (1 - fraction * .22), upper / 8, wall, 1.14, yaw);
        box(gray, x, start + upper * fraction + .10, z, width * (1 - fraction * .219) + .20, .16, length * (1 - fraction * .22) + .17, yaw);
      }
      box(bridgeSteel, x, y + height + .55, z, .18, 1.6, .18);
      box(redLamp, x, y + height + 1.35, z, .20, .20, .20);
    } else {
      const step = height > 13 ? upper * .78 : upper;
      facadeTier(x, z, start, width, length, step, wall, height > 13 ? 1.25 : 1.07);
      if (upper > step + .01) facadeTier(x + width * .045, z, start + step, width * .81, length * .83, upper - step, wall, 1.12);
      box(gray, x, y + height + .15, z, height > 13 ? width * .81 : width + .22, .30, height > 13 ? length * .83 : length + .22);
      box(black, x - width * .17, y + height + .48, z - length * .14, width * .28, .62, length * .31);
    }
  }

  const sampleAcross = (start, end, inside) => {
    const coordinates = [];
    for (let x = start; x < end; x += 4) coordinates.push([x, inside(x)]);
    coordinates.push([end, inside(end)]);
    return coordinates;
  };
  function shoreNorth(x) {
    return riverZ(x) - Math.max(13, riverRadius(x) + 4.9);
  }
  function shoreSouth(x) {
    return Math.max(17, riverZ(x) + Math.max(14, riverRadius(x) + 5.4));
  }

  // Roads are drawn on the same heightfield as the buildings and hilly villages.
  road(sampleAcross(-63, 59, shoreNorth), 4.1, { traffic: 9 });
  road(sampleAcross(-63, 65, shoreSouth), 4.4, { traffic: 10 });
  road([[-109, 63], [-75, 58], [-55, 58], [-19, 58], [-4, 58], [18, 58], [43, 58], [65, 58], [coastX(58) - 2.3, 58]], 5.0, { traffic: 12 });
  road([[-56, -55], [-36, -55], [-16, -56], [1, -55], [10, -58], [37, -59], [53, -56], [64, -45]], 4.8, { traffic: 7 });
  road([[-13, -18], [-13, shoreNorth(-13)]], 2.5, { markings: false });
  road([[-13, 50], [-13, 58]], 2.4, { markings: false });
  road([[16, -25], [16, shoreNorth(16)]], 3.5, { markings: false });
  road([[16, 59], [16, 67], [31, 67], [43, 58]], 3.9, { markings: false });
  road([[-8, 30], [-8, shoreSouth(-8)]], 2.45, { markings: false });
  road([[-1, 49], [-1, 58]], 2.45, { markings: false });
  road([[-61, -54], [-61, shoreNorth(-61)], [-61, -5], [-62, 8], [-63, 24], [-62, 58]], 2.55, {
    elevation: (x, z) => Math.max(ground(x, z) + .25, 1.32),
  });
  road([[-26, -55], [-26, -37], [-26, -32]], 3.1, { markings: false });
  road([[-45, -38], [-36, -38], [-27, -38], [-27, -29]], 2.9, { markings: false });
  road([[53, -55], [55, -38], [55, -15], [50, shoreNorth(50)]], 4.1, { traffic: 4 });
  road([[50, shoreSouth(50)], [50, 49], [50, 58], [51, 69]], 4.4, { traffic: 5 });

  function bridge(x, big) {
    const north = shoreNorth(x), south = shoreSouth(x);
    const lift = big ? 4.6 : 2.35;
    const w = big ? 5.2 : 3.5;
    const elevation = (px, z) => {
      const t = (z - north) / (south - north);
      return ground(px, z) * (1 - Math.sin(Math.PI * t)) + 0.24 + lift * Math.sin(Math.PI * t);
    };
    const path = road([[x, north], [x, south]], w, { elevation, fixed: true, traffic: big ? 5 : 3 });
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      for (const side of [-1, 1]) {
        const edge = x + side * (w / 2 + .40);
        segment(bridgeSteel, [edge, a.y + .43, a.z], [edge, b.y + .43, b.z], big ? .095 : .073);
        if (i % 2 === 0) box(bridgeSteel, edge, a.y + .25, a.z, .085, .50, .085);
      }
    }
    for (const fraction of big ? [.32, .68] : [.22, .5, .78]) {
      const z = THREE.MathUtils.lerp(north, south, fraction);
      const y = elevation(x, z);
      const floor = groundY(x, z) - .25;
      const towerY = y + (big ? 13.4 : .3);
      for (const side of [-1, 1]) {
        const footX = x + side * (big ? 2.25 : .95);
        const headX = x + side * (big ? 1.5 : .95);
        segment(bridgeSteel, [footX, floor, z], [headX, towerY, z], big ? .46 : .35);
        if (big) {
          for (let cable = 1; cable <= 5; cable++) {
            for (const direction of [-1, 1]) {
              const anchorZ = THREE.MathUtils.clamp(z + direction * cable * 2.6, north + 2, south - 2);
              segment(cables, [headX, towerY - 1.9 + cable * .32, z], [x + side * 2.75, elevation(x, anchorZ) + .25, anchorZ], .055);
            }
          }
          box(redLamp, headX, towerY + .18, z, .17, .16, .17);
        }
      }
      if (big) box(bridgeSteel, x, towerY - 3.8, z, 3.66, .37, .60);
    }
  }
  bridge(-49, false);
  bridge(50, true);

  // Reserve the central cutaway and the mixed-use building site. Put the tallest masses outside it.
  const towers = [
    [-56,-49,8.1,8.7,17], [-43,-50,7.3,7.5,21], [-33,-48,7.1,8.4,15],
    [-53,-32,7.7,8.2,15], [-47,-22,5.7,6.9,10], [-56,-21,7.5,6.5,9.4],
    [-20,-46,9.6,9.9,31,'crown'], [-6,-44,9.4,9.6,36,'spiral'], [7,-35,7.3,8.0,16],
    [-17,-32,7.1,7.8,15], [-23,-61.8,8.6,6.2,16], [-9,-64,8.7,8.2,21],
    [3.6,-66,8.4,8.2,17], [16,-65,7.0,7.4,11], [31,-64,8.4,7.8,16], [46,-64,8.4,7.4,11],
    [47,-33,8.2,8.5,26,'crown'], [63,-32,8.8,8.3,21], [47,-19,6.1,7.4,16],
    [64,-18,8.4,7.1,13], [60,-7,7.5,6.8,14], [46,-7,5.9,5.8,8.2],
    [-55,25,7.4,7.4,12], [-44,25,6.3,6.4,8], [-35,23,5.6,5.5,6.2],
    [-57,40,8.6,7.8,13], [-45,41,8.1,8.4,15], [-33,40,7.0,6.9,9.2],
    [-52,51,8.3,6.3,10], [-41,50,7.6,6.2,9.4], [-31,50,6.3,6.5,8],
    [37,43,7.3,6.8,17], [43.5,48,6.8,7.2,22,'spiral'], [57,45,8.4,6.4,16],
    [66,47,6.8,6.0,12], [35,66,7.0,6.6,10], [44,66,7.3,7.3,13], [57,67,7.6,7.2,11],
  ];
  for (const spec of towers) tower(...spec);

  // Foothill road stays visible as it climbs; the village terraces sit directly on the same slope.
  const upperRoad = [[-55,-35],[-65,-28],[-74,-25],[-88,-29],[-93,-39],[-90,-46],[-80,-51]];
  road(upperRoad, 3.4, { traffic: 4, markings: false });
  road([[-61,-33],[-55,-35]], 2.7, { markings: false });
  const stairs = [[-75,-28],[-75,-34],[-77,-40],[-79,-45]];
  const stairPath = makePath(stairs, (x,z) => ground(x,z) + .40);
  addRibbon(city, stairPath, 1.45, walkway, 0.06);
  for (let i = 1; i < stairPath.length; i++) {
    const a = stairPath[i - 1], b = stairPath[i];
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    box(concrete, a.x, a.y + .035, a.z, 1.75, .12, .45, yaw);
    if (i % 3 === 0) lamp(a.x + .9, a.z, a.y, 1.60);
  }
  for (const [x,z,w,l,h] of [
    [-63,-35,4.2,4,3.3],[-69,-35,4.2,3.7,4.2],[-71,-41,4.4,3.5,3.6],
    [-80,-39,4.3,3.6,3.8],[-85,-43,4.5,4.1,3.4],[-85,-35,4.1,3.9,3.2],
    [-96,-34,4.5,3.5,3.2],[-98,-42,4.2,3.8,4.3],[-85,-52,4.1,3.4,4.4],
    [-76,-53,4.1,3.4,2.9],[-72,-48,4.2,3.8,3.8],[-89,-47,4.1,3.5,3.2],
  ]) dwelling(x,z,w,l,h,true);

  // The axial canal and its side ditches remain legible right across the patchwork fields.
  const soil = standard(0x686242, { side: THREE.DoubleSide });
  const cropColors = [0x8aab57,0xbfb562,0x618453,0xa48c54,0x607748,0xc0a083,0x5b8256].map(c => standard(c, { side: THREE.DoubleSide }));
  const fieldBank = standard(0xa69965, { side: THREE.DoubleSide });
  const canal = standard(0x429eaa, { metalness: .24, roughness: .24, side: THREE.DoubleSide });
  const ruralProfile = (x,z) => ground(x,z) + .18;
  for (const [zMin,zMax] of [[24,31],[32,36.4],[38.3,44.7],[47.1,52.4],[53.2,57]]) {
    for (const [xMin,xMax] of [[-107,-96],[-94.4,-84.5],[-83.4,-75.1],[-72.9,-64.6]]) {
      const center = (xMin + xMax) * .5;
      const length = zMax - zMin;
      addRibbon(city, makePath([[center,zMin],[center,zMax]],ruralProfile), xMax-xMin, soil, .006, ruralProfile);
      const material = pick(cropColors);
      for (let row = xMin + .45; row < xMax - .2; row += 1.08) {
        addRibbon(city, makePath([[row,zMin+.22],[row,zMax-.22]],ruralProfile), .78, material, .065, ruralProfile);
      }
      if (length > 6) {
        const z = (zMin + zMax) * .5;
        addRibbon(city, makePath([[xMin,z],[xMax,z]],ruralProfile), .35, fieldBank, .09, ruralProfile);
      }
    }
  }
  const ditches = [[[-74,27],[-74,59]], [[-95,37],[-74,37]], [[-95,46],[-74,46]]];
  for (let i = 0; i < ditches.length; i++) {
    const ditch = ditches[i];
    const points = makePath(ditch, ruralProfile);
    addRibbon(city, points, i ? 1.25 : 1.65, fieldBank, .075, ruralProfile);
    addRibbon(city, points, i ? .76 : 1.16, canal, .12, ruralProfile);
  }
  road([[-113,64],[-101,57],[-96,53],[-95,42],[-95,30],[-94,24],[-88,19],[-63,17]], 1.7, { markings: false, walkway: .2 });
  for (const [x,z] of [[-110,57],[-105,61],[-104,65],[-98,58],[-95,63],[-90,62],[-84,64],[-78,65],[-72,64],[-101,23],[-108,26]]) {
    dwelling(x,z,3.0+random(),2.9+random(),2.1+random()*.9);
    tree(x-2.1,z+.9,.83);
  }
  for (let i = 0; i < 115; i++) {
    const x = -119 + random() * 62;
    const z = -69 + random() * 48;
    if (x > -58 || z > -22 || (x > -95 && x < -61 && z > -51 && z < -24)) continue;
    tree(x,z, .68 + random() * 1.46);
  }
  for (let x = -59; x <= 65; x += 4.7) {
    const zNorth = shoreNorth(x) + 2.65;
    const zSouth = shoreSouth(x) - 3.0;
    if (x > 36 && x < 43) continue;
    if (safeFromCut(x,zNorth)) {
      tree(x,zNorth, .75 + random() * .55);
      lamp(x + .85, zNorth - .55);
    }
    if (safeFromCut(x,zSouth)) tree(x,zSouth,.70+random()*.61);
  }

  // An accessible greenway follows the lake basin, with a boardwalk at its outlet.
  const lakeProfile = (x,z) => ground(x,z) + .22;
  const lakeWalk = [];
  for (let i = 0; i <= 56; i++) {
    const a = i * Math.PI * 2 / 56;
    lakeWalk.push([25 + Math.cos(a) * 18.25, -43 + Math.sin(a) * 13.10]);
  }
  addRibbon(city, makePath(lakeWalk, lakeProfile), 1.36, walkway, .07, lakeProfile);
  for (const path of [[[25,-56],[25,-59]],[[35,-32],[34,-29]],[[43,-29],[50,-29],[55,-30]],[[25,-30],[25,-22],[25,shoreNorth(25)]]]) {
    addRibbon(city, makePath(path, lakeProfile), 1.30, walkway, .09, lakeProfile);
  }
  for (let i = 0; i < 33; i++) {
    const a = i * Math.PI * 2 / 33;
    const x = 25 + Math.cos(a) * 20.35, z = -43 + Math.sin(a) * 14.85;
    if (x > 45 || z > -28) continue;
    tree(x,z, .73 + random() * .55);
    if (i % 4 === 0) lamp(x,z);
  }
  const bridgePath = makePath([[34,-29],[43,-29]], () => 2.06);
  addRibbon(city, bridgePath, 1.45, walkway, .08);
  for (const off of [-.70,.70]) segment(bridgeSteel,[34,2.59,-29+off],[43,2.59,-29+off],.10);
  for (let x = 34.3; x < 43; x += 1.24) {
    for (const off of [-.70,.70]) box(bridgeSteel,x,2.34,-29+off,.10,.51,.12);
  }

  const containers = [0xa74f3d,0xcba159,0x497e8f,0x607564,0xc9734d,0x8e9a9b].map(color => standard(color));
  const quayEdge = standard(0x536867);
  const craneSteel = standard(0xcd633f, { metalness: .32, roughness: .53 });
  const craneCross = standard(0xf4a356, { metalness: .31 });
  const seaward = coastX(57);
  const dockY = 1.35;
  const berthZs = [46,55.7,65.4];
  road(berthZs.map(z => [coastX(z)-2.9,z]), 3.15, { markings: false });
  for (let i = 0; i < berthZs.length; i++) {
    const z = berthZs[i];
    const shore = coastX(z) - 1.2;
    const length = [17,23,16][i];
    const x = shore + length * .5;
    box(dockConcrete,x,dockY-.28,z,length,.63,7.5);
    box(quayEdge,x,dockY-.12,z+3.8,length,.19,.21);
    box(quayEdge,x,dockY-.12,z-3.8,length,.19,.21);
    for (let j = 0; j < 5; j++) {
      const foot = shore + 1 + j * (length - 1.8) / 4;
      for (const side of [-1,1]) box(quayEdge,foot,.12,z+side*3.1,.44,2.20,.46);
    }
    for (let j = 0; j < 5; j++) {
      const containerX = shore + 2.8 + j * 2.45;
      for (let side = -1; side <= 1; side += 2) {
        const color = pick(containers);
        box(color,containerX,dockY+.55,z+side*1.87,2.19,.85,1.13);
        if (random() < .54) box(pick(containers),containerX,dockY+1.37,z+side*1.87,2.19,.80,1.13);
        if (j === 2) lamp(containerX,z+side*3.38,dockY,3.4);
      }
    }
  }
  function crane(x,z) {
    for (const side of [-1,1]) {
      const zb = z+side*1.23;
      segment(craneSteel,[x-1.55,dockY,zb],[x-1.10,8.7,zb],.23);
      segment(craneSteel,[x+1.29,dockY,zb],[x+1.05,8.7,zb],.23);
      segment(craneCross,[x-1.46,dockY+.68,zb],[x+1.02,7.85,zb],.10);
      segment(craneCross,[x+1.20,dockY+.68,zb],[x-1.10,7.85,zb],.10);
      segment(craneSteel,[x-2.9,8.55,zb],[x+7.4,8.55,zb],.19);
      segment(craneCross,[x-1.0,11.1,zb],[x+7.3,8.72,zb],.14);
      segment(craneCross,[x-1.0,11.1,zb],[x-2.8,8.65,zb],.13);
      box(redLamp,x-1.00,11.25,zb,.18,.18,.18);
    }
    box(craneSteel,x-.9,11,z,.31,.36,2.76);
    box(craneSteel,x+6.9,8.62,z,.61,.34,2.60);
    box(black,x+4.4,8.3,z,.59,.49,1.2);
    segment(black,[x+4.5,8.16,z],[x+4.5,4.4,z],.052);
    box(containers[1],x+4.5,3.89,z,2.18,.89,1.13);
  }
  crane(coastX(46)+12.4,46);
  crane(coastX(55.7)+14.9,55.7);
  crane(coastX(65.4)+11.0,65.4);
  for (let i = 0; i < 4; i++) {
    const z = 44 + i * 6.5;
    const x = coastX(z)-6.0;
    if (waterAt(x,z)) continue;
    box(dockConcrete,x,ground(x,z)+.04,z,8.2,.21,5.5);
    for (let j = 0; j < 6; j++) {
      box(pick(containers),x-2.75+(j%3)*2.5,ground(x,z)+.56,z-1.2+Math.floor(j/3)*2.5,2.16,.87,1.1);
    }
    lamp(x-4,z,ground(x,z),4.0);
  }

  const vesselHull = standard(0x344956);
  const vesselRamp = standard(0x913f37);
  const deckMaterial = standard(0x857d68);
  function ship(position, scale, yaw = 0, freight = true) {
    const group = new THREE.Group();
    group.name = freight ? 'Container ship' : 'Harbor ferry';
    group.position.copy(position);
    group.scale.setScalar(scale);
    group.rotation.y = yaw;
    city.add(group);
    const fill = makeBatches(group);
    const add = fill.object;
    const outline = new THREE.Shape();
    outline.moveTo(-2.1,-9.2);
    outline.lineTo(2.1,-9.2);
    outline.lineTo(2.6, 6.6);
    outline.lineTo(0, 10.5);
    outline.lineTo(-2.6, 6.6);
    outline.closePath();
    const hull = new THREE.ExtrudeGeometry(outline,{ depth: 1.04, bevelEnabled: false });
    hull.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(hull,vesselHull);
    mesh.position.y = -.38;
    group.add(mesh);
    add(vesselRamp,0,.08,1,5.28,.43,12.3);
    add(deckMaterial,0,.64,0,4.75,.20,15.2);
    add(plaster[0],0,1.20,5.15,4.1,1.40,4.3);
    add(bridgeSteel,0,2.04,5.90,4.35,.26,2.8);
    add(aquaLamp,0,1.69,4.46,3.60,.42,.14);
    add(black,1.28,2.55,6.9,.62,1.4,.61);
    add(redLamp,-1.65,2.61,6.4,.15,.15,.15);
    if (freight) {
      for (let j = 0; j < 6; j++) {
        const z = -6.9 + j * 1.61;
        for (const side of [-1,1]) {
          const x = .93*side;
          add(pick(containers),x,1.12,z,1.57,.71,1.37);
          if (random() < .80) add(pick(containers),x,1.82,z,1.57,.71,1.37);
        }
      }
    } else {
      add(plaster[0],0,1.15,-2,3.8,1.05,6.7);
      add(glass,0,1.40,-2,3.9,.38,6.8);
    }
    fill.flush();
    return group;
  }
  ship(new THREE.Vector3(coastX(57)+25.1,-.01,56.7),1.06,Math.PI/2);
  ship(new THREE.Vector3(Math.min(113,seaward+25),-.04,26),.69,-.75);
  const ferry = ship(new THREE.Vector3(79,-.12,6),.45,.22,false);

  for (const [material,matrices] of city.userData.roofs || []) {
    const roofs = new THREE.InstancedMesh(boxGeometry,material,matrices.length);
    matrices.forEach((matrix,index) => roofs.setMatrixAt(index,matrix));
    roofs.computeBoundingSphere();
    city.add(roofs);
  }
  delete city.userData.roofs;
  flush();
  flushRibbons(city);

  const traffic = trafficRoutes.flatMap(({ curve,width,count },routeIndex) => Array.from({ length: count }, (_,i) => ({
    curve, width, offset: (i + random()*.46)/count, speed: .020 + random()*.016 + (routeIndex%3)*.003,
    side: i%2 ? -1 : 1, size: i%6 === 0 ? 1.30 : 1,
  })));
  const carsPaint = standard(0xffffff, { roughness: .57, metalness: .10 });
  const bodies = new THREE.InstancedMesh(boxGeometry,carsPaint,traffic.length);
  const cabins = new THREE.InstancedMesh(boxGeometry,black,traffic.length);
  const headlights = new THREE.InstancedMesh(boxGeometry,paleGlass,traffic.length);
  const tailLights = new THREE.InstancedMesh(boxGeometry,redLamp,traffic.length);
  for (const mesh of [bodies,cabins,headlights,tailLights]) {
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    city.add(mesh);
  }
  const paintChoices = [0xd18b61,0x77b9c1,0xe7d7b4,0x487092,0x6d8770,0xc35846];
  traffic.forEach((_,i) => bodies.setColorAt(i,new THREE.Color(paintChoices[i%paintChoices.length])));
  const location = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const transform = new THREE.Matrix4();
  function carPart(mesh,i,x,y,z,w,h,l) {
    location.set(x,y,z);
    scale.set(w,h,l);
    transform.compose(location,rotation,scale);
    mesh.setMatrixAt(i,transform);
  }

  function update(_dt, elapsed) {
    for (let i = 0; i < traffic.length; i++) {
      const { curve,width,offset,speed,side,size } = traffic[i];
      const time = (offset + elapsed * speed) % 1;
      const fraction = side > 0 ? time : 1-time;
      const {x,y,z} = curve.getPointAt(fraction);
      curve.getTangentAt(fraction,tangent);
      const directionX = tangent.x * side, directionZ = tangent.z * side;
      rotation.setFromAxisAngle(up,Math.atan2(directionX,directionZ));
      const lane = (width* .22);
      const centerX = x + directionZ * lane, centerZ = z - directionX * lane;
      carPart(bodies,i,centerX,y + .23 * size,centerZ,.78*size,.35*size,1.52*size);
      carPart(cabins,i,centerX,y + .46*size,centerZ, .65*size,.22*size,.81*size);
      const edge = .764*size;
      carPart(headlights,i,centerX+directionX*edge,y+.24*size,centerZ+directionZ*edge,.57*size,.09,.05);
      carPart(tailLights,i,centerX-directionX*edge,y+.24*size,centerZ-directionZ*edge,.60*size,.07,.05);
    }
    for (const mesh of [bodies,cabins,headlights,tailLights]) mesh.instanceMatrix.needsUpdate = true;
    ferry.position.set(82 + Math.sin(elapsed * .068) * 12,.05 + Math.sin(elapsed * 1.3) * .05,6 + Math.cos(elapsed * .068) * 10);
    ferry.rotation.y = Math.atan2(12*Math.cos(elapsed*.068),-10*Math.sin(elapsed*.068));
  }

  function setNight(night) {
    lightWindow[0].emissiveIntensity = night ? 1.75 : .22;
    lightWindow[1].emissiveIntensity = night ? .85 : .11;
    lamps.emissiveIntensity = night ? 2.65 : .35;
    aquaLamp.emissiveIntensity = night ? 1.50 : .30;
    redLamp.emissiveIntensity = night ? 1.55 : .50;
  }

  update(0,0);
  return {
    update,
    setNight,
    cutMaterials: [asphalt,pavement,walkway,stripe,black,carsPaint,paleGlass,redLamp],
    landmarks: {
      northSkyline: new THREE.Vector3(-6,26,-44),
      harbor: new THREE.Vector3(seaward+8,4,56),
      bridge: new THREE.Vector3(50,9,riverZ(50)),
      lake: new THREE.Vector3(25,1.15,-43),
      rural: new THREE.Vector3(-85,2.3,43),
    },
  };
}
