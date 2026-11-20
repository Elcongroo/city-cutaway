import * as THREE from './vendor/three.module.js';

const boxGeometry = new THREE.BoxGeometry();
const sphereGeometry = new THREE.IcosahedronGeometry(1, 1);
const leafGeometry = new THREE.IcosahedronGeometry(1, 0);
const tubeGeometry = new THREE.CylinderGeometry(1, 1, 1, 7);
const planeGeometry = new THREE.PlaneGeometry();
const up = new THREE.Vector3(0, 1, 0);
const amber = 0xffcca2;
const daylight = 0x91d7e9;

function standard(color, settings = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...settings });
}

function glow(color, intensity, settings = {}) {
  return standard(color, { emissive: color, emissiveIntensity: intensity, roughness: 0.63, ...settings });
}

function random(seed) {
  let current = seed;
  return () => ((current = (Math.imul(current, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function roundBoxGeometry(r) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5 + r, -0.5);
  shape.lineTo(0.5 - r, -0.5);
  shape.quadraticCurveTo(0.5, -0.5, 0.5, -0.5 + r);
  shape.lineTo(0.5, 0.5 - r);
  shape.quadraticCurveTo(0.5, 0.5, 0.5 - r, 0.5);
  shape.lineTo(-0.5 + r, 0.5);
  shape.quadraticCurveTo(-0.5, 0.5, -0.5, 0.5 - r);
  shape.lineTo(-0.5, -0.5 + r);
  shape.quadraticCurveTo(-0.5, -0.5, -0.5 + r, -0.5);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 3 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -0.5, 0);
  return geometry;
}

const carBody = roundBoxGeometry(0.20);
const carCabin = roundBoxGeometry(0.28);

function batches(parent, { castShadow = false, receiveShadow = false } = {}) {
  const pieces = new Map();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3(), dimensions = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const end = new THREE.Vector3(), axis = new THREE.Vector3();
  function record(geometry, material) {
    const key = geometry.id + ':' + material.id;
    if (!pieces.has(key)) pieces.set(key, { geometry, material, transforms: [] });
    pieces.get(key).transforms.push(matrix.clone());
  }
  function shape(material, x, y, z, sx, sy, sz, yaw = 0, geometry = boxGeometry) {
    position.set(x, y, z);
    dimensions.set(sx, sy, sz);
    rotation.setFromAxisAngle(up, yaw);
    matrix.compose(position, rotation, dimensions);
    record(geometry, material);
  }
  function rod(material, a, b, radius) {
    position.set(...a);
    end.set(...b);
    axis.subVectors(end, position);
    const length = axis.length();
    if (!length) return;
    rotation.setFromUnitVectors(up, axis.divideScalar(length));
    position.lerp(end, 0.5);
    dimensions.set(radius, length, radius);
    matrix.compose(position, rotation, dimensions);
    record(tubeGeometry, material);
  }
  function finish() {
    for (const { geometry, material, transforms } of pieces.values()) {
      const instance = new THREE.InstancedMesh(geometry, material, transforms.length);
      transforms.forEach((transform, index) => instance.setMatrixAt(index, transform));
      instance.computeBoundingBox();
      instance.computeBoundingSphere();
      instance.castShadow = castShadow;
      instance.receiveShadow = receiveShadow;
      parent.add(instance);
    }
  }
  return { shape, rod, finish };
}

function canvasTexture(width, height, draw) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context || !context.fillText) return null;
  draw(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function sign(parent, title, subtitle, color, textColor, x, y, z, width, height) {
  const texture = canvasTexture(384, 96, context => {
    context.fillStyle = color;
    context.fillRect(0, 0, 384, 96);
    context.fillStyle = textColor;
    context.fillRect(13, 17, 3, 62);
    context.textBaseline = 'middle';
    context.font = subtitle ? 'bold 43px "Microsoft Yahei", "PingFang SC", sans-serif' : 'bold 46px "Microsoft Yahei", "PingFang SC", sans-serif';
    context.fillText(title, 26, subtitle ? 38 : 50, 335);
    if (subtitle) {
      context.font = '17px sans-serif';
      context.fillText(subtitle, 28, 68, 320);
    }
  });
  const material = new THREE.MeshBasicMaterial({
    color: texture ? 0xffffff : new THREE.Color(color), map: texture, toneMapped: false,
  });
  const plate = new THREE.Mesh(planeGeometry, material);
  plate.scale.set(width, height, 1);
  plate.position.set(x, y, z);
  parent.add(plate);
}

export function createStreetScene(scene) {
  const neighborhood = new THREE.Group();
  neighborhood.name = 'Living street';
  scene.add(neighborhood);
  const terrain = batches(neighborhood, { receiveShadow: true });
  const solid = batches(neighborhood, { castShadow: true });
  const plants = batches(neighborhood, { castShadow: true });
  const sample = random(2318);
  const slab = standard(0x354550);
  const terrazzo = standard(0x899892);
  const curb = standard(0xa9b0a1);
  const seam = standard(0x6d7979);
  const road = standard(0x24333d, { roughness: 0.63, metalness: 0.26 });
  const roadPatch = standard(0x314350, { roughness: 0.60, metalness: 0.25 });
  const asphaltInset = standard(0x303e48, { roughness: 0.30, metalness: 0.42 });
  const paint = standard(0xc8d0c7);
  const paintGold = standard(0xdcb166);
  const iron = standard(0x263d46, { roughness: 0.52, metalness: 0.42 });
  const steel = standard(0x7b999e, { roughness: 0.56, metalness: 0.52 });
  const concrete = standard(0xa7aca1);
  const sandstone = standard(0xb69773);
  const brick = standard(0x865451);
  const brickShade = standard(0x65474b);
  const copper = standard(0xad7553, { metalness: 0.32 });
  const wall = standard(0x5d6b70);
  const dark = standard(0x243339);
  const mutedGlass = standard(0x405e6b, { roughness: 0.26, metalness: 0.45 });
  const blueGlass = standard(0x416b7d, { roughness: 0.26, metalness: 0.37 });
  const aquaGlass = standard(0x549394, { roughness: 0.29, metalness: 0.36 });
  const ceramic = standard(0xa38170);
  const interior = standard(0x92774f);
  const yellow = glow(amber, 0.37);
  const cream = glow(0xffe1bb, 0.43);
  const cool = glow(daylight, 0.24);
  const lamps = glow(0xffd190, 0.64);
  const signalOff = glow(0xfe7756, 0.56);
  const signalOn = glow(0x84edbb, 0.66);
  const turf = standard(0x355f55);
  const gravel = standard(0x607370);
  const wood = standard(0x88644d);
  const bark = standard(0x585047);
  const foliage = [0x254c43, 0x356454, 0x497763, 0x5d8768].map(color => standard(color));
  const roofPlants = [standard(0x588561), standard(0xa38d57)];

  terrain.shape(slab, 0, -0.125, -2.10, 36, 0.25, 17.80);
  terrain.shape(slab, 0, -0.125, 10.33, 36, 0.25, 1.34);
  terrain.shape(slab, -8.46, -0.125, 8.23, 19.08, 0.25, 2.86);
  terrain.shape(slab, 10.91, -0.125, 8.23, 14.18, 0.25, 2.86);
  terrain.shape(slab, 2.45, -0.14, 8.23, 2.90, 0.22, 2.86);

  terrain.shape(road, 0, 0.009, 1, 35.98, 0.018, 7);
  terrain.shape(terrazzo, 0, 0.064, -4.33, 35.98, 0.128, 3.66);
  terrain.shape(terrazzo, 0, 0.065, 5.68, 35.98, 0.13, 2.30);
  terrain.shape(sandstone, 0, 0.046, -8.57, 35.98, 0.092, 4.83);
  terrain.shape(terrazzo, -8.46, 0.061, 8.23, 19.08, 0.122, 2.86);
  terrain.shape(terrazzo, 10.91, 0.061, 8.23, 14.18, 0.122, 2.86);
  terrain.shape(terrazzo, 0, 0.062, 10.33, 35.98, 0.124, 1.34);
  terrain.shape(curb, 0, 0.083, -2.54, 35.98, 0.166, 0.17);
  terrain.shape(curb, 0, 0.082, 4.55, 35.98, 0.164, 0.17);
  for (let x = -17.7; x < 18; x += 0.91) {
    for (const z of [-5.25, -4.49, -3.73, -2.93, 4.93, 5.52, 6.15, 10.64]) {
      if (z === 10.64 && x > 0.94 && x < 3.84) continue;
      terrain.shape(seam, x, z < 0 ? 0.132 : 0.134, z, 0.015, 0.006, 0.56);
    }
  }
  for (const z of [-5.52, -4.77, -4.04, -3.28, 5.14, 5.94, 10.87]) {
    terrain.shape(seam, 0, 0.137, z, 35.84, 0.005, 0.017);
  }

  for (let x = -16.75; x < 18; x += 3.25) {
    if (Math.abs(x - 8.0) > 1.85 && Math.abs(x + 10.1) > 1.64) {
      terrain.shape(paintGold, x, 0.022, 0.96, 1.51, 0.006, 0.057);
    }
    for (const z of [-2.10, 4.09]) terrain.shape(paint, x, 0.022, z, 2.36, 0.006, 0.050);
  }
  for (const x of [-10.65, 8.47]) {
    for (let z = -2.15; z < 4.36; z += 0.49) terrain.shape(paint, x, 0.026, z, 1.91, 0.01, 0.265);
    for (const side of [-1, 1]) {
      for (let i = -2; i <= 2; i++) {
        terrain.shape(paintGold, x + i * 0.28, 0.153, side < 0 ? -2.84 : 4.84, 0.117, 0.023, 0.31);
      }
    }
  }
  for (const [x, z, direction] of [[-3.7,-0.68,1], [14.2,-0.66,1],[2.7,2.73,-1],[-14.2,2.73,-1]]) {
    terrain.shape(paint, x, 0.023, z, 1.01, 0.009, 0.083);
    terrain.shape(paint, x + direction * 0.46, 0.023, z + 0.124, 0.43, 0.009, 0.055, direction * 0.53);
    terrain.shape(paint, x + direction * 0.46, 0.023, z - 0.124, 0.43, 0.009, 0.055, direction * -0.53);
  }
  for (let i = 0; i < 46; i++) {
    const x = 34 * sample() - 17;
    const z = -1.96 + sample() * 5.96;
    if (Math.abs(x + 10.65) < 1.2 || Math.abs(x - 8.47) < 1.2) continue;
    const material = i % 4 ? roadPatch : asphaltInset;
    terrain.shape(material, x, 0.0193, z, 0.19 + sample() * 0.49, 0.0005, 0.033 + sample() * 0.095, sample() * 0.12 - 0.06);
  }

  function tree(x, z, height, seed = 1) {
    const rnd = random(seed);
    plants.rod(bark, [x, 0.12, z], [x - 0.05, height * 0.76, z], height * 0.042);
    plants.rod(bark, [x, height * 0.55, z], [x + height * 0.22, height * 0.81, z - height * 0.07], height * 0.019);
    for (let i = 0; i < 13; i++) {
      const a = i * 2.399 + seed;
      const radial = (0.18 + rnd() * 0.78) * height * 0.35;
      const radius = height * (0.20 + rnd() * 0.14);
      plants.shape(foliage[i % foliage.length], x + Math.cos(a) * radial, height * (0.76 + rnd() * 0.30),
        z + Math.sin(a) * radial, radius, radius * (0.76 + rnd() * 0.49), radius * 0.98, a, i % 3 === 0 ? leafGeometry : sphereGeometry);
    }
  }

  function roof(x, z, width, depth, height, tint) {
    solid.shape(tint, x, height + 0.055, z, width + 0.14, 0.11, depth + 0.14);
    for (const side of [-1, 1]) {
      solid.shape(tint, x, height + 0.23, z + side * (depth / 2 - 0.02), width + 0.13, 0.32, 0.14);
      solid.shape(tint, x + side * (width / 2 - 0.02), height + 0.23, z, 0.14, 0.32, depth + 0.13);
    }
    solid.shape(iron, x - width * 0.24, height + 0.34, z - depth * 0.17, 1.21, 0.52, 0.89);
    solid.shape(steel, x - width * 0.24, height + 0.62, z - depth * 0.17, 1.34, 0.12, 1.00);
    for (let n = 0; n < 5; n++) solid.shape(iron, x - width * 0.24 + (n - 2) * 0.16,
      height + 0.696, z - depth * 0.17, 0.024, 0.023, 0.73);
    solid.shape(wall, x + width * 0.28, height + 0.205, z - depth * 0.22, 0.85, 0.31, 0.67);
    for (let i = 0; i < 3; i++) solid.shape(steel, x + width * 0.28 + (i - 1) * 0.20,
      height + 0.40, z - depth * 0.22, 0.1, 0.17, 0.45);
  }

  function buildingBody(config) {
    const { x, z, w, d, h, front, frame, mode, floors } = config;
    const face = z + d / 2;
    const side = x + w / 2;
    const randomWindow = random(config.seed);
    const groundHeight = 1.53;
    const spacing = (h - groundHeight - 0.3) / floors;
    solid.shape(front, x, h * 0.5 + 0.12, z, w, h, d);
    solid.shape(frame, x, 0.36, z, w + 0.11, 0.43, d + 0.15);
    solid.shape(dark, x, 0.92, face + 0.026, w * 0.91, 1.15, 0.082);
    solid.shape(dark, side + 0.022, 0.91, z, 0.081, 1.12, d * 0.9);

    const shops = Math.ceil(w / 1.10);
    const frontage = w * 0.9 / shops;
    for (let i = 0; i < shops; i++) {
      const sx = x - w * 0.45 + frontage * (i + 0.5);
      solid.shape(i % 4 ? yellow : mutedGlass, sx, 0.97, face + 0.074, frontage * 0.83, 1.01, 0.026);
      solid.shape(i % 4 ? cream : cool, sx, 1.34, face + 0.097, frontage * 0.82, 0.042, 0.032);
      solid.shape(iron, sx + frontage * 0.30, 0.985, face + 0.108, 0.043, 0.98, 0.049);
      solid.shape(interior, sx, 0.64, face + 0.10, frontage * 0.66, 0.38, 0.025);
      solid.shape(steel, sx - frontage * 0.21, 0.88, face + 0.117, 0.037, 0.18, 0.037);
    }
    for (let i = 0; i < Math.ceil(d / 1.35); i++) {
      const dz = z - d * 0.41 + 1.13 * i;
      if (dz > z + d / 2 - 0.2) break;
      solid.shape(i % 3 ? mutedGlass : yellow, side + 0.065, 1.01, dz, 0.028, 0.92, 0.93);
      solid.shape(frame, side + 0.069, 0.52, dz, 0.055, 0.091, 0.94);
    }
    solid.shape(frame, x, 1.58, face + 0.35, w + 0.13, 0.13, 0.87);
    for (let i = 0; i < 8; i++) {
      const bx = x - w * 0.46 + w * 0.92 * i / 7;
      solid.shape(frame, bx, 0.9, face + 0.118, 0.075, 1.075, 0.095);
      solid.shape(lamps, bx, 1.505, face + 0.40, 0.118, 0.022, 0.147);
    }
    if (mode === 'brick') {
      for (let i = 1; i < 12; i++) {
        const y = 1.52 + (h - 1.54) * i / 12;
        solid.shape(brickShade, x, y, face + 0.021, w - 0.1, 0.032, 0.034);
        solid.shape(brickShade, side + 0.021, y, z, 0.034, 0.032, d - 0.11);
      }
    }
    for (let level = 0; level < floors; level++) {
      const y = groundHeight + spacing * (level + 0.53);
      const count = Math.ceil(w / (mode === 'tower' ? 1.28 : 1.5));
      const pitch = w * 0.88 / count;
      const windowHeight = spacing * (mode === 'tower' ? 0.80 : 0.56);
      const sill = y - windowHeight / 2 - 0.022;
      for (let i = 0; i < count; i++) {
        const wx = x - 0.44 * w + pitch * (i + 0.5);
        const on = randomWindow();
        const window = on < 0.25 ? yellow : on < 0.38 ? cool : mode === 'tower' ? blueGlass : mutedGlass;
        solid.shape(dark, wx, y, face + 0.033, pitch * 0.82, windowHeight + 0.093, 0.065);
        solid.shape(window, wx, y, face + 0.071, pitch * 0.74, windowHeight, 0.025);
        solid.shape(iron, wx + pitch * 0.11, y, face + 0.089, 0.045, windowHeight, 0.032);
        solid.shape(frame, wx, sill, face + 0.104, pitch * 0.86, 0.046, 0.176);
        if (mode === 'terrace' && (i + level) % 3 !== 0) {
          const width = pitch * 0.92;
          solid.shape(concrete, wx, sill - 0.03, face + 0.39, width, 0.11, 0.69);
          solid.shape(iron, wx, sill + 0.27, face + 0.69, width, 0.048, 0.069);
          for (const offset of [-0.38, 0.38]) solid.shape(iron, wx + width * offset, sill + 0.13, face + 0.69, 0.047, 0.27, 0.047);
          if (on > 0.39) {
            solid.shape(wood, wx - width * 0.24, sill + 0.065, face + 0.47, 0.31, 0.15, 0.22);
            plants.shape(roofPlants[level % 2], wx - width * 0.24, sill + 0.19, face + 0.47, 0.18, 0.12, 0.16, 0.21, sphereGeometry);
          }
        }
      }
      const sideCount = Math.ceil(d / 1.40);
      const sidePitch = d * 0.84 / sideCount;
      for (let i = 0; i < sideCount; i++) {
        const wz = z - 0.42 * d + sidePitch * (i + 0.5);
        const on = randomWindow();
        const tint = on < 0.25 ? yellow : on < 0.40 ? cool : mode === 'tower' ? aquaGlass : mutedGlass;
        solid.shape(dark, side + 0.027, y, wz, 0.064, windowHeight + 0.075, sidePitch * 0.83);
        solid.shape(tint, side + 0.065, y, wz, 0.027, windowHeight, sidePitch * 0.72);
        solid.shape(frame, side + 0.10, sill, wz, 0.177, 0.044, sidePitch * 0.89);
      }
      if (mode !== 'brick') {
        solid.shape(frame, x, y - spacing * 0.48, face + 0.052, w + 0.11, 0.053, 0.16);
        solid.shape(frame, side + 0.05, y - spacing * 0.48, z, 0.16, 0.053, d + 0.10);
      }
    }
    solid.shape(frame, x - w / 2 + 0.10, h * 0.5 + 0.15, face + 0.048, 0.16, h, 0.15);
    solid.shape(frame, x + w / 2 - 0.10, h * 0.5 + 0.15, face + 0.048, 0.16, h, 0.15);
    roof(x, z, w, d, h + 0.13, frame);
    return face;
  }

  const left = buildingBody({ x: -13.1, z: -7.02, w: 7.30, d: 7.0, h: 5.70,
    front: brick, frame: sandstone, mode: 'brick', floors: 4, seed: 81 });
  sign(neighborhood, '街角咖啡', 'CORNER CAFE', '#58332e', '#ffd8a7', -13.15, 1.71, left + 0.79, 3.02, 0.63);
  for (let i = 0; i < 5; i++) solid.shape(i % 2 ? copper : brick, -15.58 + i * 0.41, 1.49, left + 0.44, 0.40, 0.13, 0.86);
  solid.shape(brickShade, -14.54, 6.31, -9.24, 1.39, 1.1, 1.24);
  solid.shape(sandstone, -14.54, 6.88, -9.24, 1.56, 0.13, 1.46);
  solid.shape(iron, -15.46, 0.21, left + 1.18, 1.62, 0.16, 0.72);

  const tower = buildingBody({ x: -5.78, z: -7.07, w: 6.26, d: 7.71, h: 11.39,
    front: wall, frame: steel, mode: 'tower', floors: 9, seed: 95 });
  solid.shape(wall, -5.95, 12.05, -7.72, 4.85, 1.17, 5.40);
  solid.shape(iron, -5.95, 12.72, -7.72, 5.03, 0.17, 5.57);
  for (let i = 0; i < 8; i++) solid.shape(i % 3 ? blueGlass : cool, -8.08 + i * 0.60, 12.04, -5.01, 0.52, 0.69, 0.05);
  for (const dx of [-2.27, 1.03, 2.28]) solid.shape(steel, -5.78 + dx, 6.54, tower + 0.136, 0.065, 9.68, 0.152);
  solid.shape(steel, -5.22, 13.11, -8.81, 0.076, 0.83, 0.072);
  solid.shape(signalOff, -5.22, 13.55, -8.81, 0.073, 0.087, 0.073);
  sign(neighborhood, '海湾便利', 'OPEN LATE', '#214752', '#c4fff3', -5.8, 1.72, tower + 0.795, 3.27, 0.62);

  const terrace = buildingBody({ x: 2.62, z: -7.05, w: 9.00, d: 7.57, h: 8.48,
    front: concrete, frame: sandstone, mode: 'terrace', floors: 6, seed: 98 });
  solid.shape(ceramic, 1.04, 9.03, -8.35, 5.82, 0.90, 3.87);
  solid.shape(concrete, 1.04, 9.52, -8.35, 5.96, 0.13, 4.02);
  solid.shape(mutedGlass, 1.17, 9.01, -6.393, 4.52, 0.53, 0.035);
  solid.shape(iron, 2.62, 8.79, -3.32, 8.0, 0.052, 0.066);
  for (let i = 0; i < 6; i++) {
    const x = -1.05 + i * 1.21;
    solid.shape(wood, x, 8.74, -4.07, 0.67, 0.23, 0.57);
    plants.shape(roofPlants[i % 2], x, 8.92, -4.07, 0.28, 0.27, 0.24, i * 1.33, sphereGeometry);
  }
  sign(neighborhood, '巷口食堂', 'FAMILY KITCHEN', '#634a32', '#ffe1ad', 2.59, 1.72, terrace + 0.790, 3.19, 0.64);

  const right = buildingBody({ x: 12.60, z: -6.68, w: 7.15, d: 8.20, h: 6.72,
    front: ceramic, frame: concrete, mode: 'plain', floors: 5, seed: 72 });
  solid.shape(wall, 12.65, 7.21, -8.43, 5.74, 0.93, 3.69);
  solid.shape(steel, 12.65, 7.75, -8.43, 5.90, 0.15, 3.88);
  solid.shape(iron, 15.84, 7.38, -8.52, 0.48, 1.11, 0.63);
  for (let i = 0; i < 4; i++) {
    solid.shape(blueGlass, 10.0 + i * 1.45, 7.26, -6.57, 1.23, 0.54, 0.059);
    solid.shape(roofPlants[i % 2], 10.0 + i * 1.45, 7.02, -4.02, 0.78, 0.27, 0.11, i, sphereGeometry);
  }
  sign(neighborhood, '银杏药房', 'PHARMACY', '#204b49', '#a5ffe1', 12.35, 1.71, right + 0.787, 3.20, 0.61);
  solid.shape(signalOn, 14.47, 1.724, right + 0.800, 0.14, 0.43, 0.022);
  solid.shape(signalOn, 14.47, 1.724, right + 0.805, 0.41, 0.13, 0.022);

  solid.shape(sandstone, -12.65, 0.19, 8.68, 7.65, 0.30, 3.13);
  solid.shape(turf, -12.65, 0.345, 8.68, 7.26, 0.06, 2.78);
  solid.shape(sandstone, -3.64, 0.17, 9.19, 3.71, 0.26, 2.30);
  solid.shape(turf, -3.64, 0.31, 9.19, 3.39, 0.09, 1.98);
  solid.shape(curb, 10.02, 0.16, 9.30, 4.78, 0.23, 2.52);
  solid.shape(turf, 10.02, 0.284, 9.30, 4.48, 0.07, 2.19);
  solid.shape(gravel, 15.4, 0.14, 9.12, 3.82, 0.07, 2.40);
  solid.rod(wood, [-15.9,0.36,7.34], [-11.5,0.36,7.34], 0.076);
  solid.rod(wood, [8.13,0.36,8.17], [11.5,0.36,8.17], 0.076);
  for (const [x, z, h, seed] of [[-15.35,8.89,3.26,1],[-11.45,8.85,3.0,2],
    [-3.86,9.02,2.55,7],[9.37,9.07,3.18,4],[11.55,9.06,2.42,6]]) tree(x,z,h,seed);
  for (let i = 0; i < 26; i++) {
    const x = i < 12 ? -16.02 + sample() * 6.64 : i < 19 ? -5.12 + sample() * 2.55 : 8.25 + sample() * 3.62;
    const z = i < 12 ? 7.45 + sample() * 2.39 : i < 19 ? 8.41 + sample() * 1.34 : 8.64 + sample() * 1.25;
    plants.shape(roofPlants[i % 2], x, 0.41 + sample() * 0.09, z, 0.13 + sample() * 0.22, 0.12 + sample() * 0.18, 0.21, i, leafGeometry);
  }

  function bench(x, z, direction = 1) {
    const seatZ = z + direction * 0.11;
    for (let i = 0; i < 4; i++) solid.shape(wood, x, 0.39, seatZ + i * 0.07 * direction, 1.11, 0.064, 0.05);
    for (const dx of [-0.41, .41]) {
      solid.shape(iron, x + dx, 0.251, seatZ, 0.08, 0.32, 0.25);
      solid.shape(iron, x + dx, 0.52, seatZ + direction * 0.22, 0.064, 0.31, 0.074);
    }
    for (const dy of [0.54, 0.63]) solid.shape(wood, x, dy, seatZ + direction * 0.238, 1.11, 0.054, 0.053);
  }
  bench(-13.73, 7.33);
  bench(-5.39, 6.37);
  bench(8.94, 7.45);
  bench(15.12, 9.63, -1);

  const stairEdge = standard(0x607d7c);
  solid.shape(dark, 2.45, -0.080, 8.22, 2.8, 0.033, 2.79);
  for (const side of [-1, 1]) {
    solid.shape(curb, 2.45 + side * 1.42, 0.225, 8.19, 0.19, 0.40, 2.99);
    solid.rod(steel, [2.45 + side * 1.28, 0.70, 6.91], [2.45 + side * 1.28, 0.55, 9.35], 0.035);
    for (const z of [7.03, 8.24, 9.15]) {
      solid.rod(steel, [2.45 + side * 1.26, 0.19, z], [2.45 + side * 1.26, 0.61, z], 0.029);
    }
  }
  for (let i = 0; i < 10; i++) {
    const z = 6.82 + i * 0.272;
    const y = 0.10 - i * 0.017;
    solid.shape(i % 2 ? stairEdge : iron, 2.45, y, z, 2.35, 0.20, 0.267);
    solid.shape(steel, 2.45, y + 0.103, z - 0.10, 2.38, 0.021, 0.042);
  }
  solid.rod(steel, [3.66,0.16,7.18], [3.66,1.46,7.18], 0.044);
  solid.shape(iron, 3.66, 1.44, 7.18, 0.77, 0.41, 0.19);
  sign(neighborhood, '地铁', '', '#2e6266', '#cbffed', 3.66, 1.45, 7.288, 0.752, 0.39);
  solid.shape(iron, -7.40, 0.132, 8.91, 0.28, 0.044, 0.28, 0, tubeGeometry);
  solid.shape(steel, -7.40, 0.155, 8.91, 0.21, 0.011, 0.21, 0, tubeGeometry);
  solid.rod(copper, [-7.38, 0.13, 9.35], [-7.38, 0.59, 9.35], 0.095);
  solid.rod(copper, [-7.52, 0.46, 9.35], [-7.25, 0.46, 9.35], 0.053);
  solid.shape(steel, -7.38, 0.605, 9.35, 0.112, 0.08, 0.112, 0, tubeGeometry);

  for (const x of [5.42, 7.85]) solid.rod(steel, [x,0.115,5.93], [x,1.70,5.93], 0.047);
  solid.shape(aquaGlass, 6.64, 0.88, 5.947, 2.48, 1.47, 0.047);
  solid.shape(dark, 6.64, 1.70, 5.58, 2.73, 0.107, 0.90);
  solid.shape(cool, 6.65, 1.641, 5.59, 1.68, 0.022, 0.038);
  bench(6.63, 5.68, 1);
  solid.shape(steel, 13.95, 0.404, 6.58, 0.34, 0.56, 0.34, 0, tubeGeometry);
  solid.shape(dark, 13.95, 0.700, 6.58, 0.35, 0.057, 0.35, 0, tubeGeometry);

  const poolTexture = canvasTexture(96, 96, context => {
    if (!context.createRadialGradient) return;
    const gradient = context.createRadialGradient(48, 48, 0, 48, 48, 48);
    gradient.addColorStop(0, 'rgba(255,241,206,0.85)');
    gradient.addColorStop(.2, 'rgba(255,226,176,0.51)');
    gradient.addColorStop(.61, 'rgba(255,226,176,0.14)');
    gradient.addColorStop(1, 'rgba(255,226,176,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 96, 96);
  });
  const poolMaterial = new THREE.MeshBasicMaterial({
    map: poolTexture, color: amber, blendDst: THREE.OneFactor, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, toneMapped: false, opacity: 0.32,
  });
  function spill(x, z, width, length, toGround = 0.148) {
    if (!poolTexture) return;
    const pool = new THREE.Mesh(planeGeometry, poolMaterial);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, toGround, z);
    pool.scale.set(width, length, 1);
    neighborhood.add(pool);
  }
  for (const [x, z, direction] of [[-15.2,4.93,1],[-4.8,5.14,1],[4.85,4.99,1],[14.8,4.98,1],
    [-9.0,-2.93,-1],[0.3,-3.03,-1],[10.52,-2.93,-1]]) {
    const tip = z - direction * 0.53;
    solid.shape(iron, x, 0.25, z, 0.19, 0.27, 0.19, 0, tubeGeometry);
    solid.rod(iron, [x,0.30,z], [x,2.21,z], 0.056);
    solid.rod(iron, [x,2.21,z], [x,2.44,z - direction * 0.14], 0.055);
    solid.rod(iron, [x,2.44,z - direction * 0.14], [x,2.44,tip], 0.045);
    solid.shape(dark, x, 2.44, tip, 0.23, 0.10, 0.32, 0, carCabin);
    solid.shape(lamps, x, 2.382, tip, 0.18, 0.028, 0.24, 0, carCabin);
    spill(x, tip, 1.68, 2.72);
  }
  for (const x of [-13.1,-5.8,2.6,12.6]) spill(x, -2.82, 4.6, 2.45, 0.152);

  for (const [x,z] of [[-11.76,4.75],[7.34,4.72],[9.73,-2.73]]) {
    solid.rod(iron,[x,0.16,z],[x,1.86,z],.041);
    solid.shape(dark,x,1.73,z,0.17,0.44,0.17,0,carCabin);
    solid.shape(signalOff,x,1.88,z+0.09,0.046,0.046,0.018);
    solid.shape(signalOn,x,1.61,z+0.09,0.046,0.046,0.018);
  }
  for (let i=0;i<13;i++) {
    const x=-17.45+2.77*i;
    if (Math.abs(x-8.47)>1.20 && Math.abs(x+10.65)>1.35) {
      solid.rod(iron,[x,.14,4.79],[x,.43,4.79],.031);
      solid.shape(curb,x,.403,4.79,.057,.04,.057,0,tubeGeometry);
    }
  }

  terrain.finish();
  solid.finish();
  plants.finish();

  const tire = standard(0x151f27);
  const trim = standard(0x374e54, { metalness: 0.28 });
  const windshield = standard(0x537580, { roughness: 0.22, metalness: 0.30 });
  const headlight = glow(0xffefcd, 0.90);
  const taillight = glow(0xff7252, 0.86);
  const headlightReflection = new THREE.MeshBasicMaterial({
    map: poolTexture, color: 0xffd498, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, toneMapped: false, opacity: 0.29,
  });
  const cars = [
    [0x538e8e, -0.39, 1, 0.01, 0.61, 2.06],
    [0xf2ce82, -0.39, 1, 0.31, 0.61, 2.33],
    [0xe8e0ca, -0.39, 1, 0.62, 0.61, 2.41],
    [0x7b91aa, 2.46, -1, 0.12, 0.56, 2.08],
    [0xb35c56, 2.46, -1, 0.44, 0.56, 2.43],
    [0x538685, 2.46, -1, 0.75, 0.56, 3.64],
  ].map(([color, z, direction, phase, speed, length]) => {
    const bus = length > 3;
    const vehicle = new THREE.Group();
    const car = batches(vehicle);
    const shell = standard(color, { metalness: 0.25, roughness: 0.35 });
    car.shape(shell, 0, 0.255, 0, length, bus ? 0.48 : 0.28, bus ? 0.97 : 0.83, 0, carBody);
    car.shape(trim, -0.016, 0.151, 0, length * 0.98, 0.16, 0.83, 0, carBody);
    car.shape(windshield, -0.08, bus ? 0.58 : 0.435, 0, length * (bus ? 0.87 : 0.60), bus ? 0.23 : 0.18, bus ? 0.90 : 0.70, 0, carCabin);
    car.shape(shell, -0.19, bus ? 0.725 : 0.544, 0, length * (bus ? 0.85 : 0.50), 0.073, bus ? 0.90 : 0.70, 0, carCabin);
    if (bus) for (let i = 0; i < 5; i++) car.shape(shell, -1.32 + i * 0.60, 0.57, 0, 0.048, 0.22, 0.92);
    for (const dx of [-1, 1]) {
      for (const dz of [-1, 1]) {
        car.shape(tire, dx * length * 0.31, 0.151, dz * 0.384, 0.295, 0.30, 0.127, 0, carCabin);
        car.shape(steel, dx * length * 0.31, 0.148, dz * 0.449, 0.113, 0.114, 0.017, 0, carCabin);
      }
      car.shape(headlight, length * 0.498, 0.271, dx * 0.282, 0.037, 0.070, 0.123);
      car.shape(taillight, -length * 0.498, 0.272, dx * 0.281, 0.035, 0.066, 0.129);
    }
    car.finish();
    if (poolTexture) {
      const reflection = new THREE.Mesh(planeGeometry, headlightReflection);
      reflection.rotation.x = -Math.PI / 2;
      reflection.position.set(length * 0.5 + 0.36, -0.008, 0);
      reflection.scale.set(1.30, 0.92, 1);
      vehicle.add(reflection);
    }
    vehicle.rotation.y = direction > 0 ? 0 : Math.PI;
    neighborhood.add(vehicle);
    return { vehicle, z, direction, phase, speed, length };
  });

  const leather = standard(0x444247);
  const skin = standard(0xc7956f);
  const hair = standard(0x392f36);
  const clothes = [0xb67f5d, 0x557f8e, 0xc69368, 0x6c8b70, 0xb7837e, 0x8e859a].map(color => standard(color));
  const people = [];
  function addWalkers(x, z, direction, index, standing = false) {
    const figure = new THREE.Group();
    const body = batches(figure);
    body.shape(clothes[index % clothes.length], 0, 0.414, 0, 0.162, 0.245, 0.108, 0, carCabin);
    body.shape(skin, 0, 0.592, 0, 0.067, 0.083, 0.066, 0, sphereGeometry);
    body.shape(hair, -0.009, 0.615, -0.013, 0.065, 0.048, 0.066, 0, sphereGeometry);
    for (const side of [-1, 1]) {
      body.rod(clothes[index % clothes.length], [side * 0.087, 0.49, 0], [side * 0.109, 0.336, -0.026], 0.030);
    }
    if (index % 2 === 0) body.shape(leather, 0, 0.411, -0.069, 0.105, 0.137, 0.049, 0, carCabin);
    body.finish();
    const legs = [-1, 1].map(side => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.048, 0.323, 0);
      const leg = batches(pivot);
      leg.rod(leather, [0,0,0], [0,-0.278,0], 0.036);
      leg.shape(dark, 0, -0.280, 0.021, 0.085, 0.048, 0.12, 0, carCabin);
      leg.finish();
      figure.add(pivot);
      return pivot;
    });
    figure.position.set(x, 0.15, z);
    figure.rotation.y = direction * Math.PI * 0.5;
    neighborhood.add(figure);
    people.push({ figure, legs, x, z, direction, index, standing });
  }
  for (const [x,z,d,i,standing] of [[-16.5,6.02,1,0],[-8.0,5.58,-1,1],[-5.1,-2.94,1,2],
    [7.4,-3.03,-1,3],[4.31,6.29,-1,4], [11.1,5.30,1,5],[14.1,9.66,1,6,true],
    [-12.0,7.22,-1,7,true],[3.51,-3.00,1,8,true],[-8.64,-3.04,-1,9,true]]) addWalkers(x,z,d,i,standing);

  function update(_dt, elapsed, reveal = 0) {
    for (const { vehicle, z, direction, phase, speed, length } of cars) {
      const fade = Math.max(0.75, length / 2);
      const minX = -17.8 + fade, maxX = 17.8 - fade;
      const range = maxX - minX;
      const progress = (phase + elapsed * speed * 1.65 / range) % 1;
      const scale = Math.min(1, progress * 16, (1 - progress) * 16);
      vehicle.scale.setScalar(Math.max(0.001, scale));
      vehicle.position.set(direction > 0 ? minX + progress * range : maxX - progress * range, 0.034, z);
    }
    for (const { figure, legs, x, z, direction, index, standing } of people) {
      if (standing) continue;
      const cycle = elapsed * 2.0 + index * 1.79;
      const minX = -16.1, span = 32.2;
      const px = ((x - minX + elapsed * 0.48 * direction) % span + span) % span + minX;
      legs[0].rotation.x = Math.sin(cycle) * 0.39;
      legs[1].rotation.x = -Math.sin(cycle) * 0.39;
      figure.position.set(px, 0.153 + (0.5 + 0.5 * Math.sin(cycle * 2.0)) * 0.017, z);
    }
    poolMaterial.opacity = (night ? 0.70 : 0.26) + Math.min(1, Math.max(0, reveal)) * 0.025;
  }

  let night = false;
  function setNight(active) {
    night = Boolean(active);
    yellow.emissiveIntensity = night ? 1.08 : 0.37;
    cream.emissiveIntensity = night ? 1.11 : 0.43;
    cool.emissiveIntensity = night ? 0.57 : 0.24;
    lamps.emissiveIntensity = night ? 0.99 : 0.64;
    headlightReflection.opacity = night ? 0.53 : 0.29;
  }
  update(0, 0);
  return { group: neighborhood, update, setNight };
}

