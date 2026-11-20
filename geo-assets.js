import * as THREE from './vendor/three.module.js';
import { geoSites, GEO } from './geo-data.js';

const BOX = new THREE.BoxGeometry();
const COLUMN = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
const FOOT = new THREE.CylinderGeometry(0.49, 0.58, 1, 10);
const ROCK = new THREE.IcosahedronGeometry(0.5, 0);
const OPEN_SHAFT = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true, Math.PI * 0.46, Math.PI * 1.08);
const WHEEL = new THREE.TorusGeometry(0.5, 0.078, 6, 18);
const ARROW = new THREE.ConeGeometry(0.5, 1, 5);
const UP = new THREE.Vector3(0, 1, 0);
const SUPPLY_Z = GEO.front + 7.25;
const SEWER_Z = GEO.front + 10.2;
const BASE_Z = GEO.front + 2.5;

function atDepth(value) {
  return -value * GEO.exaggeration;
}

function toPoint(x, y, z) {
  return new THREE.Vector3(x, y, z);
}

function makeBatches(group) {
  const palette = new Map();
  const pose = new THREE.Object3D();
  const along = new THREE.Vector3();

  function stash(material, geometry) {
    if (!palette.has(material)) palette.set(material, new Map());
    const geometries = palette.get(material);
    if (!geometries.has(geometry)) geometries.set(geometry, []);
    pose.updateMatrix();
    geometries.get(geometry).push(pose.matrix.clone());
  }

  function piece(material, x, y, z, width, height, length, geometry = BOX, rx = 0, ry = 0, rz = 0) {
    pose.position.set(x, y, z);
    pose.scale.set(width, height, length);
    pose.rotation.set(rx, ry, rz);
    stash(material, geometry);
  }

  function rod(material, a, b, diameter = 0.3, geometry = COLUMN) {
    along.subVectors(b, a);
    const length = along.length();
    if (length < 0.0001) return;
    pose.position.copy(a).lerp(b, 0.5);
    pose.scale.set(diameter, length, diameter);
    pose.quaternion.setFromUnitVectors(UP, along.divideScalar(length));
    stash(material, geometry);
  }

  function finish() {
    for (const [material, geometries] of palette) {
      for (const [shape, matrices] of geometries) {
        const mesh = new THREE.InstancedMesh(shape, material, matrices.length);
        for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]);
        mesh.computeBoundingSphere();
        group.add(mesh);
      }
    }
  }

  return { piece, rod, finish };
}

function supplyRoutes(sites) {
  return sites.map((site, index) => {
    const here = atDepth(site.pipes.supply);
    const join = (neighbor) => neighbor ? (here + atDepth(neighbor.pipes.supply)) / 2 : here;
    return [
      toPoint(site.min + (index === 0 ? 11 : 0), join(sites[index - 1]), SUPPLY_Z),
      toPoint(site.min + 13, here, SUPPLY_Z),
      toPoint(site.max - 13, here, SUPPLY_Z),
      toPoint(site.max - (index === sites.length - 1 ? 11 : 0), join(sites[index + 1]), SUPPLY_Z),
    ];
  });
}

function sewerRoute(site) {
  const middle = atDepth(site.pipes.sewer);
  const left = site.min + 13;
  const right = site.max - 12;
  const rise = (site.x - left) * 0.023;
  const fall = (right - site.x) * 0.023;
  return [
    toPoint(left, middle + rise, SEWER_Z),
    toPoint(site.x, middle, SEWER_Z),
    toPoint(right, middle - fall, SEWER_Z),
  ];
}

function animatePoints(group, material, routes, size, rates) {
  const pairs = routes.flatMap((points, index) => points.slice(1).map((point, step) => {
    const start = points[step];
    const length = start.distanceTo(point);
    return { start, end: point, count: Math.max(1, Math.round(length / 11)), length, rate: rates[index % rates.length] };
  }));
  const count = pairs.reduce((sum, segment) => sum + segment.count, 0);
  const mesh = new THREE.InstancedMesh(BOX, material, count);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(mesh);
  const position = new THREE.Vector3();
  const transform = new THREE.Matrix4();
  const scale = new THREE.Vector3(size * 3.2, size * 0.43, size * 0.37);
  const rotation = new THREE.Quaternion();

  return (elapsed) => {
    let index = 0;
    for (const { start, end, length, count: steps, rate } of pairs) {
      for (let i = 0; i < steps; i++) {
        const cursor = (i / steps + elapsed * rate / Math.max(length, 0.01)) % 1;
        position.copy(start).lerp(end, cursor);
        position.z += size * 0.88;
        transform.compose(position, rotation, scale);
        mesh.setMatrixAt(index++, transform);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
}

function addPipeRun(batch, route, color, seam, rim, diameter, interval) {
  const point = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let step = 1; step < route.length; step++) {
    const left = route[step - 1];
    const right = route[step];
    const length = left.distanceTo(right);
    if (length < 0.02) continue;
    batch.rod(color, left, right, diameter);
    a.copy(left);
    b.copy(right);
    a.z += diameter * 0.475;
    b.z += diameter * 0.475;
    batch.rod(seam, a, b, 0.105);
    for (let cursor = interval * 0.65; cursor < length - 0.3; cursor += interval) {
      point.copy(left).lerp(right, cursor / length);
      a.copy(left).lerp(right, (cursor - 0.11) / length);
      b.copy(left).lerp(right, (cursor + 0.11) / length);
      batch.rod(rim, a, b, diameter * 1.24);
      batch.piece(seam, point.x, point.y + diameter * 0.22, point.z + diameter * 0.57, 0.20, 0.10, 0.11);
    }
  }
}

function accessShaft(batch, palette, x, base, z, diameter, accent) {
  const height = 0.02 - base;
  batch.piece(palette.chamber, x, (base + 0.02) / 2, z, diameter, height, diameter, OPEN_SHAFT);
  batch.piece(palette.asphalt, x, 0.02, z, diameter * 1.25, 0.24, diameter * 1.25, COLUMN);
  batch.piece(accent, x, 0.169, z, diameter * 0.72, 0.08, diameter * 0.72, COLUMN);
  batch.piece(palette.chamber, x, base - 0.23, z, diameter * 1.32, 0.36, diameter * 1.32, COLUMN);
  for (let rung = base + 0.15; rung < -0.18; rung += 0.41) {
    batch.rod(palette.iron, toPoint(x - diameter * 0.26, rung, z + diameter * 0.46), toPoint(x + diameter * 0.26, rung, z + diameter * 0.46), 0.09);
  }
}

function valve(batch, palette, x, y, z, scale = 1) {
  const dimensions = [1.3 * scale, 1.2 * scale, 1.86 * scale];
  batch.piece(palette.brass, x, y, z, ...dimensions, COLUMN, 0, 0, Math.PI / 2);
  batch.rod(palette.iron, toPoint(x, y, z), toPoint(x, y + 1.36 * scale, z), 0.27 * scale);
  batch.piece(palette.brass, x, y + 1.36 * scale, z, 1.43 * scale, 1.43 * scale, 1.43 * scale, WHEEL, Math.PI / 2);
  for (const tilt of [0, Math.PI / 2]) {
    batch.piece(palette.iron, x, y + 1.36 * scale, z, 1.24 * scale, 0.11 * scale, 0.09 * scale, BOX, 0, tilt);
  }
}

function oldCityTrench(site, batch, palette) {
  const center = site.x - 21;
  const y = atDepth(site.pipes.supply);
  const width = 55;
  const zRear = SUPPLY_Z - 1.83;
  const zFront = SUPPLY_Z + 0.35;
  const left = center - width / 2;
  const right = center + width / 2;
  const ledge = y - 0.80;

  batch.piece(palette.chamber, center, (ledge - 0.22) / 2, zRear, width, -ledge + 0.20, 0.84);
  batch.piece(palette.asphalt, center, -0.11, zRear + 0.52, width + 1.5, 0.22, 2.9);
  batch.piece(palette.beddingDark, center, ledge - 0.13, (zRear + zFront) / 2, width + 0.3, 0.27, zFront - zRear + 0.7);
  batch.piece(palette.bedding, center, ledge + 0.045, (zRear + zFront) / 2 + 0.12, width, 0.17, zFront - zRear + 1.0);
  batch.piece(palette.bedding, center, y - 0.61, zRear + 0.39, width, 0.95, 0.34);
  batch.piece(palette.fill, center, -0.63, zRear + 0.50, width, 0.78, 0.40);
  batch.piece(palette.fillSeam, center, -0.51, zRear + 0.721, width, 0.052, 0.06);
  batch.piece(palette.fillSeam, center, -0.78, zRear + 0.727, width, 0.052, 0.06);
  batch.piece(palette.bedding, left, (ledge + 0.1) / 2, zRear + 0.41, 0.43, -ledge + 0.15, 0.91, BOX, 0, 0, -0.23);
  batch.piece(palette.bedding, right, (ledge + 0.1) / 2, zRear + 0.41, 0.43, -ledge + 0.15, 0.91, BOX, 0, 0, 0.23);
  for (let i = 0; i < 118; i++) {
    const x = left + 0.6 + ((i * 7031) % 499) / 499 * (width - 1.2);
    const z = zRear + 0.20 + ((i * 3037) % 277) / 277 * (zFront - zRear + 0.63);
    const size = 0.12 + ((i * 2903) % 157) / 157 * 0.25;
    batch.piece(i % 3 === 0 ? palette.beddingDark : palette.bedding, x, ledge + 0.13, z, size * 1.7, size * 0.61, size * 1.3, ROCK, i * 1.14, i * 2.05);
  }
  for (let x = left + 1.3; x < right - 0.6; x += 1.8) {
    batch.rod(palette.fillSeam, toPoint(x - 0.15, -0.88, zRear + 0.73), toPoint(x + 0.46, -0.38, zRear + 0.74), 0.036);
  }
  const valveX = center + 7.2;
  accessShaft(batch, palette, valveX, y - 0.62, SUPPLY_Z - 0.10, 3.3, palette.waterSeam);
  valve(batch, palette, valveX, y, SUPPLY_Z, 0.90);

  return {
    trench: toPoint(center, y - 0.48, zFront + 0.8),
    backfill: toPoint(center - 8, -0.62, zRear + 0.95),
    bedding: toPoint(center + 10, ledge + 0.14, zFront + 0.61),
    manhole: toPoint(valveX, y + 0.48, SUPPLY_Z + 1.15),
  };
}

function gallery(site, batch, palette) {
  const x = site.x - 29;
  const y = atDepth(10.1);
  const z = GEO.front + 4.1;
  const radius = 15.4;
  batch.piece(palette.concrete, x, y - 2.09, z, radius * 2, 0.48, 5.34);
  batch.piece(palette.concrete, x, y + 2.36, z, radius * 2, 0.48, 5.34);
  batch.piece(palette.chamber, x, y + 0.15, z - 1.74, radius * 2, 3.88, 0.62);
  for (const side of [-1, 1]) {
    batch.piece(palette.concrete, x + side * (radius - 0.25), y + 0.13, z, 0.6, 4.40, 5.35);
  }
  for (const [height, offset, material] of [[-1.16, 0.93, palette.supply], [-0.42, 0.79, palette.supply], [0.84, 0.55, palette.wire]]) {
    batch.rod(material, toPoint(x - radius + 0.62, y + height, z + offset), toPoint(x + radius - 0.62, y + height, z + offset), 0.43);
    for (let a = x - radius + 2.1; a < x + radius - 0.4; a += 4.75) {
      batch.piece(palette.iron, a, y + height - 0.23, z + offset, 0.16, 0.19, 0.77);
    }
  }
  for (let a = x - radius + 2.9; a < x + radius - 0.4; a += 5.6) {
    batch.piece(palette.waterSeam, a, y + 2.03, z + 1.28, 1.41, 0.12, 0.29);
  }
  return toPoint(x, y, z + 3);
}

function loadArrow(batch, palette, x, y, z, length) {
  batch.rod(palette.load, toPoint(x, y + length * 0.42, z), toPoint(x, y - length * 0.22, z), 0.14);
  batch.piece(palette.load, x, y - length * 0.28, z, 0.44, length * 0.28, 0.44, ARROW, 0, 0, Math.PI);
}

function foundation(site, batch, palette) {
  const { type, depth } = site.foundation;
  const x = site.x + 14;
  const y = atDepth(depth);
  const z = BASE_Z;
  const shallow = type === 'pad' || type === 'strip';
  const pileCap = shallow ? 0.36 : 0.49;
  const deck = type === 'strip' ? 38 : type === 'socket' ? 27 : 32;
  const shaftHeight = -y - pileCap;
  batch.piece(palette.concreteDarker, x, -pileCap * 0.25, z, deck + 2.4, pileCap * 1.24, 5.14);
  batch.piece(palette.concrete, x, 0.22, z, deck + 2.8, 0.45, 5.47);
  batch.piece(palette.concreteEdge, x, 0.416, z + 2.73, deck + 2.68, 0.08, 0.09);
  if (type === 'strip') {
    batch.piece(palette.concrete, x, y + 0.36, z, 31.3, 0.72, 4.7);
    batch.piece(palette.concreteDarker, x, y + shaftHeight * 0.63, z, 28.6, shaftHeight * 0.74, 1.93);
    for (let slot = -12.2; slot <= 12.8; slot += 2.3) {
      batch.piece(palette.concreteEdge, x + slot, y + 0.75, z + 0.982, 0.055, 0.64, 0.026);
    }
    for (const shift of [-11, 0, 11]) loadArrow(batch, palette, x + shift, y + 0.76, z + 2.76, 1.14);
  } else {
    const offsets = type === 'pad' || type === 'socket' ? [-9, 0, 9] : [-11.5, -3.9, 3.9, 11.5];
    for (const [index, shift] of offsets.entries()) {
      const pileX = x + shift;
      const diameter = type === 'socket' ? 1.75 : site.id === 'harborfill' ? 2.25 : 1.90;
      if (type === 'pad') {
        batch.piece(palette.concreteDarker, pileX, y + 0.39, z, 5.29, 0.78, 5.00);
        batch.piece(palette.concrete, pileX, y + 0.88, z, 4.45, 0.46, 4.28);
        batch.piece(palette.concrete, pileX, y + 1.02 + shaftHeight * 0.38, z, 1.94, shaftHeight * 0.76, 1.96);
        loadArrow(batch, palette, pileX, y + 0.85, z + 2.84, 1.23);
        continue;
      }
      if (site.id === 'harborfill') {
        const lean = index % 2 ? 2.4 : -2.4;
        batch.rod(palette.concreteDarker, toPoint(pileX, -1.14, z - 1.1), toPoint(pileX + lean, y + 0.24, z - 1.1), diameter * 0.69);
      }
      batch.rod(palette.concrete, toPoint(pileX, -pileCap, z + 1.93), toPoint(pileX, y + 0.54, z + 1.93), diameter);
      batch.piece(palette.concreteDarker, pileX, y + 0.50, z + 1.93, diameter * 1.10, 1.0, diameter * 1.10, FOOT);
      batch.piece(palette.concreteEdge, pileX, y + 0.30, z + 1.93 + diameter * 0.54, diameter * 0.80, 0.17, 0.10);
      const highlightZ = z + 1.93 + diameter * 0.47;
      batch.rod(palette.concreteEdge, toPoint(pileX - diameter * 0.15, -1.02, highlightZ), toPoint(pileX - diameter * 0.15, y + 0.93, highlightZ), diameter * 0.095);
      for (let seam = -4.8; seam > y + 1.5; seam -= type === 'socket' ? 2.0 : 6.4) {
        batch.piece(type === 'socket' ? palette.load : palette.concreteDarker, pileX, seam, z + 1.93, diameter * 1.10, 0.28, diameter * 1.10, COLUMN);
      }
      for (const fraction of [0.26, 0.57, 0.87]) {
        const indicatorY = y * fraction;
        loadArrow(batch, palette, pileX, indicatorY, highlightZ + 0.25, shallow ? 1.07 : 2.23);
      }
    }
  }
  return {
    foundation: toPoint(x, y + 0.16, z + 4.24),
    foundationTop: toPoint(x, -0.35, z + 3.12),
  };
}

export function createGeoAssets(scene) {
  const root = new THREE.Group();
  root.name = 'Geology utility and foundation cross section';
  const pipes = new THREE.Group();
  const supports = new THREE.Group();
  pipes.name = 'Buried services';
  supports.name = 'Foundations';
  root.add(pipes, supports);
  scene.add(root);
  const cut = new THREE.Plane(new THREE.Vector3(0, 1, 0), GEO.limit * GEO.exaggeration);

  function paint(color, intensity = 0, metalness = 0.08, extras = {}) {
    return new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: intensity, metalness, roughness: 0.54, clippingPlanes: [cut], ...extras,
    });
  }

  const palette = {
    supply: paint(0x3c96b5, 0.23, 0.26),
    waterSeam: paint(0x61dcf8, 0.66, 0.20),
    waterFlow: paint(0xb3f8ff, 1.5, 0.10),
    sewer: paint(0xb36a40, 0.18, 0.15),
    sewerSeam: paint(0xf0ae67, 0.48, 0.16),
    sewerFlow: paint(0xffdca4, 0.84, 0.13),
    chamber: paint(0x626e75, 0.1, 0.13, { side: THREE.DoubleSide }),
    asphalt: paint(0x353b43, 0.08),
    iron: paint(0x9faeb0, 0.1, 0.47),
    brass: paint(0xcead68, 0.20, 0.36),
    bedding: paint(0xe2b77a, 0.18),
    beddingDark: paint(0xb99975, 0.18),
    fill: paint(0xa77c46, 0.17),
    fillSeam: paint(0xe1ae6a, 0.25),
    concrete: paint(0xe2d3b7, 0.32, 0.07),
    concreteDarker: paint(0x999a85, 0.21, 0.07),
    concreteEdge: paint(0xffe8c6, 0.55, 0.07),
    load: paint(0xffce70, 0.75, 0.05),
    wire: paint(0xb49bf4, 0.42),
  };
  const pipeBatch = makeBatches(pipes);
  const supportBatch = makeBatches(supports);
  const supply = supplyRoutes(geoSites);
  const sewers = geoSites.map(sewerRoute);
  const markers = {};

  geoSites.forEach((site, index) => {
    const y = atDepth(site.pipes.supply);
    const d = atDepth(site.pipes.sewer);
    addPipeRun(pipeBatch, supply[index], palette.supply, palette.waterSeam, palette.iron, index === 2 ? 1.05 : 1.32, 8.35);
    addPipeRun(pipeBatch, sewers[index], palette.sewer, palette.sewerSeam, palette.beddingDark, 1.5, 9.5);
    const start = sewers[index][0];
    const last = sewers[index].at(-1);
    accessShaft(pipeBatch, palette, start.x, start.y - 0.59, SEWER_Z, 1.70, palette.sewerSeam);
    accessShaft(pipeBatch, palette, last.x, last.y - 0.59, SEWER_Z, 1.76, palette.sewerSeam);
    for (const x of [start.x, last.x]) {
      const bottom = x === start.x ? start.y : last.y;
      pipeBatch.rod(palette.sewerSeam, toPoint(x, bottom - 0.16, SEWER_Z + 0.09), toPoint(x, bottom + 0.37, SEWER_Z + 0.09), 1.21);
    }

    if (site.id !== 'oldcity') {
      const x = site.x - 21;
      accessShaft(pipeBatch, palette, x, y - 0.47, SUPPLY_Z - 0.16, 2.3, palette.waterSeam);
      valve(pipeBatch, palette, x, y, SUPPLY_Z, 0.85);
      for (const reach of [5.4, 13.7]) {
        const tap = x + reach;
        pipeBatch.rod(palette.supply, toPoint(tap, y + 0.01, SUPPLY_Z), toPoint(tap, -0.39, SUPPLY_Z - 1.94), 0.29);
      }
    }

    markers[site.id] = {
      supply: toPoint(site.x - 0.9, y, SUPPLY_Z + 1.07),
      sewer: toPoint(site.x - 1.0, d, SEWER_Z + 1.15),
      ...foundation(site, supportBatch, palette),
    };
    if (site.id === 'oldcity') Object.assign(markers[site.id], oldCityTrench(site, pipeBatch, palette));
    if (site.id === 'harborfill') markers[site.id].gallery = gallery(site, pipeBatch, palette);
  });

  pipeBatch.finish();
  supportBatch.finish();
  const pulseSupply = animatePoints(pipes, palette.waterFlow, supply, 0.79, [7.1, 6.4, 8.9]);
  const pulseSewer = animatePoints(pipes, palette.sewerFlow, sewers, 0.94, [3.0, 3.6, 4.2]);
  let enabled = false;
  let filter = 'all';
  let depth = GEO.limit;

  function applyVisibility() {
    root.visible = enabled && depth > 0.025;
    pipes.visible = filter === 'all' || filter === 'pipes';
    supports.visible = filter === 'all' || filter === 'foundation';
  }

  function update(_dt, elapsed) {
    if (!root.visible || !pipes.visible) return;
    pulseSupply(elapsed);
    pulseSewer(elapsed);
  }

  applyVisibility();
  return {
    markers,
    setVisible(value) {
      enabled = Boolean(value);
      applyVisibility();
    },
    setDepth(value) {
      depth = THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, GEO.limit);
      cut.constant = depth * GEO.exaggeration;
      applyVisibility();
    },
    setFilter(value) {
      filter = ['all', 'pipes', 'foundation', 'earth'].includes(value) ? value : 'all';
      applyVisibility();
    },
    update,
  };
}
