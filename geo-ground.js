import * as THREE from './vendor/three.module.js';
import { GEO, geoSites } from './geo-data.js';

const { clamp, lerp, smoothstep } = THREE.MathUtils;
const topY = -0.6;
const frontZ = GEO.front;
const backZ = frontZ - 33;
const leftX = geoSites[0].min;
const rightX = geoSites.at(-1).max;
const bottomY = -GEO.limit * GEO.exaggeration;
const minimumDepth = -topY / GEO.exaggeration;
const span = rightX - leftX;

const textures = {
  topsoil: [0.22, 0.08, 0.40],
  fill: [0.18, 0.20, 0.76],
  cobble: [0.08, 0.14, 1.0],
  gravel: [0.09, 0.12, 0.93],
  mud: [0.22, 0.29, 0.16],
  silt: [0.23, 0.27, 0.15],
  sand: [0.26, 0.22, 0.30],
  weathered: [0.15, 0.12, 0.86],
  granite: [0.15, 0.04, 0.76],
  bedrock: [0.19, 0.10, 0.57],
  reef: [0.16, 0.34, 0.16],
};
const segments = geoSites.map(site => ({
  ...site,
  layers: site.layers.map(layer => ({
    ...layer,
    rgb: [
      Number.parseInt(layer.color.slice(1, 3), 16),
      Number.parseInt(layer.color.slice(3, 5), 16),
      Number.parseInt(layer.color.slice(5, 7), 16),
    ],
  })),
}));

function noise(ix, iy) {
  let bits = Math.imul(374761393, ix) ^ Math.imul(668265263, iy);
  bits = Math.imul(bits ^ (bits >>> 13), 1274126177);
  return ((bits ^ (bits >>> 16)) >>> 0) / 4294967295;
}

function textureNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const u = x - ix, v = y - iy;
  return lerp(lerp(noise(ix, iy), noise(ix + 1, iy), u),
    lerp(noise(ix, iy + 1), noise(ix + 1, iy + 1), u), v);
}

function geologicWater(x) {
  if (x <= segments[0].x) return segments[0].water;
  for (let i = 1; i < segments.length; i++) {
    const a = segments[i - 1], b = segments[i];
    if (x <= b.x) {
      const wave = Math.sin((x - a.x) / (b.x - a.x) * Math.PI);
      const variation = 0.44 * wave * Math.sin(x * 0.070);
      return lerp(a.water, b.water, smoothstep(x, a.x, b.x)) + variation;
    }
  }
  return segments.at(-1).water;
}

function bandDepths(site, x) {
  const d = x - site.x;
  return site.layers.map(({ bottom }, index) => {
    if (bottom === GEO.limit) return bottom;
    const strength = Math.min(bottom * 0.21, 4.6);
    return bottom + strength * (Math.sin(d * 0.079 + 0.21 * index * d) * 0.26
      + Math.sin(d * 0.038) * 0.57 + Math.sin(d * 0.15) * 0.17);
  });
}

function transition(x, range = 13) {
  for (let i = 0; i < segments.length - 1; i++) {
    const boundary = segments[i].max;
    if (x < boundary - range) return [segments[i], null, 0];
    if (x <= boundary + range) return [segments[i], segments[i + 1], smoothstep(x, boundary - range, boundary + range)];
  }
  return [segments.at(-1), null, 0];
}

function chooseLayer(site, limits, depth) {
  for (let i = 0; i < limits.length - 1; i++) if (depth < limits[i]) return i;
  return site.layers.length - 1;
}

function drawRock(map, index, x, z, site, limits, alternative, alternativeLimits, weight, water) {
  const layerIndex = chooseLayer(site, limits, z);
  const layer = site.layers[layerIndex];
  const altIndex = alternative ? chooseLayer(alternative, alternativeLimits, z) : 0;
  const alternate = alternative ? alternative.layers[altIndex] : layer;
  const traits = textures[layer.key];
  const secondary = textures[alternate.key];

  const bulk = textureNoise(x * 0.15, z * 0.28);
  const largeBody = textureNoise(x * 0.048 + 98, z * 0.082 - 9);
  const grain = noise(Math.round(x * 71), Math.round(z * 73));
  const damp = smoothstep(z, water - 0.1, water + 5);
  const boundary = layerIndex ? smoothstep(Math.abs(z - limits[layerIndex - 1]), 0.08, 1.1) : 1;

  const sediment = Math.sin(z * 14.9 + Math.sin(x * 0.09) * 2.4 + Math.sin(x * 0.035 - z * 0.070) * 1.28);
  const folds = Math.sin(z * 1.72 + largeBody * 7.8 + Math.sin(x * 0.046) * 2.64);
  const line = smoothstep(sediment * 0.63 + folds * 0.37, 0.40, 0.99);
  const strata = (line - 0.25) * lerp(traits[1], secondary[1], weight);

  const rockGrain = lerp(traits[0], secondary[0], weight);
  let value = 0.89 + (grain - 0.41) * rockGrain + (bulk - 0.39) * 0.31
    + (largeBody - 0.42) * 0.20 + strata - (1 - boundary) * 0.15;
  const porous = lerp(traits[2], secondary[2], weight);
  if (porous > 0.28) {
    const row = z * 2.84 + Math.sin(x * 0.13) * 0.23;
    const column = x * 2.56 + (Math.floor(row) % 2) * 0.46;
    const xi = Math.floor(column), yi = Math.floor(row);
    const k = noise(xi, yi);
    const cx = column - xi - lerp(0.28, 0.72, noise(xi + 7, yi - 5));
    const cy = row - yi - 0.48;
    const chip = (cx * cx + cy * cy * 1.65) < 0.019 + k * 0.16;
    if (chip && k > 1 - porous * 0.68) value += (k > 0.84 ? 0.25 : -0.18) + cy * -0.09;
  }

  if (layer.key === 'granite' || layer.key === 'bedrock' || layer.key === 'reef' || layer.key === 'weathered') {
    const f1 = Math.abs(Math.sin(x * 0.335 + z * 0.66 + textureNoise(x * 0.062, z * 0.076) * 3.0));
    const f2 = Math.abs(Math.sin(x * 0.23 - z * 0.82 + largeBody * 3.6));
    const veins = (1 - smoothstep(f1, 0.025, 0.12)) * (textureNoise(x * 0.075, z * 0.112) > 0.43 ? 0.21 : -0.14);
    const cracks = (1 - smoothstep(f2, 0.018, 0.065)) * (bulk < 0.60 ? -0.14 : 0.045);
    value += veins + cracks;
  }
  const r = lerp(layer.rgb[0], alternate.rgb[0], weight);
  const g = lerp(layer.rgb[1], alternate.rgb[1], weight);
  const b = lerp(layer.rgb[2], alternate.rgb[2], weight);
  map[index] = r * value * (1 - damp * 0.122);
  map[index + 1] = g * value * (1 - damp * 0.050) + damp * 3;
  map[index + 2] = b * value + damp * 8;
  map[index + 3] = 255;
}

function rockMap() {
  if (typeof document === 'undefined') return null;
  const wide = (globalThis.innerWidth || 1200) > 730;
  const width = wide ? 2410 : 1820, height = wide ? 403 : 312;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof ctx.createImageData !== 'function') return null;
  const image = ctx.createImageData(width, height);
  for (let col = 0; col < width; col++) {
    const x = lerp(leftX, rightX, col / (width - 1));
    const [base, alt, weight] = transition(x);
    const limits = bandDepths(base, x);
    const shifted = alt ? bandDepths(alt, x) : null;
    const water = geologicWater(x);
    for (let row = 0; row < height; row++) {
      const depth = lerp(minimumDepth, GEO.limit, row / (height - 1));
      drawRock(image.data, (row * width + col) * 4, x, depth, base, limits, alt, shifted, weight, water);
    }
  }
  ctx.putImageData(image, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 6;
  return tex;
}

function outlineFace(positions, indices, uvs, colors) {
  const columns = 201, rows = 43;
  const dark = new THREE.Color(), nearby = new THREE.Color();
  for (let row = 0; row <= rows; row++) {
    const v = row / rows, y = lerp(topY, bottomY, v);
    for (let col = 0; col <= columns; col++) {
      const u = col / columns, x = lerp(leftX, rightX, u);
      const seam = Math.sin(v * 7.5 + x * 0.067) * Math.sin(x * 0.127 - v * 13.1);
      const flake = textureNoise(col * 0.52, row * 0.63);
      const amplitude = Math.sin(v * Math.PI) * Math.sin(u * Math.PI) * 0.58;
      const face = frontZ - (0.22 + flake * 0.65 + seam * 0.25) * amplitude;

      positions.push(x, y, face);
      uvs.push(u, 1 - v);
      const [band, alternative, weight] = transition(x);
      const d = -y / GEO.exaggeration;
      dark.set(band.layers[chooseLayer(band, bandDepths(band, x), d)].color);
      if (alternative) dark.lerp(nearby.set(alternative.layers[chooseLayer(alternative, bandDepths(alternative, x), d)].color), weight);
      colors.push(dark.r, dark.g, dark.b);
      if (col > 0 && row > 0) {
        const a = row * (columns + 1) + col;
        const b = a - 1;
        const c = b - (columns + 1);
        const e = a - (columns + 1);
        indices.push(c, b, a, c, a, e);
      }
    }
  }
}

function makeGeometry(positions, indices, uvs, colors) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (indices) geo.setIndex(indices);
  if (uvs) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (colors) geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (indices) geo.computeVertexNormals();
  return geo;
}

function earthFace(canvasTexture, clipping) {
  const positions = [], indices = [], uvs = [], colors = [];
  outlineFace(positions, indices, uvs, colors);
  const material = new THREE.MeshStandardMaterial({
    color: canvasTexture ? 0xffe1b9 : 0xfff0db,
    map: canvasTexture, vertexColors: !canvasTexture,
    emissive: 0xb7a58f, emissiveMap: canvasTexture,
    emissiveIntensity: 0.061, roughness: 0.98, clippingPlanes: [clipping],
  });
  const mesh = new THREE.Mesh(makeGeometry(positions, indices, uvs, colors), material);
  mesh.name = 'Geo transect · exposed earth face';
  return mesh;
}

function wrapEnds(canvasTexture, clipping) {
  const pos = [], index = [], uv = [], colors = [];
  const stone = new THREE.Color();
  for (const side of [-1, 1]) {
    const x = side < 0 ? leftX : rightX;
    const site = side < 0 ? segments[0] : segments.at(-1);
    const start = pos.length / 3;
    const count = 44;
    const levels = bandDepths(site, x);
    for (let row = 0; row <= count; row++) {
      const v = row / count, y = lerp(topY, bottomY, v);
      pos.push(x, y, frontZ, x, y, backZ);
      uv.push(side < 0 ? 0.001 : 0.999, 1 - v, side < 0 ? 0.046 : 0.954, 1 - v);
      stone.set(site.layers[chooseLayer(site, levels, -y / GEO.exaggeration)].color).multiplyScalar(0.70);
      colors.push(stone.r, stone.g, stone.b, stone.r, stone.g, stone.b);
      if (row) {
        const j = start + row * 2;
        index.push(j - 2, j + 1, j, j - 2, j - 1, j + 1);
      }
    }
  }
  const material = new THREE.MeshStandardMaterial({
    color: canvasTexture ? 0xbfa58d : 0xeee0ce, map: canvasTexture, vertexColors: !canvasTexture,
    side: THREE.DoubleSide, roughness: 1, clippingPlanes: [clipping],
  });
  return new THREE.Mesh(makeGeometry(pos, index, uv, colors), material);
}

function levelCap(y, floor) {
  const positions = [], indices = [], colors = [];
  const wet = new THREE.Color(), warm = new THREE.Color();
  const groundPaint = [0x748058, 0x86935d, 0x888977, 0x7b8d86, 0x758d8d, 0x98765c];
  const columns = 150;
  for (let col = 0; col <= columns; col++) {
    const x = lerp(leftX, rightX, col / columns);
    const [site, other, blend] = transition(x);
    const paint = groundPaint[segments.indexOf(site)];
    wet.set(floor ? 0x304143 : paint);
    if (other && !floor) wet.lerp(warm.set(groundPaint[segments.indexOf(other)]), blend);
    const shade = 0.88 + 0.15 * textureNoise(col * 0.41, floor ? 32 : 6);
    const front = wet.clone().multiplyScalar(shade);
    const back = wet.clone().multiplyScalar(shade * (floor ? 0.66 : 0.80));
    positions.push(x, y, backZ, x, y, frontZ);
    colors.push(back.r, back.g, back.b, front.r, front.g, front.b);
    if (col) {
      const b = col * 2;
      indices.push(b - 2, b - 1, b + 1, b - 2, b + 1, b);
    }
  }
  return new THREE.Mesh(makeGeometry(positions, indices, null, colors),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, side: THREE.DoubleSide }));
}

function line(points, color, opacity, clipping = []) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color, opacity, transparent: true, clippingPlanes: clipping, depthWrite: false, toneMapped: false,
  }));
}

function waterTrace(clipping) {
  const points = [], bubbles = [];
  const steps = 240;
  for (let i = 0; i < steps; i++) {
    const a = lerp(leftX + 1, rightX - 1, i / steps);
    const b = lerp(leftX + 1, rightX - 1, (i + 0.88) / steps);
    points.push(a, -geologicWater(a) * GEO.exaggeration, frontZ + 0.026,
      b, -geologicWater(b) * GEO.exaggeration, frontZ + 0.026);
    if (i % 5 === 1) {
      const spread = noise(14, i) * 3.8 + 0.6;
      bubbles.push(a, -(geologicWater(a) + spread) * GEO.exaggeration, frontZ + 0.018,
        a + spread * 0.49, -(geologicWater(a + spread * 0.49) + spread) * GEO.exaggeration, frontZ + 0.018);
    }
  }
  return [line(points, 0x9ee6e3, 0.78, [clipping]), line(bubbles, 0x77a9a8, 0.39, [clipping])];
}

export function createGeoGround(scene) {
  const shelf = new THREE.Group();
  shelf.name = 'Geo transect · 62 m below the coast';
  scene.add(shelf);
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const texture = rockMap();
  const surface = levelCap(topY + 0.020, false);
  const floor = levelCap(0, true);
  const groundwater = waterTrace(clip);
  const surfaceTrim = line([leftX, topY + 0.039, frontZ, rightX, topY + 0.039, frontZ], 0xf0c99b, 0.65);
  const depthTrim = line([leftX, 0, frontZ, rightX, 0, frontZ], 0xadd6d7, 0.51);
  shelf.add(earthFace(texture, clip), wrapEnds(texture, clip), surface, floor, ...groundwater, surfaceTrim, depthTrim);

  let visible = false;
  let depth = GEO.limit;
  function applyDepth() {
    shelf.visible = visible && depth > minimumDepth;
    const y = -depth * GEO.exaggeration;
    clip.constant = -y;
    floor.position.y = y;
    depthTrim.position.y = y + 0.025;
  }
  applyDepth();
  return {
    setVisible(next) {
      visible = Boolean(next);
      applyDepth();
    },
    setDepth(meters) {
      depth = clamp(Number(meters) || 0, 0, GEO.limit);
      applyDepth();
    },
    update(_dt, elapsed) {
      if (!shelf.visible) return;
      groundwater[0].material.opacity = 0.68 + Math.sin(elapsed * 0.94) * 0.079;
    },
  };
}
