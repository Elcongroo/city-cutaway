import * as THREE from './vendor/three.module.js';

export function createCity(scene) {
  const block = new THREE.Group();
  const surface = new THREE.Group();
  const topsoil = new THREE.Group();
  const tunnel = new THREE.Group();
  const bedrock = new THREE.Group();
  scene.add(block);
  block.add(bedrock, tunnel, topsoil, surface);

  const matte = (color, roughness = 0.84) => new THREE.MeshStandardMaterial({ color, roughness });
  const lit = (color, intensity = 0.35) => new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: intensity, roughness: 0.52,
  });
  const palette = {
    curb: matte(0x9a9c8c), walkway: matte(0x626962), plaza: matte(0x79827a),
    seam: matte(0x465652), road: matte(0x283237), lines: matte(0xb5c2b1), lane: matte(0xe4a760),
    grate: matte(0x1a2526), dark: matte(0x22323a), brick: matte(0x896a58),
    stone: matte(0x9a9076), concrete: matte(0x687777), trim: matte(0xb2a683),
    teal: matte(0x3e6469), paleTeal: matte(0x648a87), roof: matte(0x3a4c4b),
    clay: matte(0x996754), paleClay: matte(0xcc9074), sill: matte(0x42565a),
    glass: matte(0x283f48, 0.34), blueGlass: lit(0x73b4ba, 0.18),
    window: lit(0xffb966, 0.55), warmWindow: lit(0xffe3a1, 0.48),
    redWindow: lit(0xd79063, 0.23), light: lit(0xffca85, 2), coolLight: lit(0x65e5eb, 0.9),
    warning: lit(0xff6460, 1.4), trunk: matte(0x534638), leaf: matte(0x4f715e),
    leafLight: matte(0x6f8966), leafDark: matte(0x365748), lawn: matte(0x455a49),
    metal: matte(0x5d7b81, 0.51), seat: matte(0x8e6146),
    earth: matte(0x4b413a), clayFace: matte(0x7d5746), earthDark: matte(0x362e2f),
    grout: matte(0x3b3939), track: matte(0x625952), rail: matte(0x8e9e9c, 0.48),
    railBack: matte(0x262d30), railFoundation: matte(0x403637),
    cyanPipe: matte(0x406b74, 0.45), copperPipe: matte(0x98674f, 0.58),
    rock: matte(0x504446), lowerRock: matte(0x3c4049), bottom: matte(0x272b33),
  };

  let seed = 20261120;
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const groups = new Map();
  function box(parent, material, x, y, z, width, height, length, angle = 0) {
    if (!groups.has(parent)) groups.set(parent, new Map());
    const batches = groups.get(parent);
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push({ x, y, z, width, height, length, angle });
  }

  function cylinder(parent, material, a, b, radius, edges = 12) {
    const from = new THREE.Vector3(...a);
    const difference = new THREE.Vector3(...b).sub(from);
    const object = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, difference.length(), edges), material);
    object.position.copy(from.addScaledVector(difference, 0.5));
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), difference.normalize());
    object.receiveShadow = true;
    parent.add(object);
  }

  function sign(parent, text, x, y, z, width, height, background, foreground = '#ffffff') {
    const image = document.createElement('canvas');
    image.width = 512;
    image.height = 128;
    const context = image.getContext('2d');
    context.fillStyle = background;
    context.fillRect(0, 0, 512, 128);
    context.fillStyle = foreground;
    context.globalAlpha = 0.55;
    context.fillRect(0, 118, 512, 4);
    context.globalAlpha = 1;
    context.font = 'bold 62px "Microsoft YaHei", "PingFang SC", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 256, 67, 460);
    const texture = new THREE.CanvasTexture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    const object = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
    object.position.set(x, y, z);
    parent.add(object);
  }

  function rooftop(x, y, z, width, length, color) {
    box(surface, palette.roof, x, y + 0.09, z, width + 0.18, 0.19, length + 0.18);
    for (const edge of [-1, 1]) {
      box(surface, color, x + edge * width * 0.49, y + 0.27, z, 0.14, 0.42, length + 0.14);
      box(surface, color, x, y + 0.27, z + edge * length * 0.49, width + 0.14, 0.42, 0.14);
    }
    box(surface, palette.concrete, x - width * 0.24, y + 0.54, z - length * 0.22, 1.32, 0.85, 1.3);
    box(surface, palette.sill, x - width * 0.24, y + 1.01, z - length * 0.22, 1.46, 0.13, 1.46);
    for (let i = 0; i < 3; i++) {
      const offset = x + width * 0.12 + i * 0.39;
      box(surface, palette.concrete, offset, y + 0.34, z + length * 0.14, 0.31, 0.35, 0.56);
      box(surface, palette.dark, offset, y + 0.53, z + length * 0.14, 0.23, 0.06, 0.4);
    }
  }

  function building({ x, z, width, length, floors, pitch, col, body, edge, shop }) {
    const floorY = 0.2;
    const ground = 1.9;
    const high = floorY + ground + floors * pitch;
    const front = z + length / 2;
    const side = x + width / 2;
    box(surface, palette.plaza, x, 0.1, z, width + 0.48, 0.18, length + 0.39);
    box(surface, body, x, (high + floorY) / 2, z, width, high - floorY, length);
    box(surface, palette.dark, x, floorY + 0.84, front - 0.015, width - 0.32, 1.64, 0.09);
    box(surface, palette.dark, side, floorY + 0.84, z, 0.1, 1.64, length - 0.32);
    for (let i = 0; i < col; i++) {
      const windowX = x + ((i + 0.5) / col - 0.5) * width;
      box(surface, i === 0 ? palette.blueGlass : palette.window, windowX, 0.98, front + 0.045, width / col - 0.16, 1.38, 0.035);
      box(surface, palette.sill, windowX, 0.28, front + 0.071, width / col - 0.1, 0.075, 0.1);
      if (i !== 0) box(surface, palette.dark, windowX, 1.0, front + 0.067, 0.05, 1.4, 0.04);
    }
    for (let i = 0; i < 4; i++) {
      const windowZ = z + ((i + 0.5) / 4 - 0.5) * length;
      box(surface, i % 2 ? palette.redWindow : palette.blueGlass, side + 0.055, 0.94, windowZ, 0.035, 1.29, length / 4 - 0.24);
    }
    box(surface, edge, x, floorY + ground - 0.08, front + 0.05, width + 0.1, 0.15, 0.3);
    box(surface, edge, side + 0.09, floorY + ground - 0.08, z, 0.28, 0.15, length + 0.1);
    for (let i = 0; i < floors; i++) {
      const y = floorY + ground + (i + 0.52) * pitch;
      for (let j = 0; j < col; j++) {
        const wx = x + ((j + 0.5) / col - 0.5) * width;
        const shade = [palette.glass, palette.window, palette.warmWindow, palette.blueGlass][Math.floor(random() * 4)];
        const w = width / col * 0.73;
        box(surface, palette.dark, wx, y, front + 0.013, w + 0.11, pitch * 0.69, 0.05);
        box(surface, shade, wx, y, front + 0.05, w, pitch * 0.6, 0.045);
        box(surface, palette.sill, wx, y, front + 0.083, 0.045, pitch * 0.62, 0.03);
        box(surface, edge, wx, y - pitch * 0.35, front + 0.063, w + 0.11, 0.05, 0.21);
      }
      for (let j = 0; j < 4; j++) {
        const wz = z + ((j + 0.5) / 4 - 0.5) * length;
        const shade = random() > 0.48 ? palette.redWindow : palette.glass;
        box(surface, palette.dark, side + 0.02, y, wz, 0.065, pitch * 0.67, length * 0.19);
        box(surface, shade, side + 0.059, y, wz, 0.049, pitch * 0.56, length * 0.166);
        box(surface, edge, side + 0.084, y - pitch * 0.35, wz, 0.19, 0.055, length * 0.19);
      }
      if (i % 2 === 1) box(surface, edge, x, y + pitch * 0.48, front + 0.018, width + 0.05, 0.085, 0.1);
    }
    for (const sideSign of [-1, 1]) {
      box(surface, edge, x + sideSign * (width / 2 - 0.064), (high + 2) / 2, front + 0.03, 0.13, high - 2, 0.11);
    }
    if (shop) {
      box(surface, palette.dark, x, 1.83, front + 0.112, shop.width + 0.12, 0.56, 0.14);
      sign(surface, shop.text, x, 1.84, front + 0.19, shop.width, 0.43, shop.background, shop.textColor);
      box(surface, palette.light, x, 1.56, front + 0.12, shop.width, 0.032, 0.04);
    }
    rooftop(x, high, z, width, length, edge);
    return high;
  }

  function tree(x, z, size = 1) {
    box(surface, palette.curb, x, 0.11, z, 0.76 * size, 0.22, 0.76 * size);
    box(surface, palette.lawn, x, 0.23, z, 0.6 * size, 0.04, 0.6 * size);
    cylinder(surface, palette.trunk, [x, 0.24, z], [x, 1.92 * size, z], 0.09 * size, 7);
    for (let i = 0; i < 5; i++) {
      const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry((0.58 + random() * 0.26) * size, 0),
        [palette.leaf, palette.leafLight, palette.leafDark][i % 3]);
      foliage.position.set(x + (random() - 0.5) * 0.95 * size, (1.75 + random() * 0.71) * size,
        z + (random() - 0.5) * 0.92 * size);
      foliage.scale.set(1, 1.14, 0.99);
      foliage.rotation.y = random() * Math.PI;
      foliage.castShadow = true;
      surface.add(foliage);
    }
  }

  function lamppost(x, z, direction) {
    const edge = z + direction * 0.66;
    box(surface, palette.dark, x, 1.28, z, 0.095, 2.48, 0.095);
    box(surface, palette.dark, x, 2.51, (z + edge) / 2, 0.1, 0.08, 0.72);
    box(surface, palette.dark, x, 2.53, edge, 0.31, 0.16, 0.31);
    box(surface, palette.light, x, 2.44, edge, 0.26, 0.05, 0.25);
  }

  // The street is composed of replaceable blocks and fixtures, with sightlines down to the cutaway.
  box(surface, palette.concrete, 0, -0.12, 0, 32, 0.27, 16);
  box(surface, palette.road, 0, 0.023, 0, 32, 0.046, 4.74);
  box(surface, palette.walkway, 0, 0.062, 5.19, 32, 0.123, 5.62);
  box(surface, palette.walkway, 0, 0.06, -5.19, 32, 0.12, 5.62);
  for (const z of [-2.4, 2.4]) box(surface, palette.curb, 0, 0.103, z, 32, 0.18, 0.14);
  for (const z of [3.08, 4.9, 6.8, -3.12]) box(surface, palette.seam, 0, 0.126, z, 32, 0.008, 0.027);
  for (let x = -15.5; x < 16; x += 0.85) {
    box(surface, palette.seam, x, 0.127, 2.78, 0.023, 0.008, 0.58);
    box(surface, palette.seam, x, 0.127, 7.36, 0.023, 0.008, 1.1);
  }
  for (let x = -14.6; x < 16; x += 2.6) {
    if (Math.abs(x - 1) > 1.7 && Math.abs(x + 13.3) > 1.7) {
      box(surface, palette.lane, x, 0.05, 0, 1.35, 0.013, 0.085);
    }
  }
  for (const center of [-13.3, 1]) {
    for (let z = -1.83; z <= 2; z += 0.48) box(surface, palette.lines, center, 0.053, z, 1.38, 0.015, 0.24);
    box(surface, palette.lines, center + 0.96, 0.055, -1.25, 0.097, 0.015, 1.55);
    box(surface, palette.lines, center - 0.96, 0.055, 1.25, 0.097, 0.015, 1.55);
    for (const z of [-2.48, 2.48]) box(surface, palette.lane, center, 0.197, z, 1.29, 0.016, 0.26);
  }
  for (const z of [-2.09, 2.09]) box(surface, palette.lines, 0, 0.051, z, 32, 0.01, 0.04);
  for (const x of [-14.6, -6.4, 3.5, 12.8]) {
    box(surface, palette.grate, x, 0.053, 2.22, 0.56, 0.027, 0.18);
    for (let j = -2; j <= 2; j++) box(surface, palette.rail, x + j * 0.084, 0.071, 2.22, 0.028, 0.008, 0.13);
  }

  building({ x: -11.6, z: -5.72, width: 5.38, length: 4.79, floors: 3, pitch: 1.08, col: 4,
    body: palette.brick, edge: palette.trim, shop: { text: '街角咖啡', width: 2.52, background: '#53372d' } });
  const towerRoof = building({ x: -4.55, z: -5.65, width: 7.48, length: 4.6, floors: 7, pitch: 1.17, col: 6,
    body: palette.teal, edge: palette.paleTeal, shop: { text: '市集', width: 2.55, background: '#226365' } });
  building({ x: 3.64, z: -5.73, width: 6.94, length: 4.76, floors: 5, pitch: 1.17, col: 5,
    body: palette.stone, edge: palette.trim, shop: { text: '城市书店', width: 2.8, background: '#576251' } });
  building({ x: 10.88, z: -5.55, width: 5.08, length: 4.69, floors: 3, pitch: 1.16, col: 4,
    body: palette.clay, edge: palette.paleClay, shop: { text: '便利店', width: 2.81, background: '#236454' } });
  box(surface, palette.dark, -4.4, towerRoof + 1.2, -6.22, 0.065, 1.69, 0.065);
  box(surface, palette.warning, -4.4, towerRoof + 2.06, -6.22, 0.19, 0.11, 0.15);
  box(surface, palette.dark, -4.4, towerRoof + 1.71, -6.22, 0.88, 0.045, 0.045);

  for (const x of [-14, -8.2, 0.2, 6.3, 14.4]) lamppost(x, 2.81, -1);
  for (const x of [-10.2, -4.1, 4.24, 12.2]) lamppost(x, -2.77, 1);
  for (const [x, z, size] of [[-14.7, 6.1, 1.03], [-12, 6.1, 0.87], [-5.4, 6.9, 0.8], [3.8, 6.3, 1.04], [14.46, 6.1, 1.07]]) tree(x, z, size);
  for (const x of [-13.42, -4.2, 4.8, 13.48]) {
    box(surface, palette.seat, x, 0.48, 5.84, 1.02, 0.1, 0.38);
    box(surface, palette.seat, x, 0.69, 6, 1.02, 0.33, 0.07);
    for (const side of [-1, 1]) box(surface, palette.dark, x + side * 0.4, 0.3, 5.84, 0.1, 0.32, 0.32);
  }

  // Station entrance, ticket canopy and stairs share the warm transit lighting below the street.
  const stationX = -7.5;
  box(surface, palette.plaza, stationX, 0.15, 4.73, 3.64, 0.19, 3.28);
  box(surface, palette.dark, stationX, 0.25, 5.1, 2.87, 0.16, 1.96);
  for (let j = 0; j < 6; j++) box(surface, palette.concrete, stationX, 0.21 + j * 0.047, 5.78 - j * 0.23, 2.44, 0.18, 0.26);
  for (const delta of [-1.47, 1.47]) {
    box(surface, palette.teal, stationX + delta, 0.41, 5.06, 0.12, 0.51, 1.98);
    box(surface, palette.rail, stationX + delta, 0.67, 5.06, 0.095, 0.05, 1.98);
    box(surface, palette.dark, stationX + delta, 0.98, 4.22, 0.11, 1.71, 0.11);
  }
  box(surface, palette.teal, stationX, 1.95, 4.26, 3.28, 0.27, 0.55);
  box(surface, palette.coolLight, stationX, 1.79, 4.35, 3.04, 0.04, 0.08);
  sign(surface, '地铁入口', stationX, 1.96, 4.54, 2.36, 0.24, '#195264', '#c3fbec');

  function mineralSeam(parent, material, y, z, height, segments = 24) {
    const positions = [];
    const indices = [];
    for (let i = 0; i <= segments; i++) {
      const x = i / segments * 32 - 16;
      const v = y + Math.sin(i * 0.8) * 0.094 + Math.sin(i * 2.12) * 0.062 + (random() - 0.5) * height;
      positions.push(x, v, z, x, v + height * (0.65 + random() * 0.54), z);
      if (i) {
        const p = i * 2 - 2;
        indices.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    parent.add(new THREE.Mesh(geometry, material));
  }

  // Utilities are built into the front section face. The road drain and separate conduit stay visible.
  box(topsoil, palette.earth, 0, -1.72, -0.1, 32, 3, 15.8);
  box(topsoil, palette.clayFace, 0, -1.77, 7.72, 32, 2.86, 0.23);
  box(topsoil, palette.earthDark, 0, -0.53, 7.87, 32, 0.32, 0.12);
  box(topsoil, palette.grout, 0, -2.09, 7.87, 32, 0.73, 0.13);
  box(topsoil, palette.earthDark, 0, -3.15, 7.87, 32, 0.26, 0.11);
  mineralSeam(topsoil, palette.earth, -1.0, 7.85, 0.075);
  mineralSeam(topsoil, palette.earth, -1.26, 7.85, 0.042);
  mineralSeam(topsoil, palette.earth, -2.78, 7.85, 0.12);
  cylinder(topsoil, palette.cyanPipe, [-15.91, -2.04, 7.86], [15.96, -2.04, 7.86], 0.18);
  cylinder(topsoil, palette.copperPipe, [-15.92, -1.56, 7.78], [15.96, -1.56, 7.78], 0.077);
  for (let x = -14.8; x < 16; x += 3.17) {
    cylinder(topsoil, palette.rail, [x - 0.05, -2.04, 7.86], [x + 0.05, -2.04, 7.86], 0.218);
    box(topsoil, palette.earthDark, x, -1.55, 7.82, 0.052, 0.28, 0.09);
  }
  for (const x of [-11.7, -2.1, 7.8, 12.8]) {
    cylinder(topsoil, palette.cyanPipe, [x, -0.27, 7.86], [x, -1.94, 7.86], 0.099);
    cylinder(topsoil, palette.rail, [x, -0.85, 7.86], [x, -0.72, 7.86], 0.134);
  }

  // The tunnel's outer front face is intentionally open for viewing the train and track.
  box(tunnel, palette.railFoundation, 0, -4.89, -2.32, 32, 3.41, 11.36);
  box(tunnel, palette.railBack, 0, -4.88, 3.38, 32, 3.23, 0.3);
  box(tunnel, palette.railFoundation, 0, -3.35, 5.66, 32, 0.35, 4.63);
  box(tunnel, palette.railFoundation, 0, -6.43, 5.66, 32, 0.38, 4.63);
  box(tunnel, palette.concrete, 0, -6.27, 5.27, 32, 0.18, 3.53);
  box(tunnel, palette.track, 0, -6.16, 5, 31.97, 0.13, 2.16);
  box(tunnel, palette.grout, 0, -3.54, 7.88, 32, 0.19, 0.137);
  box(tunnel, palette.earthDark, 0, -6.45, 7.88, 32, 0.26, 0.14);
  for (const z of [4.26, 5.74]) box(tunnel, palette.rail, 0, -6.02, z, 32, 0.075, 0.067);
  for (let x = -15.73; x < 16; x += 0.42) box(tunnel, palette.railBack, x, -6.084, 5, 0.15, 0.083, 1.94);
  box(tunnel, palette.curb, 0, -6.06, 7.15, 31.99, 0.135, 0.69);
  box(tunnel, palette.lane, 0, -5.982, 6.88, 31.99, 0.025, 0.058);
  for (let x = -15.4; x < 16; x += 2.54) {
    box(tunnel, palette.grout, x, -4.79, 3.55, 0.26, 2.88, 0.21);
    box(tunnel, palette.grout, x, -3.58, 5.43, 0.26, 0.19, 4.03);
    box(tunnel, palette.dark, x, -3.83, 6.58, 0.75, 0.16, 0.24);
    box(tunnel, palette.light, x, -3.95, 6.58, 0.66, 0.08, 0.15);
    box(tunnel, palette.coolLight, x, -5.83, 3.69, 0.29, 0.039, 0.036);
  }
  for (const y of [-4.14, -4.23, -4.32]) cylinder(tunnel, palette.metal, [-15.96, y, 3.6], [15.96, y, 3.6], 0.029);
  sign(tunnel, '街心路', -7.5, -4.76, 3.567, 2.35, 0.45, '#20505a', '#e2f8e8');

  box(bedrock, palette.rock, 0, -7.33, 0, 32, 1.65, 16);
  box(bedrock, palette.lowerRock, 0, -9.08, 0, 32, 1.92, 16);
  box(bedrock, palette.bottom, 0, -10.17, 0, 32.16, 0.36, 16.16);
  mineralSeam(bedrock, palette.clayFace, -6.85, 8.006, 0.105);
  mineralSeam(bedrock, palette.earthDark, -7.15, 8.006, 0.14);
  mineralSeam(bedrock, palette.earthDark, -7.82, 8.006, 0.19);
  mineralSeam(bedrock, palette.grout, -8.25, 8.006, 0.08);
  mineralSeam(bedrock, palette.rock, -8.55, 8.006, 0.11);
  mineralSeam(bedrock, palette.grout, -8.93, 8.006, 0.15);
  mineralSeam(bedrock, palette.rock, -9.47, 8.006, 0.07);
  for (let i = 0; i < 68; i++) {
    const x = (random() - 0.5) * 31.85;
    const y = -6.85 - random() * 2.95;
    box(bedrock, i % 3 ? palette.grout : palette.earth, x, y, 7.997, 0.09 + random() * 0.24,
      0.028 + random() * 0.049, 0.034, (random() - 0.5) * 0.7);
  }

  const transform = new THREE.Object3D();
  for (const [parent, batches] of groups) {
    for (const [material, items] of batches) {
      const mesh = new THREE.InstancedMesh(boxGeometry, material, items.length);
      for (let i = 0; i < items.length; i++) {
        const { x, y, z, width, height, length, angle } = items[i];
        transform.position.set(x, y, z);
        transform.rotation.set(0, angle, 0);
        transform.scale.set(width, height, length);
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = parent === surface && items.length > 2;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  }

  function reveal(layer, depth, start, end, top) {
    const progress = THREE.MathUtils.clamp((depth - start) / (end - start), 0, 1);
    layer.visible = progress > 0.001;
    layer.scale.y = Math.max(progress, 0.001);
    layer.position.y = top * (1 - progress);
  }

  function setDepth(depth) {
    reveal(topsoil, depth, 0, 7.2, -0.24);
    reveal(tunnel, depth, 7.2, 14.2, -3.22);
    reveal(bedrock, depth, 14.2, 24, -6.55);
  }

  setDepth(18);
  return {
    setDepth,
    anchors: {
      street: new THREE.Vector3(0, 0.1, 0),
      drain: new THREE.Vector3(12.8, -2.04, 7.86),
      tunnel: new THREE.Vector3(0, -5.1, 5),
    },
  };
}
