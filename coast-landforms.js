import * as THREE from './vendor/three.module.js';
import { groundY, riverRadius, riverZ } from './coast-terrain.js';

const { damp, lerp, smoothstep } = THREE.MathUtils;
const oceanY = 0.16;
const poolY = 21.2;
const damX = -258;
const damZ = riverZ(damX);
const westEdge = -235;
const eastEdge = 235;
const ridgeColors = [
  '#8f6c55', '#977452', '#b28662', '#b8a177',
  '#9c7b65', '#d1aa79', '#bea481', '#a8a830',
].map(color => new THREE.Color(color));
const surfaceColors = ['#647b53', '#a0a571', '#415c48', '#978673', '#b3b59a', '#a9aa82'].map(color => new THREE.Color(color));
const pineNeedles = new THREE.ConeGeometry(1, 1, 6);
const block = new THREE.BoxGeometry(1, 1, 1);
const roundColumn = new THREE.CylinderGeometry(0.50, 0.53, 1, 12, 1);
const orb = new THREE.IcosahedronGeometry(1, 0);

function mesh(group, geometry, material) {
  const result = new THREE.Mesh(geometry, material);
  group.add(result);
  return result;
}

function standard(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.87, ...extra });
}

function geometryFrom(positions, triangles, colors, texture) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (triangles) geometry.setIndex(triangles);
  if (colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (texture) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(texture, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function terrainBoundary(source) {
  const positions = source?.geometry?.getAttribute('position');
  const colors = source?.geometry?.getAttribute('color');
  if (!positions || !colors) return [];
  const rows = new Map();
  for (let index = 0; index < positions.count; index++) {
    if (Math.abs(positions.getX(index) - westEdge) > 0.001) continue;
    const z = positions.getZ(index);
    rows.set(z, {
      z, y: positions.getY(index),
      color: new THREE.Color(colors.getX(index), colors.getY(index), colors.getZ(index)),
    });
  }
  return [...rows.values()].sort((a, b) => a.z - b.z);
}

function sampleBoundary(rows, z) {
  if (rows.length === 0) return { z, y: groundY(westEdge, z), color: new THREE.Color('#789467') };
  let left = 0;
  let right = rows.length - 1;
  while (right - left > 1) {
    const center = (left + right) >> 1;
    if (rows[center].z > z) right = center;
    else left = center;
  }
  const before = rows[left];
  const after = rows[right];
  if (z <= before.z || left === right) return before;
  if (z >= after.z) return after;
  const fraction = (z - before.z) / (after.z - before.z);
  return { z, y: lerp(before.y, after.y, fraction), color: before.color.clone().lerp(after.color, fraction) };
}

function poolWidth(x) {
  if (x >= damX) return lerp(12.8, riverRadius(westEdge), smoothstep(x, damX, westEdge));
  const gorge = 11.9 + 11.9 * Math.exp(-Math.pow((x + 299) / 26, 2));
  return lerp(2.2, gorge, smoothstep(x, -334, -318));
}

function streamY(x) {
  if (x <= damX) return poolY;
  return lerp(poolY, oceanY, smoothstep(x, damX, -241));
}

function westHeight(x, z, edgeY = groundY(westEdge, z)) {
  const side = Math.abs(z - riverZ(x));
  const width = poolWidth(x);
  const highWater = streamY(x);
  const wall = smoothstep(side, width - 2.8, width + 11.2);
  const mid = Math.exp(-Math.pow((z + 13) / 51, 2)) * Math.exp(-Math.pow((x + 299) / 36, 2));
  const north = Math.exp(-Math.pow((z + 75) / 32, 2)) * Math.exp(-Math.pow((x + 292) / 35, 2));
  const south = Math.exp(-Math.pow((z - 55) / 29, 2)) * Math.exp(-Math.pow((x + 317) / 33, 2));
  const fine = 3.6 * Math.sin(x * 0.28 + z * 0.14) + 2.7 * Math.sin(z * 0.31 - x * 0.17)
    + 1.7 * Math.cos(x * 0.38 + z * 0.42);
  const head = 8.2 * (1 - smoothstep(x, -336, -329));
  const base = highWater - 5.2 + head + wall * (8.3 + 37 * mid + 36 * north + 35 * south + fine);
  const seam = smoothstep(westEdge - x, 0, 20);
  return lerp(edgeY, base, seam);
}

function paintLand(color, x, z, y) {
  const level = streamY(x);
  const texture = Math.sin(x * 0.14 + z * 0.18) * 0.58 + Math.sin(x * 0.26 - z * 0.28) * 0.36;
  const bank = Math.abs(z - riverZ(x)) - poolWidth(x);
  const rocky = smoothstep(bank, 0, 3) * (1 - smoothstep(bank, 11, 23));
  color.copy(surfaceColors[0]);
  if (texture > 0) color.lerp(surfaceColors[1], 0.56 * texture);
  else color.lerp(surfaceColors[2], -0.61 * texture);
  color.lerp(surfaceColors[3], rocky * 0.77);
  color.lerp(surfaceColors[4], smoothstep(y, 39, 69) * 0.72);
  color.lerp(surfaceColors[5], 0.65 * (1 - smoothstep(y - level, 0, 5.8)));
}

function gorgeGround(group, rows) {
  const west = -336;
  const records = rows.length > 1 ? rows : Array.from({ length: 125 }, (_, i) => sampleBoundary([], lerp(-164, 128, i / 124)));
  const cols = 51;
  const positions = [];
  const colors = [];
  const triangles = [];
  const color = new THREE.Color();
  for (let row = 0; row < records.length; row++) {
    const { z, y: edgeY, color: edgeColor } = records[row];
    for (let col = 0; col <= cols; col++) {
      const x = lerp(west, westEdge, col / cols);
      const y = westHeight(x, z, edgeY);
      positions.push(x, y, z);
      paintLand(color, x, z, y);
      color.lerp(edgeColor, 1 - smoothstep(westEdge - x, 0, 13));
      colors.push(color.r, color.g, color.b);
      if (row + 1 < records.length && col < cols) {
        const a = row * (cols + 1) + col;
        const b = a + cols + 1;
        triangles.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
  }
  mesh(group, geometryFrom(positions, triangles, colors), standard(0xffffff, { vertexColors: true }));

  const sides = [
    [west, records[0].z, westEdge, records[0].z],
    [westEdge, records.at(-1).z, west, records.at(-1).z],
    [west, records.at(-1).z, west, records[0].z],
  ];
  const rimPositions = [];
  const rimColors = [];
  const rimTriangles = [];
  for (const [startX, startZ, endX, endZ] of sides) {
    const parts = Math.ceil(Math.hypot(endX - startX, endZ - startZ) / 3.3);
    const start = rimPositions.length / 3;
    for (let index = 0; index <= parts; index++) {
      const x = lerp(startX, endX, index / parts);
      const z = lerp(startZ, endZ, index / parts);
      const top = westHeight(x, z, sampleBoundary(records, z).y);
      for (let band = 0; band < 5; band++) {
        const y = lerp(-7.02, top, band / 4);
        rimPositions.push(x, y, z);
        color.set(band % 2 === 0 ? '#4f6363' : '#766056');
        color.multiplyScalar(0.80 + band * 0.055 + Math.sin(x * 0.12 + z * 0.16) * 0.043);
        rimColors.push(color.r, color.g, color.b);
        if (index < parts && band < 4) {
          const a = start + index * 5 + band;
          rimTriangles.push(a, a + 5, a + 6, a, a + 6, a + 1);
        }
      }
    }
  }
  mesh(group, geometryFrom(rimPositions, rimTriangles, rimColors), standard(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
}

function waterRibbon(group, start, end, count, centerAt, widthAt, heightAt, paint) {
  const positions = [];
  const triangles = [];
  const texture = [];
  for (let index = 0; index <= count; index++) {
    const t = index / count;
    const x = lerp(start, end, t);
    const z = centerAt(x, t);
    const y = heightAt(x, t);
    positions.push(x, y, z - widthAt(x, t), x, y, z + widthAt(x, t));
    texture.push(t, 0, t, 1);
    if (index < count) {
      const a = index * 2;
      triangles.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  return mesh(group, geometryFrom(positions, triangles, null, texture), paint);
}

function createStreamMaterial(foam) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    cityWaterTime: { value: 0 },
    night: { value: 0 },
    foam: { value: foam ? 1.0 : 0.0 },
    deep: { value: new THREE.Color('#3aa8a7') },
    white: { value: new THREE.Color('#e4f5e8') },
  }]);
  return new THREE.ShaderMaterial({
    uniforms, fog: true, side: THREE.DoubleSide,
    vertexShader: [
      'varying vec2 streamUv;',
      'varying vec2 worldXZ;',
      '#include <fog_pars_vertex>',
      'void main(){',
      'streamUv=uv; worldXZ=(modelMatrix*vec4(position,1.)).xz;',
      'vec4 mvPosition=modelViewMatrix*vec4(position,1.);',
      'gl_Position=projectionMatrix*mvPosition;',
      '#include <fog_vertex>',
      '}',
    ].join('\n'),
    fragmentShader: [
      'varying vec2 streamUv;',
      'varying vec2 worldXZ;',
      'uniform float cityWaterTime,night,foam;',
      'uniform vec3 deep,white;',
      '#include <fog_pars_fragment>',
      'void main(){',
      'float waves=sin(dot(worldXZ,vec2(.81,1.4))+.8*sin(dot(worldXZ,vec2(.19,-.56))-cityWaterTime*.81));',
      'float current=sin(streamUv.x*131.-cityWaterTime*5.2+2.*sin(streamUv.y*9.));',
      'float bordering=exp(-min(streamUv.y,1.-streamUv.y)*15.);',
      'float strips=sin(streamUv.y*62.+cos(streamUv.x*20.-cityWaterTime*.72));',
      'float foamTone=clamp(.62+.21*current+.15*strips,0.,1.);',
      'float light=mix(.13*smoothstep(.40,.93,waves)+.22*bordering,foamTone,foam);',
      'vec3 shade=mix(deep,white,light)*mix(vec3(1.),vec3(.32,.49,.74),night);',
      'gl_FragColor=vec4(shade,1.);',
      '#include <tonemapping_fragment>',
      '#include <colorspace_fragment>',
      '#include <fog_fragment>',
      '}',
    ].join('\n'),
  });
}

function batch(group, shape, material, parts) {
  const result = new THREE.InstancedMesh(shape, material, parts.length);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < parts.length; i++) {
    const [x, y, z, w, h, l, yaw = 0] = parts[i];
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(w, h, l);
    dummy.updateMatrix();
    result.setMatrixAt(i, dummy.matrix);
  }
  result.instanceMatrix.needsUpdate = true;
  result.computeBoundingSphere();
  group.add(result);
  return result;
}

function damAndFlume(group, pool, spill) {
  waterRibbon(group, -336.0, damX + 0.35, 94, x => riverZ(x),
    x => poolWidth(x) - 0.22, () => poolY, pool);
  waterRibbon(group, damX - 0.02, -235.005, 42, x => riverZ(x),
    (x, t) => lerp(5.8, poolWidth(x), smoothstep(t, 0.35, 1)),
    x => streamY(x) + (x > -237.0 ? 0.026 : 0.07), spill);

  const greyDam = standard('#c5b59d');
  const edge = standard('#e0cbb0');
  const steel = standard('#3c6469', { metalness: 0.28 });
  const road = standard('#627278');
  const lighthouseGlow = standard('#ffd896', { emissive: '#fbe2a4', emissiveIntensity: 0.55 });
  const wallParts = [];
  const tops = [];
  const metal = [];
  const lights = [];
  const lanes = [];
  const cliffSteps = 21;
  for (let i = 0; i < cliffSteps; i++) {
    const distance = (i - (cliffSteps - 1) / 2) * 1.82;
    const z = damZ + distance;
    const bend = (distance / 19) ** 2;
    const x = damX + 2.7 * bend;
    const release = Math.abs(distance) < 5.8;
    wallParts.push([x - 0.20, release ? 12.4 : 18.9, z, 4.15, release ? 13.4 : 22.2, 1.94]);
    if (release) {
      tops.push([x, 25.1, z, 4.5, 0.60, 1.92]);
      if (i % 2 === 0) metal.push([x + 1.78, 22.45, z, 0.53, 5.1, 0.38]);
    } else {
      tops.push([x + 0.33, 28.78, z, 5.3, 0.54, 1.93]);
      wallParts.push([x + 2.63, 16.81, z, 1.65, 18.9, 0.51]);
    }
    if (i % 3 === 0) {
      const lampY = release ? 26.28 : 30.0;
      metal.push([x + 1.87, lampY - 0.46, z, 0.13, 1.18, 0.13]);
      lights.push([x + 1.63, lampY + 0.15, z, 0.51, 0.20, 0.32]);
    }
  }
  for (const s of [-1, 1]) {
    wallParts.push([damX - 0.65, 25.1, damZ + s * 7.72, 6.05, 10.8, 4.4]);
    tops.push([damX - 0.65, 30.55, damZ + s * 7.72, 6.62, 0.91, 4.98]);
    metal.push([damX + 2.45, 27.6, damZ + s * 7.72, 0.23, 2.02, 2.71]);
  }

  for (let i = 0; i < 25; i++) {
    const x = -256.9 + i * 0.87;
    const turn = smoothstep(x, -258, -242);
    const z = lerp(damZ - 7.3, 10.2, turn);
    lanes.push([x, 20.10, z, 0.96, 1.33, 7.62]);
    for (const side of [-1, 1]) {
      tops.push([x, 21.55, z + side * 3.54, 0.92, 1.14, 0.40]);
    }
    if (i % 4 === 0 && i < 23) {
      const ground = Math.min(19.8, westHeight(x, z));
      const height = Math.max(1.35, 20.0 - ground);
      wallParts.push([x, 20.0 - height * 0.5, z, 0.83, height, 3.30]);
    }
  }
  waterRibbon(group, -258.2, -235.00, 27,
    x => lerp(damZ - 7.3, 10.2, smoothstep(x, -258, -242)), () => 3.38, () => poolY + 0.018, pool);
  batch(group, block, greyDam, wallParts);
  batch(group, block, edge, tops);
  batch(group, block, steel, metal);
  batch(group, block, road, lanes);
  batch(group, block, lighthouseGlow, lights);
  return lighthouseGlow;
}

function plantSlopes(group, rows) {
  const slopeCanopy = standard('#556f48');
  const sunnyCanopy = standard('#71894e');
  const trunks = [];
  const trees = [[], []];
  for (let i = 0; i < 430; i++) {
    const x = -332 + ((i * 7919 % 3037) / 3037) * 90;
    const z = -121 + ((i * 9049 % 2203) / 2203) * 225;
    const row = sampleBoundary(rows, z);
    const y = westHeight(x, z, row?.y);
    const channel = Math.abs(z - riverZ(x)) - poolWidth(x);
    if (channel < 7.5 || y > 58 || (x > -264 && Math.abs(z - damZ) < 24)) continue;
    const h = 1.9 + (i * 13 % 17) / 10.0;
    const w = h * 0.28;
    trunks.push([x, y + h * 0.19, z, 0.21, h * 0.38, 0.21]);
    trees[i % 2].push([x, y + h * 0.66, z, w, h * 0.93, w, i * 0.37]);
  }
  batch(group, block, standard('#576149'), trunks);
  batch(group, pineNeedles, slopeCanopy, trees[0]);
  batch(group, pineNeedles, sunnyCanopy, trees[1]);
}

function outerOcean(group, original) {
  const paint = original?.material?.isShaderMaterial ? original.material.clone() : standard('#296c88', { roughness: 0.44 });
  const coords = [
    eastEdge, oceanY, -164, eastEdge, oceanY, 128, 336, oceanY, 128,
    eastEdge, oceanY, -164, 336, oceanY, 128, 336, oceanY, -164,
  ];
  mesh(group, geometryFrom(coords), paint);
  const edge = [
    336, oceanY - 0.025, 128, 336, oceanY - 0.025, -164, 336, -7.02, -164,
    336, oceanY - 0.025, 128, 336, -7.02, -164, 336, -7.02, 128,
    eastEdge, oceanY - 0.025, -164, eastEdge, -7.02, -164, 336, -7.02, -164,
    eastEdge, oceanY - 0.025, -164, 336, -7.02, -164, 336, oceanY - 0.025, -164,
    eastEdge, oceanY - 0.025, 128, 336, oceanY - 0.025, 128, 336, -7.02, 128,
    eastEdge, oceanY - 0.025, 128, 336, -7.02, 128, eastEdge, -7.02, 128,
  ];
  mesh(group, geometryFrom(edge), standard('#35556a', { side: THREE.DoubleSide }));
  return paint.uniforms;
}

function island(group, profile) {
  const { x, z, rx, rz, height, seed } = profile;
  const positions = [];
  const colors = [];
  const triangles = [];
  const base = [];
  const layers = [0.0, 0.12, 0.26, 0.42, 0.57, 0.72, 0.91, 1.0];
  const count = profile.points ?? 46;
  const color = new THREE.Color();
  for (let band = 0; band < layers.length; band++) {
    const elevation = layers[band];
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2;
      const jitter = 1 + Math.sin(angle * 3 + seed) * 0.139 + Math.sin(angle * 7 + seed * 0.73) * 0.062
        + Math.sin(angle * 13 + seed * 1.13) * 0.023;
      const tier = [1.00, 1.03, 0.93, 0.98, 0.88, 0.92, 0.82, 0.76][band];
      const tx = x + Math.cos(angle) * rx * tier * jitter + elevation * rx * 0.11;
      const tz = z + Math.sin(angle) * rz * tier * jitter - elevation * rz * 0.05;
      const y = 0.015 + elevation * (height + Math.sin(angle + seed * 0.56) * 3.7 + Math.sin(angle * 6 + seed) * 0.95);
      positions.push(tx, y, tz);
      color.copy(ridgeColors[band]).multiplyScalar(0.91 + Math.sin(angle * 17 + seed * 2) * 0.072 + Math.cos(angle * 8 - elevation * 5) * 0.052);
      if (band === layers.length - 1) color.lerp(new THREE.Color('#788749'), 0.68);
      colors.push(color.r, color.g, color.b);
      if (band === 0) base.push(new THREE.Vector3(tx, 0.22, tz));
      if (band < layers.length - 1) {
        const a = band * count + i;
        const b = band * count + (i + 1) % count;
        triangles.push(a, a + count, b + count, a, b + count, b);
      }
    }
  }
  const center = positions.length / 3;
  const firstTop = center - count;
  positions.push(x + rx * 0.06, height + 1.42, z - rz * 0.06);
  color.set('#729151');
  colors.push(color.r, color.g, color.b);
  for (let i = 0; i < count; i++) triangles.push(center, firstTop + (i + 1) % count, firstTop + i);
  mesh(group, geometryFrom(positions, triangles, colors), standard(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
  return base;
}

function seaArch(group) {
  const arch = new THREE.CatmullRomCurve3([
    [262, -0.05, 32], [264.5, 10.8, 32.1], [267.2, 17.2, 32],
    [274.9, 22.4, 31.2], [283.8, 21, 29.9], [290.0, 16.8, 28.8],
    [293.9, 9.7, 28.1], [295.3, -0.05, 27.5],
  ].map(value => new THREE.Vector3(...value)));
  const segments = 38;
  const facets = 11;
  const basis = arch.computeFrenetFrames(segments, false);
  const positions = [];
  const colors = [];
  const triangles = [];
  const color = new THREE.Color();
  for (let index = 0; index <= segments; index++) {
    const t = index / segments;
    const center = arch.getPointAt(t);
    const edge = 1 - Math.sin(Math.PI * t);
    for (let facet = 0; facet < facets; facet++) {
      const angle = facet / facets * Math.PI * 2;
      const radius = 2.55 + 3.12 * edge + 0.52 * Math.sin(t * 38 + angle * 12);
      const vertex = center.clone().addScaledVector(basis.normals[index], Math.cos(angle) * radius)
        .addScaledVector(basis.binormals[index], Math.sin(angle) * radius * 0.94);
      positions.push(vertex.x, vertex.y, vertex.z);
      color.copy(ridgeColors[Math.abs(Math.floor(vertex.y * 0.74 + 8)) % 7]);
      color.multiplyScalar(0.87 + Math.sin(angle * 5 + t * 13) * 0.11);
      colors.push(color.r, color.g, color.b);
      if (index < segments) {
        const a = index * facets + facet;
        const b = index * facets + (facet + 1) % facets;
        triangles.push(a, b, a + facets, b, b + facets, a + facets);
      }
    }
  }
  mesh(group, geometryFrom(positions, triangles, colors), standard(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
}

function coastalLights(group) {
  const foot = [292, 44.79, -45.6];
  const shell = standard('#f3dfb8');
  const stripe = standard('#b76548');
  const hardware = standard('#435f64');
  const lamp = standard('#f9d67f', { emissive: '#ffc568', emissiveIntensity: 0.6 });
  const blocks = [];
  const posts = [];
  for (let i = 0; i < 10; i++) {
    const angle = i / 10 * Math.PI * 2;
    posts.push([foot[0] + Math.sin(angle) * 1.83, foot[1] + 12.2, foot[2] + Math.cos(angle) * 1.83, 0.09, 0.81, 0.09]);
    blocks.push([foot[0] + Math.sin(angle) * 1.88, foot[1] + 12.65, foot[2] + Math.cos(angle) * 1.88, 0.10, 0.10, 1.12, angle + 1.57]);
  }
  batch(group, roundColumn, shell, [
    [foot[0], foot[1] + 2.39, foot[2], 3.75, 5.1, 3.75],
    [foot[0], foot[1] + 7.14, foot[2], 3.4, 2.5, 3.4],
    [foot[0], foot[1] + 10.44, foot[2], 2.85, 1.33, 2.85],
    [foot[0], foot[1] + 11.38, foot[2], 4.1, 0.36, 4.1],
  ]);
  batch(group, roundColumn, stripe, [
    [foot[0], foot[1] + 5.5, foot[2], 3.48, 1.62, 3.48],
    [foot[0], foot[1] + 9.0, foot[2], 3.0, 1.37, 3],
    [foot[0], foot[1] + 14.1, foot[2], 3.24, 0.6, 3.24],
  ]);
  batch(group, roundColumn, lamp, [[foot[0], foot[1] + 12.78, foot[2], 2.39, 2.29, 2.39]]);
  batch(group, block, hardware, [...posts, ...blocks, [foot[0] + 0.03, foot[1] + 15.03, foot[2], 0.11, 1.24, 0.11]]);
  return lamp;
}

function waveRings(group, outlineSets) {
  const wavesMaterial = new THREE.LineBasicMaterial({ color: '#a9eddf', transparent: true, opacity: 0.64, depthWrite: false });
  const points = [];
  for (const base of outlineSets) {
    const center = base.reduce((result, point) => result.add(point), new THREE.Vector3()).multiplyScalar(1 / base.length);
    for (let k = 1; k <= 2; k++) {
      for (let i = 0; i < base.length; i++) {
        if ((i + k) % 7 > 4) continue;
        const from = base[i].clone().sub(center).multiplyScalar(1 + k * 0.058).add(center);
        const to = base[(i + 1) % base.length].clone().sub(center).multiplyScalar(1 + k * 0.058).add(center);
        points.push(from.x, oceanY + k * 0.075, from.z, to.x, oceanY + k * 0.075, to.z);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  group.add(new THREE.LineSegments(geometry, wavesMaterial));
  return wavesMaterial;
}

export function createCoastLandforms(scene) {
  // On the shared edge, retain the exact vertices and the existing sea shader.
  const expansion = scene.getObjectByName('Continuous metropolitan approaches and outer bay');
  const edge = terrainBoundary(expansion?.children[0]);
  const outerWater = expansion?.children.find(child => child.material?.uniforms?.shallows);
  const group = new THREE.Group();
  group.name = 'Gorge reservoir and cliff coast';
  scene.add(group);
  gorgeGround(group, edge);
  const pools = createStreamMaterial(false);
  const cascades = createStreamMaterial(true);
  const damLights = damAndFlume(group, pools, cascades);
  plantSlopes(group, edge);
  const oceanUniforms = outerOcean(group, outerWater);
  const outlines = [
    { x: 290, z: -46, rx: 26.7, rz: 35, height: 43.4, seed: 0.2 },
    { x: 266, z: -89, rx: 15.3, rz: 24, height: 32.8, seed: 0.9 },
    { x: 321, z: -69, rx: 6.6, rz: 11.1, height: 28, seed: 1.7, points: 21 },
    { x: 264, z: -0.2, rx: 8.0, rz: 12.3, height: 26, seed: 3.6, points: 24 },
    { x: 317, z: 14.3, rx: 8.9, rz: 11.9, height: 35, seed: 1.2, points: 23 },
    { x: 312, z: 37.4, rx: 5.6, rz: 8.5, height: 22, seed: 0.4, points: 20 },
    { x: 258.5, z: 47.4, rx: 4.5, rz: 8.4, height: 17.3, seed: 2.2, points: 19 },
  ].map(profile => island(group, profile));
  seaArch(group);
  const beacon = coastalLights(group);
  const foamLine = waveRings(group, outlines);
  const spray = new THREE.InstancedMesh(orb, new THREE.MeshBasicMaterial({
    color: '#dcfff0', transparent: true, opacity: 0.64, depthWrite: false,
  }), 45);
  spray.frustumCulled = false;
  group.add(spray);
  const sprayDummy = new THREE.Object3D();
  let nightTarget = 0;
  let night = 0;

  function update(dt, elapsed) {
    night = damp(night, nightTarget, 3.8, dt);
    for (const water of [pools.uniforms, cascades.uniforms]) {
      water.cityWaterTime.value = elapsed;
      water.night.value = night;
    }
    if (oceanUniforms?.flowTime && oceanUniforms?.night) {
      oceanUniforms.flowTime.value = elapsed;
      oceanUniforms.night.value = night;
    }
    damLights.emissiveIntensity = lerp(0.52, 1.97, night);
    beacon.emissiveIntensity = lerp(0.52, 2.8 + Math.sin(elapsed * 1.7) * 0.66, night);
    foamLine.opacity = (0.58 + Math.sin(elapsed * 1.28) * 0.075) * lerp(1, 0.58, night);
    for (let i = 0; i < spray.count; i++) {
      const phase = (i * 0.136 + elapsed * 0.61) % 1;
      const x = -248.6 + phase * 15.15;
      const y = streamY(x) + Math.sin(Math.PI * phase) * (0.60 + (i % 5) * 0.62);
      const z = riverZ(x) + ((i * 157 % 89) / 89 - 0.5) * (5.7 + phase * 5.7);
      const size = (0.19 + (i % 7) * 0.043) * Math.sin(Math.PI * phase);
      sprayDummy.position.set(x, y, z);
      sprayDummy.scale.setScalar(Math.max(0.008, size));
      sprayDummy.updateMatrix();
      spray.setMatrixAt(i, sprayDummy.matrix);
    }
    spray.instanceMatrix.needsUpdate = true;
  }

  update(0, 0);
  return {
    update,
    setNight(on) { nightTarget = Number(Boolean(on)); },
    landmarks: {
      reservoir: new THREE.Vector3(-279, 25.2, 16.0),
      cliffs: new THREE.Vector3(289, 29.5, 12.0),
    },
  };
}
