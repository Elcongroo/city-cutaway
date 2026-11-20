import * as THREE from './vendor/three.module.js';

const FLOOR = -0.25;
const COMMON_BOX = new THREE.BoxGeometry(1, 1, 1);
const ALONG_X = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);

const materials = {
  shale: new THREE.MeshStandardMaterial({ color: 0x283440, roughness: 0.93 }),
  earth: new THREE.MeshStandardMaterial({ color: 0x593c33, roughness: 0.96 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x846049, roughness: 0.9 }),
  grit: new THREE.MeshStandardMaterial({ color: 0x9c7454, roughness: 0.88 }),
  bedrock: new THREE.MeshStandardMaterial({ color: 0x343d4b, roughness: 0.96 }),
  slate: new THREE.MeshStandardMaterial({ color: 0x233e4c, roughness: 0.84 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0x193344, roughness: 0.88 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x608490, roughness: 0.5, metalness: 0.49 }),
  rail: new THREE.MeshStandardMaterial({ color: 0xaeccd0, roughness: 0.33, metalness: 0.68 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xc7bca7, roughness: 0.87 }),
  cementShadow: new THREE.MeshStandardMaterial({ color: 0x6c6f6e, roughness: 0.9 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc4874f, roughness: 0.54, metalness: 0.43 }),
  amber: new THREE.MeshStandardMaterial({ color: 0xefad55, emissive: 0xb25f28, emissiveIntensity: 0.39, roughness: 0.6 }),
  amberLight: new THREE.MeshBasicMaterial({ color: 0xffbd78, toneMapped: false }),
  teal: new THREE.MeshStandardMaterial({ color: 0x29a5ad, roughness: 0.48, metalness: 0.21, emissive: 0x0c4b56, emissiveIntensity: 0.38 }),
  cyan: new THREE.MeshBasicMaterial({ color: 0x73efe9, toneMapped: false }),
  pipeSkin: new THREE.MeshPhysicalMaterial({
    color: 0x328c9c, roughness: 0.19, metalness: 0.11,
    transparent: true, opacity: 0.39, depthWrite: false, side: THREE.DoubleSide,
  }),
  pipeCore: new THREE.MeshStandardMaterial({ color: 0x219aa6, roughness: 0.45, emissive: 0x14839d, emissiveIntensity: 0.56 }),
  window: new THREE.MeshStandardMaterial({ color: 0x78aaa9, roughness: 0.27, metalness: 0.19, emissive: 0x278681, emissiveIntensity: 0.22 }),
  windowCabin: new THREE.MeshStandardMaterial({ color: 0xb4d3bc, roughness: 0.42, emissive: 0xb7b77c, emissiveIntensity: 0.34 }),
  carFinish: [
    new THREE.MeshStandardMaterial({ color: 0xb35a49, roughness: 0.32, metalness: 0.25 }),
    new THREE.MeshStandardMaterial({ color: 0x59939c, roughness: 0.33, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0xb89877, roughness: 0.31, metalness: 0.27 }),
  ],
};

function box(parent, material, sx, sy, sz, x, y, z) {
  const object = new THREE.Mesh(COMMON_BOX, material);
  object.position.set(x, y, z);
  object.scale.set(sx, sy, sz);
  parent.add(object);
  return object;
}

function drum(parent, material, radius, width, x, y, z) {
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 26), material);
  cylinder.position.set(x, y, z);
  cylinder.quaternion.copy(ALONG_X);
  parent.add(cylinder);
  return cylinder;
}

function plate(parent, material, width, length, top, thickness, bevel, centerZ = 0) {
  const x = width * 0.5 - bevel;
  const z = length * 0.5 - bevel;
  const shape = new THREE.Shape();
  shape.moveTo(-x + 0.22, -z);
  shape.lineTo(x - 0.22, -z);
  shape.quadraticCurveTo(x, -z, x, -z + 0.22);
  shape.lineTo(x, z - 0.22);
  shape.quadraticCurveTo(x, z, x - 0.22, z);
  shape.lineTo(-x + 0.22, z);
  shape.quadraticCurveTo(-x, z, -x, z - 0.22);
  shape.lineTo(-x, -z + 0.22);
  shape.quadraticCurveTo(-x, -z, -x + 0.22, -z);
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
    depth: thickness - bevel * 2, steps: 1, bevelEnabled: true,
    bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4,
  }), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, top - thickness + bevel, centerZ);
  parent.add(mesh);
  return mesh;
}

function populate(parent, geometry, material, entries) {
  const model = new THREE.InstancedMesh(geometry, material, entries.length);
  const helper = new THREE.Object3D();
  for (const [index, shape] of entries.entries()) {
    helper.position.set(shape.x, shape.y, shape.z);
    helper.scale.set(shape.sx ?? 1, shape.sy ?? 1, shape.sz ?? 1);
    helper.rotation.set(0, shape.rotation ?? 0, shape.tilt ?? 0);
    helper.updateMatrix();
    model.setMatrixAt(index, helper.matrix);
    if (shape.color !== undefined) model.setColorAt(index, new THREE.Color(shape.color));
  }
  model.instanceMatrix.needsUpdate = true;
  if (model.instanceColor) model.instanceColor.needsUpdate = true;
  parent.add(model);
  return model;
}

function consolidateBoxes(parent) {
  const groups = new Map();
  parent.updateWorldMatrix(true, true);
  const inverse = parent.matrixWorld.clone().invert();
  parent.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh || object.geometry !== COMMON_BOX || object.userData.movingLight) return;
    if (!groups.has(object.material)) groups.set(object.material, []);
    groups.get(object.material).push(object);
  });
  for (const [material, objects] of groups) {
    if (objects.length < 2) continue;
    const consolidated = new THREE.InstancedMesh(COMMON_BOX, material, objects.length);
    for (const [index, object] of objects.entries()) {
      consolidated.setMatrixAt(index, inverse.clone().multiply(object.matrixWorld));
      object.removeFromParent();
    }
    consolidated.instanceMatrix.needsUpdate = true;
    parent.add(consolidated);
  }
}

function rock() {
  let seed = 3496;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function behind(parent) {
  const segments = [
    { y: -0.63, h: 0.74, endZ: 5.45, mat: materials.soil },
    { y: -1.45, h: 0.90, endZ: 7.65, mat: materials.earth },
    { y: -2.39, h: 0.96, endZ: 7.94, mat: materials.soil },
    { y: -3.57, h: 1.40, endZ: -1.83, mat: materials.earth },
    { y: -5.28, h: 2.0, endZ: -1.81, mat: materials.soil },
    { y: -7.19, h: 1.8, endZ: 0.14, mat: materials.bedrock },
    { y: -9.65, h: 3.12, endZ: 1.2, mat: materials.shale },
    { y: -11.66, h: 0.9, endZ: 9.4, mat: materials.bedrock },
  ];
  for (const { y, h, endZ, mat } of segments) {
    box(parent, mat, 35.5, h - 0.039, endZ + 10.65, 0, y, (endZ - 10.65) / 2);
    box(parent, materials.grit, 35.22, 0.05, 0.04, 0, y - h / 2 + 0.082, endZ + 0.024);
  }

  const sample = rock();
  const inclusions = [];
  for (let i = 0; i < 179; i++) {
    const segment = segments[i % segments.length];
    const grain = {
      x: -17.1 + sample() * 34.2,
      y: segment.y + (sample() - 0.5) * (segment.h - 0.15),
      z: segment.endZ + 0.013,
      sx: 0.07 + sample() * 0.39,
      sy: 0.034 + sample() * 0.10,
      sz: 0.023 + sample() * 0.065,
      tilt: (sample() - 0.5) * 0.88,
      color: [0xa98565, 0x68594e, 0xabb1a3, 0x9d6f58, 0x4c5a65][i % 5],
    };
    const height = Math.abs(Math.sin(grain.tilt)) * grain.sx + grain.sy;
    grain.y = Math.min(grain.y, segment.y + segment.h / 2 - height - 0.015);
    inclusions.push(grain);
  }
  populate(parent, new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0xc0bdad, roughness: 0.94 }), inclusions);

  const bedEnd = 10.34;
  for (const [mat, height, y] of [
    [materials.soil, 0.28, -11.91],
    [materials.shale, 0.54, -12.32],
    [materials.brass, 0.055, -12.44],
  ]) {
    plate(parent, mat, 35.8, bedEnd * 2, y, height, Math.min(0.11, height / 3));
  }
}

function utility(parent) {
  const power = new THREE.Group();
  parent.add(power);
  const y = -1.77;
  const z = 10.15;
  const valveX = -7.4;
  box(power, materials.shale, 35.55, 0.24, 2.48, 0, -2.83, 9.48);
  box(power, materials.cementShadow, 35.4, 0.21, 1.22, 0, -0.49, 8.88);
  box(power, materials.earth, 35.62, 0.24, 2.14, 0, -2.64, 9.73);
  box(power, materials.steel, 35.4, 0.045, 0.055, 0, -2.51, 10.53);
  drum(power, materials.pipeSkin, 0.49, 35.26, 0, y, z);
  drum(power, materials.pipeCore, 0.266, 35.10, 0, y, z);
  drum(power, materials.steel, 0.43, 35.3, 0, -1.96, 8.08);
  drum(power, materials.earth, 0.245, 35.41, 0, -1.04, 8.84);

  const braces = [];
  const flangeBolts = [];
  for (const x of [-17.2, -13.9, -10.0, -7.95, -6.87, -3.1, 1.55, 6.2, 10.7, 14.7, 17.38]) {
    drum(power, materials.teal, 0.562, x < -7 && x > -8 ? 0.20 : 0.145, x, y, z);
    if (x > -17 && x < 17) {
      braces.push({ x, y: -2.42, z, sx: 0.55, sy: 0.34, sz: 0.71 });
      braces.push({ x, y: -2.58, z, sx: 0.87, sy: 0.13, sz: 1.01 });
    }
    for (let k = 0; k < 6; k++) {
      const angle = k / 6 * Math.PI * 2;
      flangeBolts.push({ x, y: y + Math.sin(angle) * 0.495, z: z + Math.cos(angle) * 0.495 });
    }
  }
  populate(power, COMMON_BOX, materials.cementShadow, braces);
  populate(power, new THREE.IcosahedronGeometry(0.065, 0), materials.brass, flangeBolts);

  const branch = new THREE.CatmullRomCurve3([
    new THREE.Vector3(valveX, y, z),
    new THREE.Vector3(valveX, -1.17, 9.86),
    new THREE.Vector3(valveX, -0.51, 9.13),
    new THREE.Vector3(valveX, -0.37, 8.93),
  ]);
  power.add(new THREE.Mesh(new THREE.TubeGeometry(branch, 16, 0.145, 12), materials.teal));
  drum(power, materials.brass, 0.72, 0.72, valveX, y, z);
  drum(power, materials.teal, 0.58, 0.83, valveX, y, z);
  const gaugeBack = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.10, 24), materials.brass);
  gaugeBack.rotation.x = Math.PI * 0.5;
  gaugeBack.position.set(valveX - 0.71, y + 0.55, z + 0.18);
  power.add(gaugeBack);
  const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.192, 24), materials.windowCabin);
  gauge.position.set(valveX - 0.71, y + 0.55, z + 0.238);
  power.add(gauge);
  const gaugeNeedle = box(power, materials.slate, 0.026, 0.15, 0.027, valveX - 0.71, y + 0.58, z + 0.247);
  gaugeNeedle.rotation.z = 1.14;

  const wheel = new THREE.Group();
  wheel.position.set(valveX, y + 0.56, z + 0.57);
  power.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.365, 0.055, 7, 25), materials.amber));
  box(wheel, materials.brass, 0.09, 0.77, 0.08, 0, 0, 0);
  box(wheel, materials.brass, 0.77, 0.09, 0.08, 0, 0, 0);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.15, 10), materials.amberLight);
  cap.rotation.x = Math.PI / 2;
  wheel.add(cap);
  const ledges = [];
  for (let x = -17.0; x < 17.2; x += 0.48) {
    ledges.push({ x, y: -0.58, z: 9.48, sx: 0.279, sy: 0.042, sz: 0.038 });
  }
  populate(power, COMMON_BOX, materials.brass, ledges);

  const glints = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 5), materials.cyan, 44);
  glints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  glints.frustumCulled = false;
  glints.renderOrder = 1;
  power.add(glints);
  const runner = new THREE.Object3D();
  return (elapsed, selected) => {
    wheel.rotation.z = Math.sin(elapsed * 0.95) * 0.11 + (selected ? Math.sin(elapsed * 1.2) * 0.14 : 0);
    gaugeNeedle.rotation.z = 0.94 + Math.sin(elapsed * 1.85) * (selected ? 0.25 : 0.08);
    const speed = selected ? 4.3 : 2.75;
    for (let i = 0; i < glints.count; i++) {
      const amount = ((i * 0.809 + elapsed * speed) % 34.92 + 34.92) % 34.92;
      runner.position.set(-17.45 + amount, y + Math.cos(i * 0.7) * 0.108, z + 0.15 + Math.sin(i * 1.53) * 0.084);
      runner.scale.set(i % 6 === 0 ? 0.195 : 0.126, 0.043, 0.045);
      runner.updateMatrix();
      glints.setMatrixAt(i, runner.matrix);
    }
    glints.instanceMatrix.needsUpdate = true;
  };
}

function footing(parent) {
  const foundation = new THREE.Group();
  parent.add(foundation);
  box(foundation, materials.slate, 17.7, 0.23, 8.1, -9.0, -6.48, 5.97);
  box(foundation, materials.cementShadow, 17.8, 2.87, 0.37, -8.84, -4.65, 2.06);
  box(foundation, materials.concrete, 15.0, 0.43, 4.21, -9.0, -3.27, 6.97);
  box(foundation, materials.earth, 18.0, 0.27, 9.45, -8.94, -6.12, 5.97);
  box(foundation, materials.shale, 17.98, 0.115, 9.64, -8.8, -6.35, 5.99);
  const supports = [];
  const strips = [];
  const witness = [];
  for (const x of [-15.2, -11.2, -7.1, -3.45]) {
    const narrow = x > -7.2;
    const z = narrow ? 7.31 : 7.82;
    supports.push({ x, y: -1.73, z: z - 1.77, sx: narrow ? 0.66 : 0.85, sy: 2.95, sz: 0.73 });
    supports.push({ x, y: -4.37, z, sx: narrow ? 0.86 : 0.96, sy: narrow ? 1.75 : 2.13, sz: 0.83 });
    supports.push({ x, y: narrow ? -5.35 : -5.69, z, sx: narrow ? 2.04 : 2.61, sy: 0.40, sz: 1.83 });
    strips.push({ x, y: -5.83, z, sx: 1.18, sy: 0.57, sz: 1.1 });
    witness.push({ x, y: -3.97, z: z + 0.429, sx: 0.53, sy: 0.032, sz: 0.016 });
    witness.push({ x, y: -4.26, z: z + 0.429, sx: 0.51, sy: 0.032, sz: 0.016 });
  }
  populate(foundation, COMMON_BOX, materials.concrete, supports);
  populate(foundation, COMMON_BOX, materials.cementShadow, strips);
  populate(foundation, COMMON_BOX, materials.brass, witness);
  box(foundation, materials.steel, 17.45, 0.065, 0.06, -8.82, -6.40, 10.01);
  box(foundation, materials.amberLight, 6.6, 0.037, 0.05, -10.8, -3.39, 9.06);
  return foundation;
}

function parkedCar(parent, paint, x, z, length = 2.18) {
  const y = -5.8;
  box(parent, paint, 1.34, 0.46, length, x, y + 0.31, z);
  box(parent, paint, 1.02, 0.378, length * 0.48, x, y + 0.596, z - 0.12);
  box(parent, materials.window, 1.041, 0.26, 0.041, x, y + 0.594, z + length * 0.23 - 0.056).rotation.x = -0.18;
  box(parent, materials.window, 0.041, 0.25, length * 0.44, x + 0.520, y + 0.594, z - 0.13);
  box(parent, materials.window, 0.041, 0.25, length * 0.44, x - 0.520, y + 0.594, z - 0.13);
  for (const dx of [-0.50, 0.50]) {
    box(parent, materials.amberLight, 0.22, 0.085, 0.041, x + dx, y + 0.34, z + length / 2 + 0.001);
    box(parent, materials.shale, 0.18, 0.22, 0.42, x + Math.sign(dx) * 0.635, y + 0.145, z + length * 0.305);
    box(parent, materials.shale, 0.18, 0.22, 0.42, x + Math.sign(dx) * 0.635, y + 0.145, z - length * 0.31);
  }
}

function parking(parent) {
  const garage = new THREE.Group();
  parent.add(garage);
  box(garage, materials.ceiling, 16.35, 2.78, 0.28, 9.34, -4.52, 1.78);
  box(garage, materials.slate, 16.76, 0.45, 9.13, 9.47, -5.99, 6.01);
  box(garage, materials.steel, 16.67, 0.12, 0.14, 9.43, -5.80, 10.57);
  box(garage, materials.slate, 16.54, 0.37, 7.19, 9.43, -3.21, 5.38);
  box(garage, materials.concrete, 16.31, 0.39, 0.32, 9.42, -3.42, 8.83);
  box(garage, materials.amber, 16.4, 0.052, 0.061, 9.45, -3.62, 8.98);
  box(garage, materials.shale, 0.54, 2.20, 7.17, 1.73, -4.66, 5.34);
  box(garage, materials.shale, 0.41, 2.24, 3.09, 17.28, -4.68, 3.37);
  const posts = [];
  const guards = [];
  const lines = [];
  const sprinkles = [];
  const lamps = [];
  for (const x of [2.1, 8.45, 14.91, 17.28]) {
    posts.push({ x, y: -4.60, z: 8.83, sx: 0.30, sy: 2.39, sz: 0.33 });
    guards.push({ x, y: -4.84, z: 8.83, sx: 0.316, sy: 0.195, sz: 0.353 });
    guards.push({ x, y: -5.09, z: 8.83, sx: 0.316, sy: 0.195, sz: 0.353 });
    lamps.push({ x: x + 0.19, y: -3.42, z: 6.25, sx: 0.82, sy: 0.076, sz: 0.142 });
    lamps.push({ x: x + 0.19, y: -3.42, z: 3.34, sx: 0.82, sy: 0.076, sz: 0.142 });
  }
  for (let i = 0; i < 6; i++) {
    const x = 3.12 + i * 2.33;
    lines.push({ x, y: -5.754, z: 8.27, sx: 0.055, sy: 0.031, sz: 3.17 });
    lines.push({ x: x + 1.135, y: -5.753, z: 10.16, sx: 2.32, sy: 0.026, sz: 0.051 });
    sprinkles.push({ x: x + 1.17, y: -5.74, z: 5.54, sx: 0.82, sy: 0.038, sz: 0.08 });
    if (i !== 2 && i !== 5) parkedCar(garage, materials.carFinish[i % 3], x + 1.09, 8.75 - (i % 2) * 0.13, 2.09 + (i % 3) * 0.17);
  }
  populate(garage, COMMON_BOX, materials.concrete, posts);
  populate(garage, COMMON_BOX, materials.amber, guards);
  populate(garage, COMMON_BOX, materials.amber, lines);
  populate(garage, COMMON_BOX, materials.concrete, sprinkles);
  populate(garage, COMMON_BOX, materials.amberLight, lamps);

  const charges = [];
  for (const x of [4.2, 11.2, 16.0]) {
    charges.push({ x, y: -5.31, z: 6.73, sx: 0.21, sy: 0.91, sz: 0.19 });
  }
  populate(garage, COMMON_BOX, materials.teal, charges);
  populate(garage, COMMON_BOX, materials.cyan, charges.map(({ x, y, z }) => ({
    x, y: y + 0.28, z: z + 0.104, sx: 0.12, sy: 0.08, sz: 0.019,
  })));
  consolidateBoxes(garage);
}

function tunnelArch() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.88, -0.01);
  shape.lineTo(-0.88, 1.56);
  shape.quadraticCurveTo(-0.88, 2.15, -0.36, 2.18);
  shape.lineTo(0.36, 2.18);
  shape.quadraticCurveTo(0.88, 2.15, 0.88, 1.56);
  shape.lineTo(0.88, -0.01);
  shape.lineTo(0.75, -0.01);
  shape.lineTo(0.75, 1.56);
  shape.quadraticCurveTo(0.75, 2.01, 0.35, 2.038);
  shape.lineTo(-0.35, 2.038);
  shape.quadraticCurveTo(-0.75, 2.018, -0.75, 1.56);
  shape.lineTo(-0.75, -0.01);
  shape.lineTo(-0.88, -0.01);
  const geometry = new THREE.ExtrudeGeometry(shape, {depth:0.13, bevelEnabled:false, curveSegments:5});
  geometry.rotateY(Math.PI / 2);
  return geometry;
}

function makeTrain(parent) {
  const group = new THREE.Group();
  parent.add(group);
  const carLength = 3.33;
  const y = -9.63;
  const z = 9.29;
  const cars = [];
  for (const offset of [-3.51, 0, 3.51]) {
    const width = 1.46;
    box(group, materials.shale, carLength + 0.03, 0.17, width - 0.06, offset, y - 0.93, z);
    box(group, materials.concrete, carLength, 1.73, width, offset, y - 0.177, z);
    box(group, materials.steel, carLength - 0.098, 0.129, width - 0.11, offset, y + 0.777, z);
    box(group, materials.teal, carLength - 0.031, 0.19, width + 0.032, offset, y - 0.54, z);
    box(group, materials.slate, carLength - 0.037, 0.082, width + 0.038, offset, y - 0.791, z);
    box(group, materials.slate, 0.90, 0.111, 0.59, offset + 0.22, y + 0.857, z);
    box(group, materials.steel, 0.53, 0.136, 0.52, offset - 0.59, y + 0.869, z);
    for (const side of [-1, 1]) {
      const panelZ = z + side * (width / 2 + 0.018);
      for (const w of [-1.13, -0.61, 0.54, 1.09]) {
        const panelY = y + 0.16;
        box(group, materials.windowCabin, 0.345, 0.456, 0.014, offset + w, panelY, panelZ);
        box(group, materials.teal, 0.354, 0.048, 0.019, offset + w, panelY - 0.265, panelZ + side * 0.01);
        for (const slot of [-0.063, 0.089]) {
          box(group, materials.cementShadow, 0.032, 0.17, 0.018, offset + w + slot, panelY - 0.05, panelZ + side * 0.02);
        }
      }
      box(group, materials.steel, 0.48, 1.25, 0.027, offset - 0.032, y - 0.26, panelZ);
      box(group, materials.window, 0.32, 0.39, 0.033, offset - 0.032, y + 0.124, panelZ + side * 0.013);
      box(group, materials.slate, 0.027, 1.154, 0.031, offset - 0.034, y - 0.260, panelZ + side * 0.025);
      box(group, materials.cyan, 0.21, 0.048, 0.03, offset - 0.033, y + 0.47, panelZ + side * 0.05);
    }
    for (const lx of [-1.01, 1.06]) {
      for (const side of [-1, 1]) {
        const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.12, 10), materials.shale);
        tyre.rotation.x = Math.PI / 2;
        tyre.position.set(offset + lx, y - 1.04, z + side * 0.54);
        group.add(tyre);
      }
    }
    cars.push(offset);
  }
  const lights = [];
  for (const side of [-1, 1]) {
    const x = cars[side < 0 ? 0 : 2] + side * carLength / 2;
    const nose = new THREE.Group();
    nose.position.set(x, y, z);
    group.add(nose);
    box(nose, materials.teal, 0.14, 1.17, 1.35, 0, -0.05, 0);
    box(nose, materials.window, 0.15, 0.48, 1.06, side * 0.01, 0.37, 0);
    const lamps = [];
    for (const dx of [-0.43, 0.43]) {
      const lamp = box(nose, materials.cyan, 0.16, 0.13, 0.16, side * 0.042, -0.47, dx);
      lamp.userData.movingLight = true;
      lamps.push(lamp);
    }
    lights.push({ side, lamps });
  }
  consolidateBoxes(group);
  return elapsed => {
    const phase = elapsed * 0.235;
    group.position.x = Math.sin(phase) * 11.85;
    const direction = Math.cos(phase) >= 0 ? 1 : -1;
    for (const { side, lamps } of lights) {
      for (const lamp of lamps) lamp.material = side === direction ? materials.cyan : materials.amberLight;
    }
  };
}

function metro(parent) {
  const lower = new THREE.Group();
  parent.add(lower);
  box(lower, materials.ceiling, 35.65, 2.77, 0.52, 0, -9.46, 5.85);
  box(lower, materials.slate, 35.61, 0.49, 6.91, 0, -7.72, 7.26);
  box(lower, materials.cementShadow, 35.48, 0.30, 0.49, 0, -7.94, 10.79);
  box(lower, materials.teal, 35.41, 0.065, 0.083, 0, -8.13, 11.036);
  box(lower, materials.slate, 35.68, 0.49, 4.95, 0, -11.35, 8.25);
  box(lower, materials.steel, 35.63, 0.108, 0.089, 0, -11.14, 10.75);
  box(lower, materials.concrete, 35.44, 0.34, 1.55, 0, -10.71, 7.09);
  box(lower, materials.amber, 35.01, 0.041, 0.085, 0, -10.54, 7.89);
  box(lower, materials.shale, 35.70, 0.07, 1.62, 0, -10.98, 9.29);
  box(lower, materials.rail, 35.66, 0.093, 0.08, 0, -10.87, 8.92);
  box(lower, materials.rail, 35.66, 0.093, 0.08, 0, -10.87, 9.67);
  const braces = [];
  const tileGrain = [];
  const stationLamps = [];
  const sleepers = [];
  for (let i = 0; i < 74; i++) {
    const x = -17.44 + i * 0.48;
    sleepers.push({ x, y: -10.936, z: 9.29, sx: 0.14, sy: 0.047, sz: 1.23 });
    tileGrain.push({ x, y: -9.56, z: 6.136, sx: 0.329, sy: 0.173, sz: 0.024, color: [0x254758, 0x315765, 0x3d6571, 0x2c4d57][i % 4] });
    tileGrain.push({ x: x - 0.088, y: -9.771, z: 6.136, sx: 0.325, sy: 0.172, sz: 0.024, color: [0x345e69, 0x426674, 0x284755, 0x345761][i % 4] });
  }
  for (let i = 0; i < 10; i++) {
    const x = -16.2 + i * 3.59;
    braces.push({ x, y: -10.67, z: 7.98, sx: 0.195, sy: 1.09, sz: 1.47 });
    stationLamps.push({ x: x - 0.19, y: -8.20, z: 7.04, sx: 1.79, sy: 0.05, sz: 0.09 });
  }
  populate(lower, COMMON_BOX, materials.cementShadow, sleepers);
  populate(lower, COMMON_BOX, materials.steel, braces);
  populate(lower, COMMON_BOX, new THREE.MeshStandardMaterial({ color: 0xb5c6bf, roughness: 0.71 }), tileGrain);
  populate(lower, COMMON_BOX, materials.cyan, stationLamps);

  const portals = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) portals.push({ x: side * (15.05 + i * 0.41), y: -10.85, z: 9.29 });
    box(lower, materials.cementShadow, 0.41, 1.99, 0.28, side * 17.43, -9.70, 10.47);
  }
  populate(lower, tunnelArch(), materials.steel, portals);
  consolidateBoxes(lower);
  return makeTrain(lower);
}

function pointer(parent, color, x, y, z, wide, tall) {
  const guide = new THREE.Group();
  guide.position.set(x, y, z);
  const glow = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.84, depthWrite: false });
  for (const dx of [-1, 1]) {
    for (const dy of [-1, 1]) {
      box(guide, glow, 0.66, 0.036, 0.016, dx * (wide - 0.3), dy * tall, 0);
      box(guide, glow, 0.036, 0.44, 0.016, dx * wide, dy * (tall - 0.20), 0);
    }
  }
  guide.visible = false;
  parent.add(guide);
  return { guide, glow };
}

export function createStreetUnderground(scene) {
  const anchor = new THREE.Group();
  scene.add(anchor);
  const exhibit = new THREE.Group();
  // All section levels are stretched around the same surface seam.
  const levels = new THREE.Group();
  levels.position.y = -FLOOR;
  exhibit.position.y = FLOOR;
  exhibit.add(levels);
  anchor.add(exhibit);
  behind(levels);
  const flow = utility(levels);
  footing(levels);
  parking(levels);
  const glide = metro(levels);
  const closed = plate(anchor, materials.shale, 35.94, 21.73, FLOOR, 0.60, 0.13);
  const plinthLine = plate(anchor, materials.teal, 35.88, 21.58, -0.79, 0.072, 0.028);

  const features = {
    pipes: new THREE.Vector3(-7.4, -1.77, 10.50),
    foundation: new THREE.Vector3(-10.1, -4.80, 9.05),
    parking: new THREE.Vector3(7.90, -4.81, 10.44),
    metro: new THREE.Vector3(0, -9.58, 10.48),
  };
  const highlights = {
    pipes: pointer(levels, 0x7af4e8, -7.42, -1.71, 10.96, 1.70, 0.81),
    foundation: pointer(levels, 0xf3d5a4, -10.10, -4.80, 10.02, 6.2, 1.52),
    parking: pointer(levels, 0xffbf76, 9.67, -4.77, 10.72, 6.85, 1.20),
    metro: pointer(levels, 0x7af4e8, 0, -9.56, 10.79, 7.9, 1.65),
  };
  let focus = null;
  let amount = 0;

  function setOpen(progress) {
    amount = THREE.MathUtils.clamp(progress, 0, 1);
    const scale = 0.034 + 0.966 * amount;
    exhibit.scale.y = scale;
    exhibit.visible = amount > 0.07;
    closed.visible = amount <= 0.07;
    plinthLine.visible = closed.visible;
  }

  function setFocus(id) {
    const next = Object.hasOwn(highlights, id) ? id : null;
    if (next === focus) return;
    for (const [name, data] of Object.entries(highlights)) data.guide.visible = name === next;
    focus = next;
  }

  function update(dt, elapsed) {
    if (!exhibit.visible) return;
    flow(elapsed, focus === 'pipes');
    glide(elapsed);
    if (focus) highlights[focus].glow.opacity = 0.73 + Math.cos(elapsed * 2.7) * 0.12;
  }

  flow(0, false);
  setOpen(0);
  return { setOpen, setFocus, update, features };
}
