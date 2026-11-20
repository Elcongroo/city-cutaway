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
  group.name = 'Discovery · tunnel drainage plant';
  group.position.set(9.4, -24.6, 8.8);
  scene.add(group);
  const wall = steel(0x667e8d);
  const dark = steel(0x233647);
  const iron = steel(0x91a9b2);
  const white = ink(0xceeff6);
  const warning = ink(red, 0.83);
  const warm = ink(orange);
  const frame = transform();

  // The open-front wet well and an elevated service aisle make every path visible.
  piece(group, BOX, dark, [0, -0.22, 0], 14.4, 0.44, 13.2);
  piece(group, BOX, wall, [-2.75, 0.1, 0.25], 5.42, 0.18, 7.13);
  piece(group, BOX, wall, [-5.54, 2.18, 0.25], 0.25, 4.36, 7.39);
  piece(group, BOX, wall, [0.04, 2.18, 0.25], 0.25, 4.36, 7.39);
  piece(group, BOX, wall, [-2.75, 2.18, -3.39], 5.65, 4.36, 0.25);
  piece(group, BOX, iron, [-2.75, 0.23, 3.91], 5.66, 0.44, 0.26);
  const windowPanel = piece(group, BOX, ink(0xa1ebf1, 0.14), [-2.75, 2.34, 3.92], 5.49, 3.8, 0.08);
  windowPanel.renderOrder = 3;
  piece(group, BOX, wall, [3.15, 0.37, 0.85], 5.88, 0.7, 7.91);

  const beams = instances(group, BOX, iron, 18);
  let beam = 0;
  for (const x of [-5.67, -2.76, 0.17]) frame(beams, beam++, x, 2.24, 3.97, 0.11, 4.49, 0.19);
  for (const z of [-3.52, 4.02]) frame(beams, beam++, -2.75, 4.39, z, 5.94, 0.15, 0.17);
  for (const x of [-5.62, 0.12]) frame(beams, beam++, x, 4.39, 0.25, 0.15, 0.15, 7.70);
  for (const x of [-5.24, -4.51]) frame(beams, beam++, x, 2.37, 4.15, 0.095, 4.16, 0.12);
  for (let rung = 0; rung < 9; rung++) {
    frame(beams, beam++, -4.89, 0.58 + rung * 0.405, 4.16, 0.72, 0.074, 0.14);
  }

  const ticks = instances(group, BOX, white, 11);
  for (let tick = 0; tick < ticks.count; tick++) {
    frame(ticks, tick, 0.41, 0.26 + tick * 0.385, 4.08, tick % 2 ? 0.20 : 0.38, 0.054, 0.07);
  }
  piece(group, BOX, dark, [0.75, 2.18, 4.09], 0.21, 3.9, 0.09);
  const bar = piece(group, BOX, ink(blue), [0.76, 0, 4.15], 0.12, 1, 0.08);
  const limit = piece(group, BOX, warm, [-2.74, 3.10, 4.06], 5.33, 0.07, 0.06);
  const water = piece(group, BOX, ink(0x168bce, 0.68), [-2.75, 0, 0.25], 5.26, 1, 6.87);
  const surface = piece(group, BOX, ink(0x72e6f0, 0.79), [-2.75, 0, 0.25], 5.26, 0.035, 6.87);
  const ripples = instances(group, BOX, ink(0xc5fbff, 0.39), 9, true);

  // A gutter and a grate lead into the catch basin before either pump.
  const inlet = curve([[6.9, 5.85, -5.4], [3.72, 5.65, -5.4], [-2.98, 5.1, -5.4], [-3.39, 4.97, -4.15],
    [-3.39, 4.84, -1.88], [-3.39, 1.04, -1.88]]);
  const gutter = piece(group, BOX, dark, [1.45, 5.32, -5.42], 10.7, 0.40, 1.73);
  gutter.rotation.z = 0.068;
  for (const z of [-6.28, -4.55]) {
    const rail = piece(group, BOX, iron, [1.45, 5.56, z], 10.7, 0.34, 0.14);
    rail.rotation.z = 0.068;
  }
  const grate = instances(group, BOX, iron, 9);
  for (let i = 0; i < grate.count; i++) {
    frame(grate, i, 5.08 + i * 0.19, 5.81 + i * 0.013, -5.42, 0.08, 0.12, 1.53);
  }
  piping(group, curve([[-3.26, 5.03, -5.25], [-3.39, 4.97, -4.15], [-3.39, 4.84, -1.88]]), 0.27, ink(0x70c7ed, 0.27));
  const inletNozzle = piece(group, CYLINDER, iron, [-3.39, 4.79, -1.88], 0.70, 0.25, 0.70);
  inletNozzle.rotation.x = 0.11;
  const incomingDots = instances(group, BEAD, ink(blue), 20, true);

  // The two independent pump branches merge only after their one-way valves.
  const pumps = [
    { x: 1.77, color: mint, guard: 0x278778, zIn: -1.75 },
    { x: 4.41, color: 0xffe286, guard: 0x986435, zIn: 2.53 },
  ].map(definition => {
    const { x, color, guard, zIn } = definition;
    const lit = ink(color, 0.88);
    const off = ink(0x6e8997);
    const casing = steel(guard);
    const rotor = new THREE.Group();
    rotor.position.set(x, 1.80, 2.84);
    group.add(rotor);
    const impeller = instances(rotor, BOX, lit, 6);
    for (let blade = 0; blade < impeller.count; blade++) {
      const angle = blade * Math.PI / 3;
      frame(impeller, blade, Math.sin(angle) * 0.27, Math.cos(angle) * 0.27, 0.014,
        0.15, 0.42, 0.10, 0, 0, -angle - 0.38);
    }
    piece(rotor, BEAD, white, [0, 0, 0.06], 0.32, 0.32, 0.22);
    piece(group, BOX, casing, [x, 0.82, 1.23], 2.08, 0.22, 3.58);
    piece(group, CYLINDER, casing, [x, 1.80, 1.57], 1.55, 2.41, 1.55).rotation.x = Math.PI / 2;
    piece(group, CYLINDER, dark, [x, 1.80, 2.73], 1.48, 0.19, 1.48).rotation.x = Math.PI / 2;
    piece(group, RING, lit, [x, 1.80, 2.86], 1.60, 1.60, 1.60);
    const ribs = instances(group, RING, iron, 5);
    for (let rib = 0; rib < ribs.count; rib++) {
      frame(ribs, rib, x, 1.80, 0.68 + rib * 0.29, 1.58, 1.58, 1.1);
    }
    const lamp = piece(group, BEAD, off, [x, 2.80, 2.90], 0.30, 0.30, 0.29);
    piece(group, BOX, dark, [x + 0.62, 1.05, 3.39], 0.48, 0.28, 0.34);

    const branch = curve([[-1.95, 0.56, zIn], [0.38, 0.56, zIn], [x, 0.62, zIn], [x, 1.3, 0.3], [x, 1.84, 1.87],
      [x, 2.96, 1.56], [x, 4.17, 1.04], [x, 4.66, -0.69], [x, 5.09, -2.19]]);
    piping(group, branch, 0.185, ink(color, 0.29));
    const valvePosition = [x, 3.65, 1.26];
    piece(group, CYLINDER, ink(orange, 0.25), valvePosition, 0.57, 0.59, 0.57);
    piece(group, RING, warm, [x, 3.36, 1.26], 0.57, 0.57, 0.57).rotation.x = Math.PI / 2;
    piece(group, RING, warm, [x, 3.92, 1.26], 0.57, 0.57, 0.57).rotation.x = Math.PI / 2;
    const flap = piece(group, BOX, lit, valvePosition, 0.46, 0.05, 0.38);
    const dots = instances(group, BEAD, ink(color), 15, true);
    return { rotor, lamp, lit, off, flap, dots, branch, phase: 0 };
  });

  const manifold = curve([[1.77, 5.09, -2.19], [4.41, 5.09, -2.19], [5.63, 5.11, -2.19], [5.63, 6.12, -2.41],
    [5.63, 8.3, -2.7], [5.63, 9.36, -4.48], [5.63, 10.18, -5.88]]);
  piping(group, manifold, 0.255, ink(0x70efa9, 0.32));
  const couplers = instances(group, CYLINDER, iron, 4);
  for (let i = 0; i < couplers.count; i++) {
    frame(couplers, i, 5.63, 5.93 + i * 0.70, -2.40 - i * 0.096, 0.60, 0.12, 0.61);
  }
  const outletDots = instances(group, BEAD, ink(0xa3ffb5), 18, true);
  piece(group, CYLINDER, iron, [-0.28, 4.75, 3.67], 0.28, 0.74, 0.28);
  const alarm = piece(group, BEAD, warning, [-0.28, 5.25, 3.67], 0.73, 0.75, 0.73);
  const alarmRing = piece(group, RING, warning, [-0.28, 5.61, 3.67], 1.04, 1.04, 1.04);
  alarmRing.rotation.x = -Math.PI / 2;

  const stageFrames = {};
  for (const [id, position, size] of [
    ['inlet', [1.5, 5.5, -5.4], [11.2, 0.8, 2.05]],
    ['well', [-2.75, 2.2, 0.25], [5.98, 4.50, 7.7]],
    ['pumps', [3.1, 2.38, 1.82], [5.33, 3.52, 3.78]],
    ['outlet', [5.63, 7.65, -3.74], [0.86, 5.24, 4.72]],
  ]) {
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(BOX), new THREE.LineBasicMaterial({
      color: 0xffd174, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false,
    }));
    edge.position.set(...position);
    edge.scale.set(...size);
    edge.visible = false;
    group.add(edge);
    stageFrames[id] = edge;
  }

  const point = new THREE.Vector3();
  let fill = 0.54;
  let inletPhase = 0;
  let outletPhase = 0;

  function flow(dots, path, phase, rate, above = -Infinity) {
    for (let n = 0; n < dots.count; n++) {
      path.getPointAt((phase + n / dots.count) % 1, point);
      const size = rate > 0.01 && point.y >= above ? 0.10 + rate * 0.18 : 0;
      frame(dots, n, point.x, point.y, point.z, size, size * 1.44, size);
    }
    dots.instanceMatrix.needsUpdate = true;
  }

  function update(dt, elapsed, state, telemetry) {
    const fallback = state / 100;
    const inflow = telemetry?.inflow ?? 0.55;
    const main = telemetry?.main ?? fallback;
    const backup = telemetry?.backup ?? 0;
    const target = telemetry?.level ?? lerp(0.95, 0.14, fallback);
    fill = damp(fill, target, telemetry ? 9.5 : 0.82, dt);
    const level = 0.13 + fill * 4.06;
    water.scale.y = level;
    water.position.y = level / 2;
    surface.position.y = level;
    bar.scale.y = Math.max(0.005, fill * 3.85);
    bar.position.y = 0.26 + bar.scale.y / 2;
    for (let n = 0; n < ripples.count; n++) {
      const wave = elapsed * 1.37 + n * 0.51;
      const z = -2.95 + (wave % 6.42);
      frame(ripples, n, -2.75 + Math.sin(wave) * 0.64, level + 0.044, z,
        1.48 + Math.sin(wave) * 0.78, 0.02, 0.047, 0, Math.sin(wave) * 0.24);
    }
    ripples.instanceMatrix.needsUpdate = true;

    inletPhase += dt * (0.14 + inflow * 0.82);
    flow(incomingDots, inlet, inletPhase, inflow, level - 0.07);
    const intake = THREE.MathUtils.smoothstep(fill, 0.01, 0.12);
    const pumping = Math.min(1, (main + backup) * intake);
    for (const [index, pump] of pumps.entries()) {
      const power = index === 0 ? main : backup;
      const rate = power * intake;
      pump.rotor.rotation.z -= dt * power * 11;
      pump.lamp.material = power > 0.01 ? pump.lit : pump.off;
      pump.flap.rotation.z = damp(pump.flap.rotation.z, rate > 0.02 ? 1.23 : 0, 9, dt);
      pump.phase += dt * rate * 0.8;
      flow(pump.dots, pump.branch, pump.phase, rate);
    }
    outletPhase += dt * pumping * 0.87;
    flow(outletDots, manifold, outletPhase, pumping);

    const alarmActive = telemetry?.alarm ?? fill >= 0.72;
    alarm.visible = alarmRing.visible = alarmActive;
    warning.opacity = 0.52 + 0.38 * Math.abs(Math.sin(elapsed * 6.1));
    limit.material.color.setHex(alarmActive ? red : orange);
    alarmRing.scale.setScalar(1.1 + 0.62 * (0.5 + 0.5 * Math.sin(elapsed * 5.1)));
    for (const [id, edge] of Object.entries(stageFrames)) edge.visible = telemetry?.stage === id;
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
  let pumpTelemetry = null;
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

  function setPump(next) {
    if (!next) {
      pumpTelemetry = null;
      return;
    }
    const normalize = value => Number.isFinite(Number(value)) ? clamp(Number(value), 0, 1) : 0;
    pumpTelemetry = {
      level: normalize(next.level),
      inflow: normalize(next.inflow),
      main: normalize(next.main),
      backup: normalize(next.backup),
      alarm: Boolean(next.alarm),
      stage: next.stage,
    };
  }

  function update(dt, elapsed) {
    if (active !== null) cases[active].update(dt, elapsed, state, active === 'pump' ? pumpTelemetry : null);
  }

  return { setCase, setPump, update, setBuilding: cases.load.setBuilding };
}
