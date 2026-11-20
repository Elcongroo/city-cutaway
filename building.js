import * as THREE from './vendor/three.module.js';

const { clamp, lerp, smoothstep } = THREE.MathUtils;
const footprint = { width: 12, length: 8.6 };
const shaft = { x: 0.3, width: 2.1, length: 1.85 };

export function createBuilding(scene) {
  const building = new THREE.Group();
  building.name = 'Mixed-use building';
  scene.add(building);

  const matte = (color, roughness = 0.78) => new THREE.MeshStandardMaterial({ color, roughness });
  const glow = (color, intensity = 0.25) => new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: intensity, roughness: 0.55,
  });
  const palette = {
    footing: matte(0x666d70), concrete: matte(0xb9aa90), trim: matte(0xe5d2a7), shadow: matte(0x29434a),
    teal: matte(0x446663), mint: matte(0x86aba1), plaster: matte(0xd3c7ab),
    glass: matte(0x203b45, 0.25), window: glow(0xffce85, 0.37), paleWindow: glow(0x99ced1, 0.12),
    timber: matte(0xab7549), cream: matte(0xe4d6b0), porcelain: matte(0xe9e2d6),
    brass: matte(0xbb8c54, 0.42), fern: matte(0x567f58), moss: matte(0x708957), leaf: matte(0x9bb56b),
    brick: matte(0x9f6856), terracotta: matte(0xc98660), cafe: matte(0xa35748),
    rust: matte(0xe59458), amber: glow(0xf8ac63, 0.18), dark: matte(0x172b32),
    road: matte(0x454c4b), tanSoil: matte(0x706250), soil: matte(0x4c4039), slate: matte(0x303a42),
    coolPipe: matte(0x498b94, 0.46), solar: matte(0x263f63, 0.35),
    bedding: [matte(0x739d8d), matte(0xb67462), matte(0x7687a9)],
    rug: [matte(0xc68e63), matte(0x93b7b1), matte(0xd5ad6a)],
  };
  const highlights = {
    roof: glow(0x9cbd83, 0.1),
    homes: glow(0x73aeb0, 0.1),
    core: glow(0xf7ab66, 0.24),
    shops: glow(0xf6b582, 0.13),
    foundation: glow(0x68c9d1, 0.12),
  };
  const highlightMaterials = Object.entries(highlights).map(([id, material]) => ({
    id, material, base: material.emissiveIntensity,
  }));

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const roundGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const plantGeometry = new THREE.IcosahedronGeometry(0.5, 0);
  const batches = new Map();
  const matrix = new THREE.Object3D();

  function part(parent, material, x, y, z, width, height, length, shape = geometry, yaw = 0) {
    if (!batches.has(parent)) batches.set(parent, new Map());
    const meshes = batches.get(parent);
    if (!meshes.has(material)) meshes.set(material, new Map());
    const shapes = meshes.get(material);
    if (!shapes.has(shape)) shapes.set(shape, []);
    shapes.get(shape).push({ x, y, z, width, height, length, yaw });
  }

  const panel = (parent, material, x, y, z, w, h, l, yaw = 0) => {
    part(parent, material, x, y, z, w, h, l, geometry, yaw);
  };
  const round = (parent, material, x, y, z, w, h, l = w) => {
    part(parent, material, x, y, z, w, h, l, roundGeometry);
  };

  function group(parent, x = 0, y = 0, z = 0) {
    const child = new THREE.Group();
    child.position.set(x, y, z);
    parent.add(child);
    return child;
  }

  function plant(parent, x, y, z, size = 1) {
    round(parent, palette.brick, x, y + 0.15 * size, z, 0.48 * size, 0.30 * size);
    round(parent, palette.soil, x, y + 0.31 * size, z, 0.42 * size, 0.03 * size);
    part(parent, palette.fern, x, y + 0.59 * size, z, 0.65 * size, 0.65 * size, 0.60 * size, plantGeometry);
    part(parent, palette.leaf, x + 0.12 * size, y + 0.70 * size, z, 0.49 * size, 0.49 * size, 0.47 * size, plantGeometry);
  }

  function slab(parent, surface, accent) {
    const { width, length } = footprint;
    const openingLeft = shaft.x - shaft.width / 2;
    const openingRight = shaft.x + shaft.width / 2;
    panel(parent, surface, (openingLeft - width / 2) / 2, 0, 0, openingLeft + width / 2, 0.25, length);
    panel(parent, surface, (openingRight + width / 2) / 2, 0, 0, width / 2 - openingRight, 0.25, length);
    for (const side of [-1, 1]) {
      panel(parent, surface, shaft.x, 0, side * (length + shaft.length) / 4, shaft.width, 0.25, (length - shaft.length) / 2);
    }
    panel(parent, accent, 0, -0.025, length / 2 + 0.035, width + 0.10, 0.075, 0.08);
    panel(parent, accent, width / 2 + 0.035, -0.025, 0, 0.08, 0.075, length + 0.10);
    for (const side of [-1, 1]) {
      panel(parent, palette.shadow, shaft.x + side * shaft.width / 2, 0.14, 0, 0.10, 0.025, shaft.length + 0.12);
      panel(parent, palette.shadow, shaft.x, 0.14, side * shaft.length / 2, shaft.width + 0.12, 0.025, 0.10);
    }
  }

  function guardRail(parent, x, y, z, width, length) {
    for (const side of [-1, 1]) {
      const edge = x + side * width / 2;
      panel(parent, palette.brass, edge, y + 0.53, z, 0.045, 0.048, length);
      panel(parent, palette.brass, edge, y + 0.30, z, 0.036, 0.035, length);
      for (const post of [-0.48, 0, 0.48]) {
        panel(parent, palette.brass, edge, y + 0.24, z + post * length, 0.043, 0.5, 0.043);
      }
    }
  }

  const foundation = group(building);
  const foundationShell = group(foundation);
  const foundationInside = group(foundation);
  panel(foundation, palette.slate, 0, -2.45, 0, 14.4, 0.30, 9.8);
  panel(foundationShell, palette.soil, 0, -1.52, 0, 14.22, 1.63, 9.62);
  panel(foundationShell, palette.tanSoil, 0, -0.75, 0, 14.28, 0.26, 9.70);
  panel(foundationShell, palette.concrete, 0, -0.426, 0, 14.4, 0.41, 9.8);
  panel(foundationShell, palette.road, 0, -0.207, 0, 14.32, 0.04, 9.70);
  for (let i = -7; i <= 7; i++) {
    panel(foundationShell, palette.concrete, i * 0.95, -0.183, 4.57, 0.91, 0.055, 0.50);
  }
  panel(foundationInside, palette.soil, 0, -2.06, -2.6, 13.91, 0.50, 4.05);
  panel(foundationInside, palette.footing, 0, -1.96, 0, 10.73, 0.25, 6.82);
  panel(foundationInside, palette.trim, 0, -1.81, 0, 10.54, 0.07, 6.62);
  for (const x of [-4.55, 4.55]) {
    for (const z of [-2.45, 2.45]) {
      panel(foundationInside, palette.concrete, x, -1.72, z, 1.50, 0.44, 1.43);
      panel(foundationInside, palette.footing, x, -1.05, z, 0.48, 1.4, 0.48);
      panel(foundationInside, palette.brass, x, -0.40, z + 0.30, 0.53, 0.10, 0.068);
    }
  }
  const utility = group(foundationInside, 0, -1.32, 3.73);
  utility.rotation.z = -Math.PI / 2;
  round(utility, palette.coolPipe, 0, 0, 0, 0.42, 12.1);
  for (const y of [-5.7, -2.7, 0.45, 3.25, 5.7]) {
    round(utility, highlights.foundation, 0, y, 0, 0.51, 0.12);
  }
  panel(foundationInside, palette.coolPipe, 4.75, -0.84, 3.72, 0.30, 0.85, 0.31);
  panel(foundationInside, highlights.foundation, 4.75, -0.39, 3.72, 0.45, 0.087, 0.44);
  panel(foundationInside, palette.brass, 0, -1.63, 4.20, 12.1, 0.115, 0.11);
  for (let i = -6; i <= 6; i++) {
    panel(foundation, palette.footing, i * 1.08, -2.43, 4.91, 0.13, 0.11, 0.06, -0.25);
  }

  function facade(parent, pitch, shopFloor, index) {
    const front = group(parent, 0, 0.13, footprint.length / 2);
    const side = group(parent, footprint.width / 2, 0.13, 0);
    const external = shopFloor ? palette.brick : palette.teal;
    panel(front, external, 0, (pitch - 0.27) / 2, 0, footprint.width, pitch - 0.27, 0.21);
    panel(side, external, 0, (pitch - 0.27) / 2, 0, 0.21, pitch - 0.27, footprint.length);
    const cols = shopFloor ? 3 : 6;
    const interval = footprint.width / cols;
    for (let i = 0; i < cols; i++) {
      const x = (i - (cols - 1) / 2) * interval;
      const pane = shopFloor ? palette.paleWindow : [palette.window, palette.paleWindow, palette.glass][(i + index) % 3];
      const opening = interval * (shopFloor ? 0.86 : 0.72);
      const wy = shopFloor ? 1.28 : 1.34;
      const h = shopFloor ? 1.87 : 1.42;
      panel(front, palette.shadow, x, wy, 0.115, opening + 0.12, h + 0.16, 0.08);
      panel(front, pane, x, wy, 0.167, opening, h, 0.045);
      panel(front, palette.dark, x, wy, 0.197, 0.055, h, 0.035);
      panel(front, palette.mint, x, wy + h * 0.24, 0.195, opening, 0.043, 0.028);
      panel(front, palette.trim, x, wy - h / 2 - 0.05, 0.205, opening + 0.16, 0.085, 0.17);
    }
    for (let i = 0; i < 4; i++) {
      const z = (i - 1.5) * 2.03;
      panel(side, palette.shadow, 0.121, 1.32, z, 0.075, 1.51, 1.53);
      panel(side, i % 2 ? palette.window : palette.paleWindow, 0.17, 1.32, z, 0.032, 1.37, 1.39);
      panel(side, palette.dark, 0.194, 1.32, z, 0.025, 1.37, 0.050);
      panel(side, palette.trim, 0.199, 0.57, z, 0.145, 0.09, 1.60);
    }
    for (const direction of [-1, 1]) {
      panel(front, palette.mint, direction * 5.95, (pitch - 0.27) / 2, 0.13, 0.10, pitch - 0.27, 0.13);
      panel(side, palette.mint, 0.13, (pitch - 0.27) / 2, direction * 4.23, 0.13, pitch - 0.27, 0.10);
    }
    panel(front, palette.trim, 0, pitch - 0.29, 0.14, 12.05, 0.12, 0.15);
    panel(side, palette.trim, 0.14, pitch - 0.29, 0, 0.15, 0.12, 8.6);
    if (shopFloor) {
      const canopy = group(front, -2.8, 2.18, 0.46);
      canopy.rotation.x = -0.17;
      for (let i = 0; i < 8; i++) {
        panel(canopy, i % 2 ? palette.cream : palette.cafe, (i - 3.5) * 0.61, 0, 0.09, 0.61, 0.096, 0.91);
      }
      panel(front, palette.brass, 3.04, 2.55, 0.18, 4.05, 0.32, 0.12);
      for (let i = 0; i < 5; i++) {
        panel(front, palette.window, 2.15 + i * 0.44, 2.55, 0.251, 0.27, 0.085, 0.023);
      }
    }
    return { front, side };
  }

  function shelf(parent, x, z, width, tint) {
    for (const side of [-1, 1]) {
      panel(parent, palette.timber, x + side * width / 2, 0.79, z, 0.075, 1.25, 0.56);
    }
    for (let level = 0; level < 3; level++) {
      const y = 0.35 + level * 0.46;
      panel(parent, palette.timber, x, y, z, width, 0.07, 0.58);
      for (let item = 0; item < 4; item++) {
        panel(parent, (item + level) % 3 === 0 ? tint : palette.cream,
          x + (item - 1.5) * width / 4, y + 0.15, z, width * 0.11, 0.23 + (item % 2) * 0.07, 0.25);
      }
    }
  }

  function table(parent, x, z, chairs = true) {
    round(parent, palette.timber, x, 0.67, z, 0.89, 0.10);
    round(parent, palette.brass, x, 0.40, z, 0.08, 0.51);
    if (!chairs) return;
    for (const side of [-1, 1]) {
      panel(parent, palette.cream, x + side * 0.70, 0.43, z, 0.39, 0.09, 0.42);
      panel(parent, palette.timber, x + side * 0.70, 0.27, z, 0.20, 0.28, 0.27);
      panel(parent, palette.timber, x + side * 0.85, 0.61, z, 0.07, 0.30, 0.41);
    }
  }

  function accessibleCore(parent, pitch) {
    const stairX = 1.95;
    for (let n = 0; n < 10; n++) {
      const y = 0.17 + n * (pitch - 0.43) / 10;
      panel(parent, palette.footing, stairX, y, 1.10 - n * 0.34, 0.94, 0.15, 0.37);
      panel(parent, highlights.core, stairX, y + 0.08, 1.27 - n * 0.34, 0.94, 0.024, 0.050);
    }
    panel(parent, palette.concrete, stairX, pitch - 0.28, -2.32, 1.02, 0.14, 0.69);
    panel(parent, palette.shadow, shaft.x, 1.24, -0.91, 1.75, 2.20, 0.08);
    for (const side of [-1, 1]) {
      panel(parent, palette.brass, shaft.x + side * 0.77, 1.26, -0.85, 0.065, 2.22, 0.11);
      panel(parent, palette.shadow, shaft.x + side * 0.33, 1.15, -0.81, 0.62, 1.85, 0.05);
    }
    panel(parent, highlights.core, shaft.x, 2.30, -0.84, 1.55, 0.072, 0.063);
    panel(parent, palette.brass, shaft.x, 0.11, -0.76, 1.81, 0.05, 0.15);
    guardRail(parent, shaft.x, 0.10, 0, shaft.width, shaft.length);
  }

  function envelope(level, parent, pitch, interior) {
    panel(level, palette.teal, 0, pitch / 2, -4.27, 12, pitch - 0.14, 0.19);
    panel(level, palette.teal, -5.96, pitch / 2, 0, 0.19, pitch - 0.14, 8.47);
    panel(parent, interior, 0, pitch / 2, -4.14, 11.69, pitch - 0.17, 0.072);
    panel(parent, interior, -5.84, pitch / 2, 0, 0.072, pitch - 0.17, 8.38);
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 2.2;
      const window = i % 2 ? palette.window : palette.paleWindow;
      panel(level, palette.shadow, x, 1.61, -4.378, 1.48, 1.36, 0.055);
      panel(level, window, x, 1.61, -4.413, 1.34, 1.25, 0.033);
      panel(level, palette.shadow, -6.072, 1.61, (i - 2) * 1.62, 0.055, 1.36, 1.21);
      panel(level, window, -6.109, 1.61, (i - 2) * 1.62, 0.033, 1.25, 1.10);
      panel(parent, palette.shadow, x, 1.61, -4.079, 1.32, 1.03, 0.045);
      panel(parent, window, x, 1.61, -4.046, 1.23, 0.93, 0.03);
      panel(parent, palette.mint, x, 1.61, -4.017, 0.054, 0.93, 0.025);
    }
  }

  const levels = [];
  function makeLevel(closedY, openY, pitch, category, index) {
    const level = group(building);
    const interior = group(level);
    const shopFloor = category === 'shops';
    slab(level, shopFloor ? palette.concrete : palette.trim, highlights[category]);
    envelope(level, interior, pitch, shopFloor ? palette.cream : palette.plaster);
    accessibleCore(interior, pitch);
    const exterior = facade(level, pitch, shopFloor, index);
    levels.push({ level, interior, exterior, closedY, openY });
    return interior;
  }

  const shops = makeLevel(0, 0, 3.1, 'shops', 0);
  panel(shops, palette.terracotta, -3.4, 0.132, 0, 4.8, 0.022, 7.78);
  panel(shops, palette.mint, 3.9, 0.134, 0.67, 3.59, 0.028, 6.48);
  panel(shops, palette.cafe, -4.12, 0.54, -2.1, 2.75, 0.81, 0.88);
  panel(shops, palette.timber, -4.12, 0.96, -2.1, 2.93, 0.12, 0.98);
  panel(shops, palette.dark, -3.47, 1.14, -2.05, 0.47, 0.25, 0.39);
  panel(shops, palette.brass, -3.47, 1.278, -2.16, 0.38, 0.075, 0.06);
  shelf(shops, -4.20, -3.74, 2.44, palette.cafe);
  shelf(shops, 3.28, -3.72, 2.46, palette.mint);
  shelf(shops, 5.20, -1.40, 1.23, palette.rust);
  for (const z of [0.13, 2.26]) table(shops, -3.86, z);
  for (const z of [0.56, 2.72]) {
    panel(shops, palette.timber, 4.03, 0.40, z, 1.49, 0.57, 0.86);
    panel(shops, palette.trim, 4.03, 0.72, z, 1.60, 0.13, 0.97);
    for (let i = 0; i < 5; i++) {
      const fill = [palette.moss, palette.rust, palette.cafe][i % 3];
      round(shops, fill, 3.52 + i * 0.25, 0.82, z, 0.19, 0.13);
      round(shops, fill, 3.57 + i * 0.25, 0.82, z + 0.25, 0.19, 0.13);
    }
  }
  for (const x of [-5.3, 5.38]) plant(shops, x, 0.15, 3.47, 1.25);

  for (let floor = 0; floor < 3; floor++) {
    const home = makeLevel(3.10 + floor * 2.77, 4.37 + floor * 4.27, 2.77, 'homes', floor);
    const rug = palette.rug[floor];
    const bedColor = palette.bedding[floor];
    panel(home, palette.timber, -3.45, 0.132, 0, 4.64, 0.024, 8.12);
    panel(home, palette.cream, 3.91, 0.132, 0.15, 3.64, 0.025, 7.76);
    panel(home, palette.plaster, 1.45, 0.87, -3.47, 0.11, 1.52, 1.42);
    panel(home, palette.plaster, 3.47, 0.91, -1.32, 3.72, 1.52, 0.13);
    panel(home, palette.brass, 1.56, 1.70, -2.64, 0.12, 0.15, 0.48);

    panel(home, rug, -3.46, 0.155, 1.42, 3.64, 0.036, 2.72);
    for (const z of [0.28, 2.55]) panel(home, palette.cream, -3.47, 0.18, z, 3.37, 0.013, 0.055);
    panel(home, bedColor, -4.89, 0.43, 1.46, 0.92, 0.53, 2.56);
    panel(home, bedColor, -5.29, 0.72, 1.46, 0.21, 0.66, 2.58);
    for (const z of [0.48, 2.44]) panel(home, palette.cream, -4.91, 0.73, z, 0.87, 0.22, 0.22);
    panel(home, palette.cream, -4.88, 0.80, 0.87, 0.34, 0.29, 0.46, 0.13);
    panel(home, palette.cream, -4.87, 0.80, 2.03, 0.33, 0.27, 0.39, -0.17);
    table(home, -3.80, 1.45, false);
    round(home, palette.porcelain, -3.67, 0.76, 1.39, 0.175, 0.09);
    panel(home, palette.timber, -1.77, 0.27, 1.88, 0.64, 0.28, 1.65);
    panel(home, palette.dark, -1.77, 0.60, 1.88, 0.09, 0.47, 1.29);

    panel(home, palette.timber, -3.57, 0.55, -3.64, 3.68, 0.80, 0.72);
    panel(home, palette.porcelain, -3.57, 0.97, -3.64, 3.78, 0.09, 0.78);
    panel(home, palette.shadow, -2.51, 1.020, -3.62, 0.62, 0.028, 0.49);
    panel(home, palette.coolPipe, -2.51, 1.043, -3.62, 0.43, 0.027, 0.32);
    round(home, palette.brass, -2.51, 1.17, -3.88, 0.058, 0.23);
    table(home, -3.68, -1.74);

    panel(home, palette.timber, 4.00, 0.31, 2.08, 2.54, 0.37, 2.60);
    panel(home, palette.porcelain, 4.00, 0.53, 2.08, 2.42, 0.22, 2.47);
    panel(home, bedColor, 4.00, 0.677, 2.38, 2.43, 0.17, 1.83);
    panel(home, palette.timber, 4.00, 0.67, 0.83, 2.57, 0.61, 0.13);
    for (const x of [3.48, 4.54]) panel(home, palette.cream, x, 0.67, 1.26, 0.79, 0.17, 0.59, 0.04);
    for (const x of [2.41, 5.58]) panel(home, palette.timber, x, 0.39, 1.40, 0.52, 0.50, 0.58);
    panel(home, palette.porcelain, 4.86, 0.36, -2.65, 0.88, 0.43, 1.84);
    panel(home, palette.mint, 4.86, 0.585, -2.65, 0.65, 0.03, 1.56);
    round(home, palette.porcelain, 3.15, 0.37, -3.11, 0.53, 0.46);
    panel(home, palette.porcelain, 2.71, 0.62, -3.56, 0.69, 0.47, 0.36);
    plant(home, -5.39, 0.14, 3.54, 1.25);
    plant(home, 5.41, 0.14, -0.16);
  }

  const roof = group(building);
  panel(roof, palette.teal, 0, 0, 0, 12.32, 0.28, 8.86);
  panel(roof, palette.trim, 0, 0.125, 0, 12.49, 0.15, 9.03);
  panel(roof, palette.footing, 0, 0.225, 0, 12.13, 0.09, 8.66);
  for (const side of [-1, 1]) {
    panel(roof, highlights.roof, 0, 0.38, side * 4.31, 12.16, 0.32, 0.14);
    panel(roof, highlights.roof, side * 6.02, 0.38, 0, 0.15, 0.32, 8.67);
  }
  panel(roof, palette.plaster, 0.2, 0.89, -0.43, 2.85, 1.37, 2.75);
  panel(roof, palette.shadow, 0.2, 1.59, -0.43, 3.04, 0.18, 2.92);
  panel(roof, palette.teal, 0.36, 0.80, 0.966, 1.02, 1.21, 0.07);
  panel(roof, highlights.core, 0.36, 1.43, 0.991, 1.07, 0.06, 0.06);
  panel(roof, palette.brass, 0.66, 0.75, 1.007, 0.095, 0.04, 0.037);
  for (const x of [2.80, 4.65]) {
    panel(roof, palette.concrete, x, 0.44, -2.65, 1.41, 0.43, 1.14);
    panel(roof, palette.dark, x, 0.67, -2.65, 1.49, 0.07, 1.19);
    for (const z of [-2.91, -2.36]) round(roof, palette.mint, x, 0.715, z, 0.40, 0.06);
  }
  for (const z of [-2.8, -0.79]) {
    const solar = group(roof, -3.61, 0.65, z);
    solar.rotation.x = -0.23;
    panel(solar, palette.trim, 0, 0, 0, 3.39, 0.09, 1.54);
    for (let i = 0; i < 5; i++) {
      for (const strip of [-1, 1]) {
        panel(solar, palette.solar, (i - 2) * 0.65, 0.05, strip * 0.365, 0.601, 0.025, 0.67);
      }
    }
  }
  for (const x of [-4.56, -2.92, 2.73, 4.44]) {
    panel(roof, palette.concrete, x, 0.33, 3.16, 1.47, 0.22, 0.83);
    panel(roof, palette.moss, x, 0.457, 3.16, 1.30, 0.059, 0.67);
    for (const offset of [-0.44, 0, 0.44]) {
      part(roof, offset ? palette.fern : palette.leaf, x + offset, 0.61, 3.16, 0.38, 0.33, 0.43, plantGeometry);
    }
  }
  round(roof, palette.mint, 5.29, 1.01, -3.46, 0.066, 1.35);
  round(roof, palette.amber, 5.29, 1.72, -3.46, 0.108, 0.12);

  const core = group(building, shaft.x, 0.15, 0);
  const rails = group(core);
  for (const x of [-0.71, 0.71]) {
    panel(rails, highlights.core, x, 0.5, 0.68, 0.070, 1, 0.075);
    panel(rails, palette.brass, x, 0.5, -0.68, 0.049, 1, 0.052);
  }
  const cabin = group(core);
  panel(cabin, palette.brass, 0, 0.055, 0, 1.47, 0.11, 1.33);
  panel(cabin, palette.amber, 0, 1.08, 0, 1.47, 0.11, 1.33);
  panel(cabin, palette.brass, 0, 0.58, -0.59, 1.31, 0.98, 0.075);
  for (const x of [-0.68, 0.68]) {
    panel(cabin, highlights.core, x, 0.57, 0.59, 0.055, 0.98, 0.065);
    panel(cabin, palette.window, x, 0.56, 0.52, 0.04, 0.72, 0.046);
  }
  panel(cabin, palette.window, 0, 0.124, 0.641, 1.39, 0.042, 0.052);

  for (const [parent, materials] of batches) {
    for (const [material, shapes] of materials) {
      for (const [shape, shapesData] of shapes) {
        const mesh = new THREE.InstancedMesh(shape, material, shapesData.length);
        for (const [i, dimensions] of shapesData.entries()) {
          const { x, y, z, width, height, length, yaw } = dimensions;
          matrix.position.set(x, y, z);
          matrix.rotation.set(0, yaw, 0);
          matrix.scale.set(width, height, length);
          matrix.updateMatrix();
          mesh.setMatrixAt(i, matrix.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        parent.add(mesh);
      }
    }
  }
  batches.clear();

  const hotspots = ['roof', 'homes', 'core', 'shops', 'foundation'].map(id => ({
    id,
    position: new THREE.Vector3(),
  }));
  const focus = new THREE.Vector3(0, 6.55, 0);
  let lastAmount = NaN;

  function update(dt, elapsed, amount, selected) {
    const explode = clamp(amount, 0, 1);
    if (explode !== lastAmount) {
      lastAmount = explode;
      const opening = smoothstep(explode, 0.04, 0.78);
      const interiorVisible = explode > 0.035;
      foundation.position.y = -1.02 * opening;
      foundationShell.visible = opening < 0.92;
      foundationShell.scale.y = Math.max(1 - opening, 0.08);
      foundationShell.position.y = -2.08 * opening;
      foundationInside.visible = interiorVisible;
      for (const { level, interior, exterior, closedY, openY } of levels) {
        level.position.y = lerp(closedY, openY, explode);
        interior.visible = interiorVisible;
        exterior.front.scale.y = 1 - opening * 0.88;
        exterior.front.position.z = footprint.length / 2 + opening * 0.47;
        exterior.front.rotation.x = opening * 0.10;
        exterior.side.scale.y = 1 - opening * 0.88;
        exterior.side.position.x = footprint.width / 2 + opening * 0.42;
        exterior.side.rotation.z = -opening * 0.10;
      }
      roof.position.y = lerp(11.42, 17.62, explode);
      core.visible = opening > 0.1;
      rails.scale.y = roof.position.y - 0.34;
      hotspots[0].position.set(5.8, roof.position.y + 0.76, 2.60);
      hotspots[1].position.set(5.7, levels[2].level.position.y + 1.12, 4.24);
      hotspots[2].position.set(-0.26, levels[1].level.position.y - 0.26, 1.05);
      hotspots[3].position.set(5.9, 1.23, 4.42);
      hotspots[4].position.set(6.42, -1.69 + foundation.position.y, 4.42);
    }
    if (core.visible) {
      const route = (elapsed % 14) / 14;
      cabin.position.y = 0.40 + (roof.position.y - 2.05) * (0.5 - 0.5 * Math.cos(2 * Math.PI * route));
    }
    for (const { id, material, base } of highlightMaterials) {
      material.emissiveIntensity = selected === id ? 0.55 + Math.sin(elapsed * 2.6) * 0.13 : base;
    }
  }

  update(0, 0, 0, null);
  return { update, hotspots, focus };
}
