import * as THREE from './vendor/three.module.js';

const { clamp, damp, lerp, smoothstep } = THREE.MathUtils;
const highWater = 21.2;
const lowWater = 0.19;
const lockOrigin = new THREE.Vector3(-203, 0, 10.2);
const flatsOrigin = new THREE.Vector3(219, 0, 102);
const box = new THREE.BoxGeometry();
const post = new THREE.CylinderGeometry(0.5, 0.5, 1, 7);
const reed = new THREE.ConeGeometry(0.5, 1, 4);
const fin = new THREE.CylinderGeometry(0.43, 0.59, 1, 3);
const placement = new THREE.Object3D();

function paint(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...options });
}

function piece(parent, material, x, y, z, w, h, d, shape = box) {
  const mesh = new THREE.Mesh(shape, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  parent.add(mesh);
  return mesh;
}

function staticParts(parent) {
  const batches = new Map();
  return {
    place(material, x, y, z, w, h, d, yaw = 0, shape = box) {
      let byShape = batches.get(material);
      if (!byShape) batches.set(material, byShape = new Map());
      let transforms = byShape.get(shape);
      if (!transforms) byShape.set(shape, transforms = []);
      placement.position.set(x, y, z);
      placement.rotation.set(0, yaw, 0);
      placement.scale.set(w, h, d);
      placement.updateMatrix();
      transforms.push(placement.matrix.clone());
    },
    finish() {
      for (const [material, byShape] of batches) {
        for (const [shape, transforms] of byShape) {
          const instanced = new THREE.InstancedMesh(shape, material, transforms.length);
          transforms.forEach((transform, index) => instanced.setMatrixAt(index, transform));
          parent.add(instanced);
        }
      }
    },
  };
}

function watermark(parent, levels, centerX, yFrom, z, material) {
  const parts = staticParts(parent);
  for (const height of levels) {
    parts.place(material, centerX, height, z, height % 5 === 0 ? 0.87 : 0.39, 0.11, 0.055);
  }
  parts.place(material, centerX - 0.43, yFrom + 10.9, z, 0.065, 21.8, 0.055);
  parts.finish();
}

function makeGate(parent, x, height, steel, accent, rails) {
  const leaves = [-1, 1].map(side => {
    const leaf = new THREE.Group();
    leaf.position.set(x, 0, side * 4.75);
    parent.add(leaf);
    const parts = staticParts(leaf);
    parts.place(steel, 0, height / 2, -side * 2.42, 0.58, height, 4.84);
    for (const y of [1, 5, 9, 13, 17, 21]) {
      parts.place(rails, -0.31, y, -side * 2.45, 0.18, 0.19, 4.88);
    }
    parts.place(accent, 0, height + 0.10, -side * 2.42, 0.67, 0.2, 4.84);
    parts.place(rails, -0.32, height / 2, -side * 4.7, 0.17, height, 0.2);
    parts.finish();
    return { leaf, side };
  });
  return (opened, direction) => {
    for (const { leaf, side } of leaves) {
      leaf.rotation.y = side * (direction * opened * 1.48 - 0.05);
    }
  };
}

function makeBoat(parent) {
  const boat = new THREE.Group();
  boat.name = 'Lock chamber vessel';
  parent.add(boat);
  const parts = staticParts(boat);
  const hull = paint(0xb8513b, { roughness: 0.48 });
  const hullDark = paint(0x613e35);
  const white = paint(0xffe2b0);
  const blueGlass = paint(0x4a8994, { roughness: 0.24, metalness: 0.25 });
  parts.place(hullDark, 0.23, 0.21, 0, 5.36, 0.64, 2.11);
  parts.place(hull, -0.14, 0.58, 0, 5.9, 0.68, 2.23);
  parts.place(hull, -3.21, 0.47, 0, 1.76, 0.79, 2.3, -Math.PI / 2, fin);
  parts.place(white, -0.18, 0.97, 0, 5.99, 0.18, 2.07);
  parts.place(white, 1.86, 1.51, 0, 1.5, 1.04, 1.66);
  parts.place(blueGlass, 1.06, 1.61, 0, 0.1, 0.46, 1.45);
  for (const side of [-1, 1]) {
    parts.place(blueGlass, 1.85, 1.62, side * 0.85, 1.32, 0.44, 0.055);
    parts.place(white, -0.9, 1.23, side * 0.99, 3.58, 0.17, 0.06);
    for (const x of [-2.3, -1.4, -0.5, 0.42]) parts.place(white, x, 1.19, side * 0.99, 0.09, 0.42, 0.08);
  }
  for (const [x, z] of [[-1.5, -0.36], [-0.36, 0.39], [0.51, -0.32]]) {
    parts.place(hull, x, 1.31, z, 0.25, 0.54, 0.25, 0, post);
    parts.place(white, x, 1.68, z, 0.23, 0.24, 0.23, 0, post);
  }
  parts.place(white, 2.25, 2.34, 0, 0.11, 0.83, 0.11, 0, post);
  parts.place(hull, 2.45, 2.59, 0, 0.44, 0.23, 0.07);
  parts.finish();
  return boat;
}

function createLock(parent) {
  const group = new THREE.Group();
  group.position.copy(lockOrigin);
  group.name = 'Elevated navigation lock';
  parent.add(group);
  const concrete = paint(0xcbbba1);
  const tops = paint(0xe2d1a8);
  const framing = paint(0x52666a);
  const darkSteel = paint(0x304f56, { metalness: 0.35, roughness: 0.65 });
  const amber = paint(0xeeb86b, { emissive: 0xe69c49, emissiveIntensity: 0.37 });
  const white = paint(0xe6e6ca, { emissive: 0x86b3bc, emissiveIntensity: 0.4 });
  const glass = new THREE.MeshBasicMaterial({
    color: 0x7cc9cd, opacity: 0.14, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const water = paint(0x489eae, { roughness: 0.31, opacity: 0.83, transparent: true, depthWrite: false });
  const wake = new THREE.MeshBasicMaterial({ color: 0xd0f1ed, transparent: true, opacity: 0.54, depthWrite: false });
  const masonry = staticParts(group);
  const chambers = [
    { x: 0, length: 36, width: 9.45 },
    { x: -25, length: 14, width: 7.4 },
    { x: 24.2, length: 12.4, width: 10.2 },
  ];
  masonry.place(concrete, 0, -0.78, 0, 36.7, 1.5, 11.3);
  masonry.place(concrete, 0, 10.4, -5.32, 36.8, 22.1, 1.22);
  masonry.place(tops, 0, 21.63, -5.31, 36.9, 0.41, 1.52);
  masonry.place(tops, 0, 21.48, 5.36, 36.9, 0.38, 1.58);
  masonry.place(concrete, 0, 0.22, 5.31, 36.8, 0.53, 1.27);
  for (const y of [4.6, 9.5, 14.35, 19.1]) {
    masonry.place(framing, 0, y, -4.69, 36.1, 0.15, 0.1);
    masonry.place(framing, 0, y, 5.85, 36.4, 0.16, 0.115);
  }
  for (const x of [-17.85, -12, -6, 0, 6, 12, 17.85]) {
    masonry.place(framing, x, 10.67, 5.72, 0.25, 21.6, 0.4);
    if (Math.abs(x) === 17.85) {
      for (const side of [-1, 1]) {
        masonry.place(concrete, x, 11.54, side * 5.46, 1.6, 24.9, 2.27);
        masonry.place(tops, x, 24.18, side * 5.46, 1.98, 0.48, 2.61);
        masonry.place(amber, x, 24.54, side * 5.46, 0.48, 0.27, 0.48, 0, post);
      }
      masonry.place(framing, x, 23.74, 0, 0.62, 0.29, 11.96);
    }
  }
  for (const side of [-1, 1]) {
    masonry.place(concrete, -25, 20.06, side * 4.05, 14.4, 3.36, 0.69);
    masonry.place(tops, -25, 21.98, side * 4.08, 14.4, 0.32, 0.85);
    for (const x of [-30.8, -26.7, -22.3]) {
      masonry.place(concrete, x, 9.45, side * 3.49, 1.1, 20.25, 1.3);
    }
    masonry.place(concrete, 23.6, 0.6, side * 5.34, 12.2, 1.09, 0.81, side * -0.13);
    masonry.place(tops, 0, 22.31, side * 5.9, 34.5, 0.105, 0.09);
    for (let x = -16; x <= 16; x += 2) {
      masonry.place(framing, x, 22.02, side * 5.9, 0.09, 0.76, 0.09);
      if ((x + 16) % 4 === 0) masonry.place(white, x, 21.7, side * 5.13, 0.42, 0.13, 0.17);
    }
  }
  masonry.place(concrete, -24.9, 19.19, 0, 14.4, 0.84, 8.38);
  masonry.place(tops, 10.25, 22.73, -6.83, 4.77, 2.1, 3.37);
  masonry.place(framing, 10.25, 23.89, -6.83, 4.98, 0.24, 3.63);
  masonry.place(white, 10.25, 22.92, -5.11, 2.92, 0.5, 0.065);
  masonry.finish();

  const nearPanel = piece(group, glass, 0, 10.79, 5.45, 36.2, 21.48, 0.12);
  nearPanel.name = 'Transparent teaching section of lock wall';
  watermark(group, Array.from({ length: 21 }, (_, index) => index + 1), 3.55, 0, 5.93, white);
  const gauge = piece(group, amber, 3.94, lowWater, 5.98, 1.23, 0.18, 0.2);

  const pools = chambers.map(({ x, length, width }) => {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(length, width), water);
    plane.position.set(x, x < 0 ? highWater : lowWater, 0);
    plane.rotation.x = -Math.PI / 2;
    group.add(plane);
    return plane;
  });
  pools[0].name = 'Variable lock chamber water';

  const upstream = makeGate(group, -17.82, 22.2, darkSteel, amber, framing);
  const downstream = makeGate(group, 17.88, 22.2, darkSteel, amber, framing);
  const boat = makeBoat(group);
  const ripples = new THREE.InstancedMesh(box, wake, 36);
  ripples.frustumCulled = false;
  group.add(ripples);

  function animate(progress, elapsed) {
    const upstreamOpen = smoothstep(progress, 0.735, 0.885);
    const downstreamOpen = 1 - smoothstep(progress, 0.22, 0.345);
    const level = lerp(lowWater, highWater, smoothstep(progress, 0.345, 0.735));
    const enter = smoothstep(progress, 0.0, 0.216);
    const exit = smoothstep(progress, 0.88, 1);
    const position = lerp(28.5, 0, enter) - exit * 28;
    downstream(downstreamOpen, 1);
    upstream(upstreamOpen, -1);
    pools[0].position.y = level;
    gauge.position.y = level;
    boat.position.set(position, (progress <= 0.22 ? lowWater : level) + Math.sin(elapsed * 1.8) * 0.045, 0);
    boat.rotation.y = Math.sin(elapsed * 0.95) * 0.014;
    for (let index = 0; index < ripples.count; index++) {
      const cycle = (index * 0.618 + 0.36 * elapsed) % 1;
      const x = (index < 18 ? -14.8 : 11.1) + cycle * (index < 18 ? 7.1 : -8.2);
      const z = Math.sin(index * 2.39) * 3.7;
      const size = 0.35 + 0.56 * Math.sin(cycle * Math.PI);
      const fill = progress > 0.345 && progress < 0.735;
      placement.position.set(x, level + 0.035, z);
      placement.rotation.set(0, 0.08 * Math.sin(index), 0);
      placement.scale.set(size * (fill ? 1.7 : 1), 0.019, 0.065);
      placement.updateMatrix();
      ripples.setMatrixAt(index, placement.matrix);
    }
    ripples.instanceMatrix.needsUpdate = true;
  }
  animate(0, 0);

  return { animate, lamps: amber };
}

function bedHeight(x, z) {
  const envelope = smoothstep(1 - Math.hypot(x / 38, z / 23), 0, 0.54);
  const ridges = [
    [2.8 + 1.45 * Math.sin(x * 0.088), 3.5, 1.35],
    [10.8 + 1.65 * Math.sin(x * 0.09 + 1.6), 3.0, 1.57],
    [-7.0 + 2.3 * Math.sin(x * 0.095 - 0.55), 4.7, 2.04],
    [-14 + 2.25 * Math.sin(x * 0.094 + 1.35), 4.0, 2.65],
  ];
  const ridge = Math.max(...ridges.map(([center, extent, height]) => (
    Math.exp(-(((z - center) / extent) ** 2)) * height
  )));
  const channel = 0.86 * Math.exp(-(((z - 1.9 * Math.sin(x * 0.11 - 0.5)) / 1.38) ** 2));
  const bar = 0.64 * Math.exp(-(((x + 13) / 16) ** 2 + ((z + 11) / 6.1) ** 2));
  return -0.31 + envelope * (0.81 + ridge + bar - channel + 0.13 * Math.sin(x * 0.74 + z * 0.91));
}

function makeFlatsSurface(group) {
  const rows = 42;
  const columns = 72;
  const positions = [];
  const colors = [];
  const indices = [];
  const color = new THREE.Color();
  const wet = new THREE.Color(0xa5835b);
  const sand = new THREE.Color(0xd7b579);
  const rush = new THREE.Color(0x8e9a51);
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= columns; col++) {
      const x = lerp(-39, 39, col / columns);
      const z = lerp(-24, 24, row / rows);
      const elevation = bedHeight(x, z);
      positions.push(x, elevation, z);
      color.copy(wet).lerp(sand, smoothstep(elevation, 0.2, 1.5));
      color.lerp(rush, smoothstep(elevation, 1.69, 3.01) * 0.87);
      color.multiplyScalar(0.9 + 0.1 * Math.cos(x * 0.48 + z * 0.77) * Math.sin(z * 1.5));
      colors.push(color.r, color.g, color.b);
      if (row < rows && col < columns) {
        const a = row * (columns + 1) + col;
        const b = a + columns + 1;
        indices.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, paint(0xffffff, { vertexColors: true, roughness: 1 }));
  mesh.name = 'Exposed intertidal sediment';
  group.add(mesh);
}

function makeLocalTide(group) {
  const positions = [0, 0, 0];
  const shades = [];
  const indices = [];
  const blue = new THREE.Color(0x438ca2);
  shades.push(blue.r, blue.g, blue.b, 0.82);
  const rays = 56;
  for (const [radius, alpha] of [[0.67, 0.76], [0.86, 0.62], [1.08, 0]]) {
    for (let index = 0; index < rays; index++) {
      const angle = index / rays * 2 * Math.PI;
      const wobble = 1 + 0.033 * Math.cos(5 * angle) + 0.041 * Math.sin(3 * angle);
      positions.push(38.4 * radius * Math.cos(angle) * wobble, 0, 23.4 * radius * Math.sin(angle) * wobble);
      shades.push(blue.r, blue.g, blue.b, alpha);
    }
  }
  for (let index = 0; index < rays; index++) {
    const next = (index + 1) % rays;
    indices.push(0, next + 1, index + 1);
    for (let ring = 0; ring <= 1; ring++) {
      const start = ring * rays + 1;
      const outer = start + rays;
      indices.push(start + index, outer + next, outer + index, start + index, start + next, outer + next);
    }
  }
  const base = new THREE.BufferGeometry();
  base.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  base.setAttribute('color', new THREE.Float32BufferAttribute(shades, 4));
  base.setIndex(indices);
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true, opacity: 1, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const surface = new THREE.Mesh(base, material);
  surface.name = 'Variable tidal water surface';
  surface.renderOrder = 5;
  group.add(surface);
  return surface;
}

function createFlats(parent) {
  const group = new THREE.Group();
  group.position.copy(flatsOrigin);
  group.name = 'Shoal channels and birding boardwalk';
  parent.add(group);
  makeFlatsSurface(group);
  const surface = makeLocalTide(group);
  const boards = paint(0x5d5850);
  const rails = paint(0xd5c99f);
  const reeds = [0x839452, 0xb6b568, 0x5f814f].map(color => paint(color));
  const red = paint(0xd47c56, { emissive: 0xbf6434, emissiveIntensity: 0.23 });
  const details = staticParts(group);
  for (let index = 0; index < 290; index++) {
    const x = 32.2 * Math.sin(index * 2.39996);
    const z = -6.4 + 13.1 * Math.cos(index * 1.6976);
    const y = bedHeight(x, z);
    if (y <= 1.31) continue;
    const h = 0.72 + 0.87 * ((index * 53 % 100) / 100);
    for (let strand = 0; strand <= 2; strand++) {
      const leafX = x + 0.31 * Math.cos(index + strand * 4);
      const leafZ = z + 0.31 * Math.sin(index + strand * 4);
      details.place(reeds[strand], leafX, y + h * 0.48, leafZ,
        0.24 + strand * 0.07, h * (1 - strand * 0.16), 0.24, index * 0.32, reed);
    }
  }

  for (let index = 0; index <= 39; index++) {
    const x = -29.5 + 0.85 * index;
    const z = -14.4 + 2.05 * Math.sin(0.11 * index) + 0.184 * index;
    const slope = (2.05 * Math.cos(0.11 * index) * 0.11 + 0.184) / 0.85;
    const yaw = -Math.atan(slope);
    details.place(rails, x, 3.73, z, 0.82, 0.18, 1.95, yaw);
    if (index % 4 === 0) {
      for (const side of [-1, 1]) {
        details.place(boards, x, 1.74, z + side * 0.81, 0.18, 4.33, 0.18, 0, post);
        details.place(rails, x + 1.18, 4.29, z + side * 0.94, 3.55, 0.085, 0.07, yaw);
      }
    }
  }
  const deckZ = -9.05;
  details.place(boards, 5.25, 3.72, deckZ, 6.62, 0.25, 5.2);
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      const x = 5.25 + 2.78 * side;
      const z = deckZ + 2.1 * end;
      details.place(boards, x, 2.8, z, 0.26, 5.87, 0.26, 0, post);
    }
  }
  details.place(rails, 5.25, 5.8, deckZ, 6.9, 0.17, 5.38);
  details.place(red, 6.62, 4.63, deckZ - 0.61, 3.69, 1.65, 0.16);
  details.place(boards, 4.99, 4.91, deckZ + 1.66, 2.18, 0.28, 0.14);
  for (const [x, z] of [[18,-11.8], [24,5.5], [-19,11.6]]) {
    details.place(rails, x, 1.88, z, 0.22, 4.59, 0.22, 0, post);
    details.place(red, x, 4.21, z, 0.48, 0.33, 0.48, 0, post);
    for (let y = 0.75; y <= 3.65; y += 0.51) details.place(boards, x, y, z + 0.13, 0.41, 0.053, 0.038);
  }
  details.finish();

  const birdGeometry = new THREE.BufferGeometry();
  birdGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.76, 0, 0.15, 0, 0.22, 0, 0.74, 0, 0.16,
    0, 0.22, 0, 0, 0.02, -0.4, 0.74, 0, 0.16,
    0, 0.02, -0.4, 0, 0.22, 0, -0.76, 0, 0.15,
  ], 3));
  birdGeometry.computeVertexNormals();
  const birdMaterial = paint(0xe9e7ce, { side: THREE.DoubleSide });
  const birds = new THREE.InstancedMesh(birdGeometry, birdMaterial, 14);
  birds.name = 'Flock above the marsh';
  birds.frustumCulled = false;
  group.add(birds);

  const feedingSites = Array.from({ length: 24 }, (_, index) => {
    const x = Math.sin(index * 3.97) * 25;
    const z = Math.cos(index * 1.76) * 12.6 + 2.3;
    return [x, z, bedHeight(x, z)];
  }).filter(([, , y]) => y > 0.32 && y < 1.68);
  const bodyShape = new THREE.SphereGeometry(0.5, 6, 4);
  const feeders = new THREE.InstancedMesh(bodyShape, birdMaterial, feedingSites.length);
  const feet = new THREE.InstancedMesh(post, paint(0x4b3d32), feedingSites.length * 2);
  const heads = new THREE.InstancedMesh(reed, paint(0xce9b65), feedingSites.length);
  for (const mesh of [feeders, feet, heads]) {
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  const fishGeometry = new THREE.BufferGeometry();
  fishGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.58, 0, 0.01, 0.15, 0, 0.27, 0.62, 0, 0.01,
    -0.58, 0, 0.01, 0.62, 0, 0.01, 0.15, 0, -0.26,
    -0.43, 0, 0.03, -0.92, 0, -0.19, -0.92, 0, 0.20,
  ], 3));
  const fish = new THREE.InstancedMesh(fishGeometry, new THREE.MeshBasicMaterial({
    color: 0x225764, depthWrite: false, transparent: true, opacity: 0.64, side: THREE.DoubleSide,
  }), 16);
  fish.renderOrder = 6;
  fish.frustumCulled = false;
  group.add(fish);

  function animate(tide, elapsed) {
    const waterY = lerp(0.175, 3.09, tide);
    surface.position.y = waterY;
    surface.visible = tide > 0.012;
    for (let index = 0; index < birds.count; index++) {
      const orbit = elapsed * 0.31 + index * 0.27;
      const radius = 12.0 + (index % 4) * 1.39;
      placement.position.set(6 + radius * Math.cos(orbit), 4.95 + waterY * 0.31 + Math.sin(orbit * 1.35) * 0.49,
        1.7 + radius * 0.55 * Math.sin(orbit));
      placement.rotation.set(-0.13, -orbit + 0.1, 0.24 * Math.sin(elapsed * 6.9 + index));
      placement.scale.set(0.74, 1.12 + 0.18 * Math.sin(elapsed * 8.2 - index), 0.88);
      placement.updateMatrix();
      birds.setMatrixAt(index, placement.matrix);
    }
    birds.instanceMatrix.needsUpdate = true;
    for (const [index, [x, z, y]] of feedingSites.entries()) {
      const visibility = clamp((y - waterY) * 7, 0.001, 1);
      const angle = Math.sin(index * 2.17) * Math.PI;
      const peck = Math.sin(elapsed * 4.5 + index) * 0.13;
      placement.position.set(x, y + 0.57, z);
      placement.rotation.set(0, angle, peck * 0.22);
      placement.scale.set(visibility * 0.77, visibility * 0.51, visibility * 0.44);
      placement.updateMatrix();
      feeders.setMatrixAt(index, placement.matrix);
      placement.position.set(x + 0.34 * Math.cos(angle), y + 0.62 + peck, z - 0.34 * Math.sin(angle));
      placement.rotation.set(0, angle, -1.1 + peck * 2);
      placement.scale.set(visibility * 0.24, visibility * 0.45, visibility * 0.22);
      placement.updateMatrix();
      heads.setMatrixAt(index, placement.matrix);
      for (const side of [-1, 1]) {
        placement.position.set(x + side * 0.095 * Math.sin(angle), y + 0.20, z + side * 0.095 * Math.cos(angle));
        placement.rotation.set(0, 0, Math.cos(index) * 0.06);
        placement.scale.set(visibility * 0.046, visibility * 0.42, visibility * 0.046);
        placement.updateMatrix();
        feet.setMatrixAt(index * 2 + (side === -1 ? 0 : 1), placement.matrix);
      }
    }
    for (const mesh of [feeders, feet, heads]) mesh.instanceMatrix.needsUpdate = true;
    fish.visible = tide > 0.40;
    if (fish.visible) {
      for (let index = 0; index < fish.count; index++) {
        const progress = (elapsed * 0.14 + index * 0.097) % 1;
        const x = 20.7 - 41.4 * progress;
        const z = 5 + index % 4 * 0.9 + Math.sin(progress * 9 + index * 0.67) * 1.7;
        const size = smoothstep(waterY - bedHeight(x, z), 0.15, 0.55);
        placement.position.set(x, waterY - 0.10, z);
        placement.rotation.set(0, Math.PI + Math.sin(progress * 9 + index * 0.67) * 0.45, 0);
        placement.scale.setScalar(Math.max(size * 0.74, 0.001));
        placement.updateMatrix();
        fish.setMatrixAt(index, placement.matrix);
      }
      fish.instanceMatrix.needsUpdate = true;
    }
  }
  animate(0.04, 0);
  return { animate, lamps: red };
}

export function createCoastWaterworks(scene) {
  const lock = createLock(scene);
  const flats = createFlats(scene);
  const landmarks = {
    lock: lockOrigin.clone().add(new THREE.Vector3(0, 15.3, 0)),
    tide: flatsOrigin.clone().add(new THREE.Vector3(0, 3.7, 0)),
  };
  let lockTarget = 0.04;
  let lockValue = lockTarget;
  let tideTarget = 0.04;
  let tideValue = tideTarget;
  return {
    landmarks,
    setStudy(id, raw) {
      const value = clamp(Number(raw) || 0, 0, 1);
      if (id === 'lock') lockTarget = value;
      if (id === 'tide') tideTarget = value;
    },
    setNight(on) {
      lock.lamps.emissiveIntensity = on ? 2 : 0.37;
      flats.lamps.emissiveIntensity = on ? 1.81 : 0.23;
    },
    update(dt, elapsed) {
      lockValue = damp(lockValue, lockTarget, 3.0, dt);
      tideValue = damp(tideValue, tideTarget, 2.2, dt);
      lock.animate(lockValue, elapsed);
      flats.animate(tideValue, elapsed);
    },
  };
}
