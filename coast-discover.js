import * as THREE from './vendor/three.module.js';
import { groundY } from './coast-terrain.js';

const { clamp, damp, lerp } = THREE.MathUtils;
const BOX = new THREE.BoxGeometry();
const CYLINDER = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
const CONE = new THREE.ConeGeometry(0.5, 1, 9);
const RING = new THREE.TorusGeometry(0.5, 0.046, 7, 24);
const BEAD = new THREE.SphereGeometry(0.5, 8, 6);
const UP = new THREE.Vector3(0, 1, 0);
const blue = 0x81ecff;
const mint = 0x70ffe0;
const orange = 0xffc068;
const red = 0xff636a;

function steel(color) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.16, roughness: 0.7 });
}

function ink(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color, opacity, toneMapped: false, transparent: opacity < 1, depthWrite: opacity === 1,
  });
}

function piece(parent, geometry, material, position, width, height, length) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(width, height, length);
  parent.add(mesh);
  return mesh;
}

function instances(parent, geometry, material, count, animated = false) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  if (animated) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
  }
  parent.add(mesh);
  return mesh;
}

function transform() {
  const pose = new THREE.Object3D();
  return (mesh, index, x, y, z, w, h, l, ax = 0, ay = 0, az = 0) => {
    pose.position.set(x, y, z);
    pose.scale.set(w, h, l);
    pose.rotation.set(ax, ay, az);
    pose.updateMatrix();
    mesh.setMatrixAt(index, pose.matrix);
  };
}

function curve(points) {
  return new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
}

function piping(parent, route, radius, material) {
  const shell = new THREE.Mesh(new THREE.TubeGeometry(route, 38, radius, 8, false), material);
  parent.add(shell);
}

function makePump(scene) {
  const group = new THREE.Group();
  group.name = 'Discovery · road sump and pump bay';
  group.position.set(13.0, -23.75, 9.2);
  scene.add(group);
  const wall = steel(0x526976);
  const dark = steel(0x253b4a);
  const iron = steel(0x819aa3);
  const gauge = ink(blue, 0.87);
  const white = ink(0xb9dfeb);
  const warning = ink(red, 0.82);
  const warm = ink(orange);
  const frame = transform();

  piece(group, BOX, dark, [0, -0.19, 0], 7.6, 0.38, 9.58);
  piece(group, BOX, wall, [-0.95, 0.045, 0], 4.66, 0.16, 6.85);
  piece(group, BOX, wall, [-3.3, 1.88, -0.08], 0.24, 3.76, 6.96);
  piece(group, BOX, wall, [1.4, 1.88, -0.08], 0.24, 3.76, 6.96);
  piece(group, BOX, wall, [-0.95, 1.88, -3.52], 4.92, 3.76, 0.24);
  piece(group, BOX, iron, [-0.95, 0.78, 3.42], 4.89, 1.56, 0.32);
  piece(group, BOX, ink(0x7dd6ed, 0.19), [-0.95, 2.62, 3.42], 4.62, 2.21, 0.075);

  const braces = instances(group, BOX, iron, 13);
  let i = 0;
  for (const x of [-3.45, -0.95, 1.55]) frame(braces, i++, x, 2.04, 3.5, 0.10, 4.08, 0.14);
  for (const z of [-3.58, 3.51]) frame(braces, i++, -0.95, 3.82, z, 5.05, 0.13, 0.15);
  for (const x of [-3.35, 1.47]) frame(braces, i++, x, 3.82, -0.03, 0.14, 0.13, 7.15);
  for (let rung = 0; rung < 6; rung++) frame(braces, i++, -2.71, 0.65 + rung * 0.55, 3.62, 0.7, 0.08, 0.15);

  const scaleTicks = instances(group, BOX, white, 9);
  for (let tick = 0; tick < 9; tick++) {
    frame(scaleTicks, tick, 1.78, 0.24 + tick * 0.44, 3.58, tick % 2 === 0 ? 0.37 : 0.19, 0.052, 0.10);
  }
  const bar = piece(group, BOX, gauge, [2.17, 0, 3.55], 0.16, 1, 0.12);
  const line = piece(group, BOX, warm, [-0.95, 2.76, 3.56], 4.65, 0.065, 0.055);
  const water = piece(group, BOX, ink(0x1398d4, 0.66), [-0.95, 0, -0.05], 4.40, 1, 6.55);
  const surface = piece(group, BOX, ink(0x6cddf3, 0.83), [-0.95, 0, -0.05], 4.4, 0.035, 6.55);
  const ripple = instances(group, BOX, ink(0xc3f4ff, 0.32), 7, true);

  const incoming = curve([[-5.7, 5.9, -2.4], [-4.3, 4.6, -3.3], [-2.3, 4.45, -3.25], [-1.95, 4.4, -1.92], [-1.95, 1.2, -1.92]]);
  const outgoing = curve([[0.74, 0.9, 0.75], [2.45, 1.5, 0.65], [3.25, 1.7, 0.19], [3.25, 3.9, 0.13], [3.25, 6.58, 1.66], [3.25, 7.85, 2.5]]);
  piping(group, curve([[-6.1, 5.9, -2.35], [-4.32, 4.58, -3.3], [-2.32, 4.43, -3.25], [-1.95, 4.4, -1.93]]), 0.265, iron);
  piping(group, outgoing, 0.16, ink(0x51c9ec, 0.29));
  const emitter = piece(group, CYLINDER, iron, [-1.95, 4.32, -1.92], 0.66, 0.23, 0.66);
  emitter.rotation.x = 0.13;
  piece(group, BOX, wall, [2.66, 0.25, 0.7], 2.03, 0.46, 1.85);
  piece(group, CYLINDER, iron, [2.66, 1.12, 0.7], 1.62, 1.2, 1.62).rotation.z = Math.PI / 2;
  piece(group, CYLINDER, dark, [3.17, 1.12, 0.7], 1.38, 0.18, 1.38).rotation.z = Math.PI / 2;
  piece(group, CYLINDER, wall, [2.80, 0.79, 2.22], 0.64, 1.09, 0.64);
  const motor = piece(group, RING, ink(mint, 0.95), [3.28, 1.12, 0.7], 1.41, 1.41, 1.4);
  motor.rotation.y = Math.PI / 2;
  const alarm = piece(group, BEAD, warning, [2.8, 2.04, 3.38], 0.7, 0.72, 0.7);
  const alarmRing = piece(group, RING, warning, [2.80, 2.43, 3.38], 1, 1, 1);
  alarmRing.rotation.x = -Math.PI / 2;
  const incomingDots = instances(group, BEAD, ink(blue), 12, true);
  const outgoingDots = instances(group, BEAD, ink(mint), 11, true);
  const point = new THREE.Vector3();
  let fill = 0.54;
  let phase = 0;

  function update(dt, elapsed, state) {
    const power = state / 100;
    fill = damp(fill, lerp(0.95, 0.14, power), 0.82, dt);
    phase += dt * power * 0.97;
    const level = 0.10 + fill * 3.66;
    water.scale.y = level;
    water.position.y = level / 2;
    surface.position.y = level;
    bar.scale.y = level;
    bar.position.y = level / 2;
    for (let n = 0; n < ripple.count; n++) {
      const wave = (elapsed * 1.26 + n * 0.47);
      const z = -2.70 + (wave % 5.40);
      frame(ripple, n, -0.95 + Math.sin(wave) * 0.48, level + 0.043, z,
        1.22 + Math.sin(wave) * 0.73, 0.018, 0.041, 0, Math.sin(wave) * 0.22);
    }
    ripple.instanceMatrix.needsUpdate = true;

    for (let n = 0; n < incomingDots.count; n++) {
      incoming.getPointAt((elapsed * 0.37 + n / incomingDots.count) % 1, point);
      const visible = point.y >= level ? 1 : 0;
      frame(incomingDots, n, point.x, point.y, point.z, 0.18 * visible, 0.34 * visible, 0.18 * visible);
    }
    incomingDots.instanceMatrix.needsUpdate = true;
    for (let n = 0; n < outgoingDots.count; n++) {
      outgoing.getPointAt((phase + n / outgoingDots.count) % 1, point);
      const width = power > 0.02 ? 0.15 + power * 0.13 : 0;
      frame(outgoingDots, n, point.x, point.y, point.z, width, width * 1.68, width);
    }
    outgoingDots.instanceMatrix.needsUpdate = true;
    alarm.visible = alarmRing.visible = fill >= 0.72;
    warning.opacity = 0.45 + 0.45 * Math.abs(Math.sin(elapsed * 6.1));
    line.material.color.setHex(fill >= 0.72 ? red : orange);
    alarmRing.scale.setScalar(1.15 + 0.45 * (0.5 + 0.5 * Math.sin(elapsed * 5.1)));
    motor.visible = power > 0.02;
  }
  return { group, update };
}

function roadX(z) {
  return 16 + 5.4 * Math.sin((z + 25.45) / 85.85 * Math.PI) ** 2;
}

function roadY(z) {
  return -21.65 + 4.55 * ((z - 13) / 46.5) ** 2;
}

function makeAir(scene) {
  const group = new THREE.Group();
  group.name = 'Discovery · tunnel ventilation';
  scene.add(group);
  const motor = steel(0x506a77);
  const bracket = steel(0x233748);
  const rim = ink(0x64eadb, 0.93);
  const blades = ink(0xc1ffee, 0.93);
  const flowMaterial = ink(mint, 0.84);
  const frame = transform();
  const fans = [];

  for (const z of [-10.51, 3.53, 17.57, 31.61]) {
    const x = roadX(z) - 0.92;
    const y = roadY(z) + 2.76;
    const casing = piece(group, CYLINDER, motor, [x, y, z], 1.68, 1.15, 1.68);
    casing.rotation.x = Math.PI / 2;
    piece(group, BOX, bracket, [x - 0.65, y + 0.51, z - 0.13], 0.20, 0.9, 0.24);
    piece(group, BOX, bracket, [x + 0.65, y + 0.51, z - 0.13], 0.20, 0.9, 0.24);
    piece(group, RING, rim, [x, y, z + 0.59], 1.66, 1.66, 1.66);
    piece(group, RING, rim, [x, y, z - 0.59], 1.66, 1.66, 1.66);
    const rotor = new THREE.Group();
    rotor.position.set(x, y, z + 0.64);
    group.add(rotor);
    const wheel = instances(rotor, BOX, blades, 5);
    for (let i = 0; i < wheel.count; i++) {
      const angle = i * 2 * Math.PI / wheel.count;
      frame(wheel, i, Math.sin(angle) * 0.39, Math.cos(angle) * 0.39, 0, 0.16, 0.55, 0.06, 0, 0, -angle - 0.20);
    }
    piece(rotor, BEAD, rim, [0, 0, 0.05], 0.30, 0.30, 0.20);
    fans.push(rotor);
  }

  const lanes = [
    [0, 1.98],
    [-2.57, 1.75],
    [2.10, 2.15],
  ];
  const count = 36;
  const streaks = instances(group, BOX, flowMaterial, count, true);
  const points = instances(group, CONE, flowMaterial, count, true);
  let angle = 0;
  let travel = 0;

  function update(dt, elapsed, state) {
    const speed = state / 100;
    angle -= dt * speed * 15;
    travel += dt * speed * 13;
    for (const fan of fans) fan.rotation.z = angle;
    flowMaterial.opacity = lerp(0.22, 0.88, speed);
    for (let i = 0; i < count; i++) {
      const [offset, height] = lanes[i % lanes.length];
      const z = -21 + (i * 8.353 + travel) % 63;
      const x = roadX(z) + offset;
      const y = roadY(z) + height + Math.sin(i * 2.01 + elapsed * speed * 3.2) * 0.10;
      const length = lerp(0.27, 2.3, speed);
      const lineWidth = lerp(0.045, 0.12, speed);
      frame(streaks, i, x, y, z, lineWidth, lineWidth, length);
      frame(points, i, x, y, z + length / 2 + 0.09, 0.16, 0.28, 0.16, Math.PI / 2);
    }
    streaks.instanceMatrix.needsUpdate = true;
    points.instanceMatrix.needsUpdate = true;
  }
  return { group, update };
}

function makeLoad(scene) {
  const group = new THREE.Group();
  group.name = 'Discovery · trace the building load';
  const base = groundY(-34, -27);
  group.position.set(-34, base, -27);
  scene.add(group);
  const frame = transform();
  const beam = ink(0xffc66c, 0.80);
  const force = ink(0xffe9aa);
  const marker = ink(0xffa365, 0.88);
  const bars = instances(group, BOX, beam, 9, true);
  const nodes = instances(group, BEAD, marker, 15, true);
  const streams = instances(group, CONE, force, 21, true);
  const capacity = 12;
  const weights = instances(group, BOX, marker, capacity, true);
  const columnX = [-4.72, 0, 4.72];
  const z = 4.78;
  let phase = 0;
  let amount = 0.82;

  function setBuilding(next) {
    amount = Number.isFinite(next) ? clamp(next, 0, 1) : 0;
    group.position.y = base + 4.3 * amount;
  }

  function update(dt, elapsed, state) {
    const weight = state / 100;
    phase += dt * lerp(0.6, 2.07, weight);
    const roof = lerp(11.42, 17.62, amount);
    const baseY = Math.max(-1.65, -1.9 * amount);
    const floors = [0.28, ...[0, 1, 2].map(i => lerp(3.10 + i * 2.77, 4.37 + i * 4.27, amount) + 0.18), roof + 0.38];
    const half = (roof + baseY) / 2;

    const thickness = lerp(0.11, 0.25, weight);
    for (let i = 0; i < columnX.length; i++) {
      const x = columnX[i];
      frame(bars, i, x, half, z, thickness, roof - baseY + 0.54, thickness);
      for (let j = 0; j < floors.length; j++) {
        const size = 0.26 + weight * 0.11;
        frame(nodes, i * floors.length + j, x, floors[j], z, size, size, size);
      }
    }
    for (let i = 0; i < floors.length; i++) frame(bars, i + 3, 0, floors[i], z, 9.50, thickness * 0.65, thickness * 0.65);
    frame(bars, 8, 0, baseY, z, 10.7, thickness * 1.9, 0.36);
    bars.instanceMatrix.needsUpdate = true;
    nodes.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < streams.count; i++) {
      const x = columnX[i % columnX.length];
      const step = (phase + i * 0.8311) % 1;
      const y = lerp(roof + 0.30, baseY + 0.1, step);
      const scale = lerp(0.20, 0.49, weight);
      frame(streams, i, x, y, z + 0.13, scale, scale * 1.8, scale, 0, 0, Math.PI);
    }
    streams.instanceMatrix.needsUpdate = true;

    const count = Math.round(weight * capacity);
    weights.count = count;
    for (let i = 0; i < count; i++) {
      const x = columnX[i % columnX.length];
      const rise = Math.floor(i / 3);
      frame(weights, i, x, roof + 0.40 + rise * 0.25, 3.91, 0.77, 0.25, 0.55);
    }
    weights.instanceMatrix.needsUpdate = true;
  }
  return { group, update, setBuilding };
}

export function createCoastDiscover(scene) {
  const cases = { pump: makePump(scene), air: makeAir(scene), load: makeLoad(scene) };
  let active = null;
  let state = 0;
  for (const experiment of Object.values(cases)) experiment.group.visible = false;

  function setCase(id, value) {
    const next = Object.hasOwn(cases, id) ? id : null;
    if (next !== active) {
      if (active !== null) cases[active].group.visible = false;
      active = next;
      if (active !== null) cases[active].group.visible = true;
    }
    state = Number.isFinite(value) ? clamp(value, 0, 100) : 0;
  }

  function update(dt, elapsed) {
    if (active !== null) cases[active].update(dt, elapsed, state);
  }

  return { setCase, update, setBuilding: cases.load.setBuilding };
}
