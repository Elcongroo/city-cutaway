import * as THREE from './vendor/three.module.js';

const TRACK_LIMIT = 16;
const TRAIN_Y = -5.1;
const TRAIN_Z = 5;
const RAIN_DURATION = 12;

const streetClipping = [
  new THREE.Plane(new THREE.Vector3(1, 0, 0), TRACK_LIMIT),
  new THREE.Plane(new THREE.Vector3(-1, 0, 0), TRACK_LIMIT),
];
const box = new THREE.BoxGeometry();
const round = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
const leaf = new THREE.IcosahedronGeometry(0.5, 0);
const droplet = new THREE.SphereGeometry(0.5, 8, 6);

function painted(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.58, ...options });
}

function movingPaint(color, options = {}) {
  return painted(color, { clippingPlanes: streetClipping, ...options });
}

function headlight(color, strength = 0.95) {
  return movingPaint(color, { emissive: color, emissiveIntensity: strength });
}

function batch(group) {
  const byMaterial = new Map();
  const instance = new THREE.Object3D();

  function add(material, position, size, geometry = box, rotation = [0, 0, 0]) {
    if (!byMaterial.has(material)) byMaterial.set(material, new Map());
    const byGeometry = byMaterial.get(material);
    if (!byGeometry.has(geometry)) byGeometry.set(geometry, []);
    instance.position.fromArray(position);
    instance.scale.fromArray(size);
    instance.rotation.set(...rotation);
    instance.updateMatrix();
    byGeometry.get(geometry).push(instance.matrix.clone());
  }

  function apply() {
    for (const [material, byGeometry] of byMaterial) {
      for (const [geometry, matrices] of byGeometry) {
        const meshes = new THREE.InstancedMesh(geometry, material, matrices.length);
        matrices.forEach((matrix, index) => meshes.setMatrixAt(index, matrix));
        meshes.computeBoundingSphere();
        group.add(meshes);
      }
    }
  }

  return { add, apply };
}

const tires = movingPaint(0x141922, { roughness: 0.9 });
const glass = movingPaint(0x263d58, { metalness: 0.3, roughness: 0.3 });
const bumpers = movingPaint(0x3a4b59, { metalness: 0.25 });
const headlights = headlight(0xffe8b5, 1.8);
const taillights = headlight(0xff6246, 1.2);

function makeCar(color, van = false) {
  const car = new THREE.Group();
  const { add, apply } = batch(car);
  const body = movingPaint(color, { metalness: 0.13 });
  const chassis = van ? 1.88 : 1.56;
  const halfWidth = van ? 0.41 : 0.36;
  const bonnetX = van ? 0.42 : 0.47;
  const cabinX = van ? -0.15 : -0.07;
  const roofY = van ? 0.77 : 0.57;
  const cabinLength = van ? 1.34 : 0.86;
  const cabinHeight = van ? 0.38 : 0.22;

  add(body, [0, 0.28, 0], [chassis, 0.27, halfWidth * 2]);
  add(body, [bonnetX, 0.44, 0], [0.45, 0.075, halfWidth * 1.93]);
  add(glass, [cabinX, roofY - cabinHeight * 0.5, 0], [cabinLength, cabinHeight, halfWidth * 1.82]);
  add(body, [cabinX - 0.02, roofY, 0], [cabinLength + 0.06, 0.065, halfWidth * 1.88]);
  add(bumpers, [chassis * 0.5, 0.25, 0], [0.055, 0.068, halfWidth * 1.92]);
  add(bumpers, [-chassis * 0.5, 0.25, 0], [0.055, 0.068, halfWidth * 1.92]);

  for (const side of [-1, 1]) {
    add(body, [cabinX, roofY - cabinHeight * 0.5, side * halfWidth * 0.93], [0.052, cabinHeight + 0.025, 0.033]);
    add(body, [bonnetX, roofY - cabinHeight, side * halfWidth], [0.13, 0.07, 0.11]);
    add(headlights, [chassis * 0.5 + 0.025, 0.34, side * halfWidth * 0.69], [0.03, 0.096, 0.14]);
    add(taillights, [-chassis * 0.5 - 0.019, 0.34, side * halfWidth * 0.72], [0.027, 0.075, 0.13]);
    for (const axle of [-1, 1]) {
      const x = chassis * 0.31 * axle;
      add(tires, [x, 0.18, side * halfWidth], [0.34, 0.14, 0.34], round, [Math.PI / 2, 0, 0]);
      add(bumpers, [x, 0.18, side * (halfWidth + 0.075)], [0.18, 0.022, 0.18], round, [Math.PI / 2, 0, 0]);
    }
  }

  apply();
  return car;
}

function makeTrain() {
  const train = new THREE.Group();
  train.scale.z = 1.26;
  const { add, apply } = batch(train);
  const body = movingPaint(0xc5d4df, { roughness: 0.44, metalness: 0.32 });
  const roof = movingPaint(0x899aa9, { metalness: 0.42 });
  const doors = movingPaint(0x9bafbd, { metalness: 0.4 });
  const stripe = movingPaint(0x27d6bd, { emissive: 0x27a38e, emissiveIntensity: 0.24 });
  const windowLight = headlight(0xffddb1, 0.68);
  const trainHeadlight = headlight(0xe0f8ff, 2.4);
  const cars = [-4.32, 0, 4.32];

  for (const cx of cars) {
    add(body, [cx, -0.10, 0], [4.16, 1.04, 1.24]);
    add(body, [cx, 0.47, 0], [4.08, 0.17, 1.18]);
    add(roof, [cx, 0.60, 0], [3.96, 0.12, 1.06]);
    add(roof, [cx - 0.88, 0.70, 0], [0.51, 0.11, 0.70]);
    add(roof, [cx + 0.88, 0.70, 0], [0.51, 0.11, 0.70]);
    add(bumpers, [cx, -0.64, 0], [3.92, 0.12, 0.95]);

    for (const sign of [-1, 1]) {
      add(stripe, [cx, -0.35, sign * 0.627], [4.15, 0.11, 0.035]);
      add(glass, [cx, 0.17, sign * 0.632], [3.90, 0.37, 0.03]);
      for (const x of [-1.57, -0.39, 0.39, 1.57]) {
        add(windowLight, [cx + x, 0.17, sign * 0.65], [0.60, 0.255, 0.018]);
        add(glass, [cx + x + 0.11, 0.17, sign * 0.664], [0.045, 0.25, 0.011]);
      }
      for (const x of [-0.98, 0.98]) {
        add(doors, [cx + x, -0.10, sign * 0.657], [0.47, 0.94, 0.04]);
        add(glass, [cx + x, -0.10, sign * 0.682], [0.024, 0.91, 0.012]);
        for (const panel of [-1, 1]) {
          add(windowLight, [cx + x + 0.10 * panel, 0.22, sign * 0.682], [0.12, 0.23, 0.012]);
        }
      }
      for (const x of [-1.48, -1.10, 1.10, 1.48]) {
        add(tires, [cx + x, -0.69, sign * 0.585], [0.38, 0.11, 0.38], round, [Math.PI / 2, 0, 0]);
      }
    }
  }

  for (const x of [-2.16, 2.16]) add(bumpers, [x, -0.07, 0], [0.25, 0.82, 0.78]);

  for (const sign of [-1, 1]) {
    const front = sign * (cars[2] + 2.08);
    add(glass, [front, 0.225, 0], [0.075, 0.41, 1.05]);
    add(stripe, [front, -0.38, 0], [0.075, 0.11, 1.08]);
    add(roof, [front + sign * 0.055, -0.58, 0], [0.15, 0.09, 0.93]);
    for (const z of [-0.37, 0.37]) {
      add(sign === 1 ? trainHeadlight : taillights, [front + sign * 0.065, -0.20, z], [0.039, 0.105, 0.145]);
    }
    add(trainHeadlight, [front + sign * 0.040, 0.489, 0], [0.032, 0.059, 0.35]);
  }

  apply();
  return train;
}

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function makeGarden() {
  const group = new THREE.Group();
  group.position.set(9.5, 0.13, 4.63);
  const { add, apply } = batch(group);
  const edging = painted(0x7c9283);
  const loam = painted(0x253e35);
  const grating = painted(0x4d655b);
  const stems = painted(0x378964);
  const leaves = [painted(0x58a57b), painted(0x7ebb75), painted(0xb1c886)];
  const flowers = [painted(0xffd18d), painted(0xf2a7c5)];

  add(loam, [0, 0.005, 0], [3.17, 0.10, 1.40]);
  for (const side of [-1, 1]) {
    add(edging, [0, 0.06, side * 0.72], [3.25, 0.20, 0.14]);
    add(edging, [side * 1.62, 0.06, 0], [0.14, 0.20, 1.55]);
  }
  add(grating, [1.34, 0.08, -0.54], [0.24, 0.12, 0.31]);

  const random = seededRandom(84);
  for (let index = 0; index < 25; index += 1) {
    const x = -1.43 + random() * 2.85;
    const z = -0.56 + random() * 1.12;
    if (x > 0.68 && z < -0.16) continue;
    const height = 0.16 + random() * 0.31;
    add(stems, [x, height * 0.48, z], [0.045, height, 0.045], round);
    for (const side of [-1, 1]) {
      add(leaves[index % leaves.length], [x + 0.078 * side, height * 0.69, z], [0.25, 0.075, 0.14], leaf, [0.4, index, side * 0.48]);
    }
    if (index % 3 === 0) {
      add(flowers[index % flowers.length], [x, height, z], [0.18, 0.09, 0.15], leaf);
    }
  }
  apply();
  return group;
}

function makeRain() {
  const count = 760;
  const random = seededRandom(331);
  const paths = new Float32Array(count * 4);
  const positions = new Float32Array(count * 6);
  const attr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const geometry = new THREE.BufferGeometry().setAttribute('position', attr);
  const material = new THREE.LineBasicMaterial({
    color: 0x91d9ff, transparent: true, opacity: 0.56, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;

  for (let index = 0; index < count; index += 1) {
    paths[index * 4] = -15.4 + random() * 31.6;
    paths[index * 4 + 1] = -7.8 + random() * 15.6;
    paths[index * 4 + 2] = random();
    paths[index * 4 + 3] = 0.52 + random() * 0.74;
  }

  function update(elapsed) {
    for (let index = 0; index < count; index += 1) {
      const from = index * 4;
      const to = index * 6;
      const travel = (elapsed * 0.68 + paths[from + 2]) % 1;
      const x = paths[from] - travel * 1.27;
      const y = 14.7 * (1 - travel);
      const z = paths[from + 1];
      positions[to] = x;
      positions[to + 1] = y + 0.07;
      positions[to + 2] = z;
      positions[to + 3] = x + 0.13 * paths[from + 3];
      positions[to + 4] = y + paths[from + 3];
      positions[to + 5] = z;
    }
    attr.needsUpdate = true;
  }

  return { lines, update };
}

function pathFrom(points) {
  const path = new THREE.CurvePath();
  for (let i = 1; i < points.length; i += 1) {
    path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i - 1]), new THREE.Vector3(...points[i])));
  }
  return path;
}

function makeWaterPath(scene, points, count, color, radius = 0.052) {
  const path = pathFrom(points);
  const group = new THREE.Group();
  const stream = new THREE.Mesh(
    new THREE.TubeGeometry(path, 80, radius, 6, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.47, depthWrite: false, toneMapped: false }),
  );
  const water = new THREE.InstancedMesh(droplet, new THREE.MeshBasicMaterial({ color: 0x9bf0ff, toneMapped: false }), count);
  const sample = new THREE.Vector3();
  const instance = new THREE.Object3D();
  water.frustumCulled = false;
  water.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(stream, water);
  scene.add(group);

  function update(visible, rainTime, speed, delay = 0) {
    group.visible = visible && rainTime >= delay;
    if (!group.visible) return;

    const time = rainTime - delay;
    const travel = time * speed;
    for (let index = 0; index < count; index += 1) {
      const distance = travel - index / count;
      const progress = distance < 0 ? 0 : distance % 1;
      path.getPoint(progress, sample);
      instance.position.copy(sample);
      instance.scale.setScalar(distance < 0 ? 0 : 0.14 + (index % 4) * 0.048);
      instance.updateMatrix();
      water.setMatrixAt(index, instance.matrix);
    }
    stream.material.opacity = Math.min(0.56, time * 0.48);
    water.instanceMatrix.needsUpdate = true;
  }

  return update;
}

export function createMotion(scene) {
  const roadCars = [
    [0xd35838, -14, 2.34, 1, false], [0xeab55e, -3.5, 2.34, 1, true], [0x5dc3bb, 9, 2.34, 1, false],
    [0xadc8d9, -12, 1.95, -1, true], [0x578fc5, 0, 1.95, -1, false], [0xd67b58, 12, 1.95, -1, false],
  ].map(([color, start, speed, heading, van]) => {
    const model = makeCar(color, van);
    model.rotation.y = heading === 1 ? 0 : Math.PI;
    scene.add(model);
    return { model, start, speed, heading };
  });

  const train = makeTrain();
  const garden = makeGarden();
  const rain = makeRain();
  scene.add(train, garden, rain.lines);
  garden.visible = false;
  rain.lines.visible = false;

  const roofFlow = makeWaterPath(scene, [
    [12.26, 5.79, -3.65], [13.39, 5.75, -3.65], [13.49, 5.66, -3.61], [13.51, 0.19, -3.56],
    [13.51, 0.16, -2.48], [13.24, 0.095, 1.94], [12.8, 0.095, 2.22],
  ], 13, 0x4dc8fb);
  const curbFlow = makeWaterPath(scene, [
    [-4.5, 0.091, 2.25], [2.1, 0.091, 2.25], [8.8, 0.091, 2.25], [12.8, 0.091, 2.25],
  ], 18, 0x62d6ff);
  const drainIntake = makeWaterPath(scene, [
    [12.8, 0.113, 2.25], [12.8, 0.216, 2.46], [12.8, 0.176, 7.69],
    [12.8, 0.15, 8.1], [12.8, -1.96, 8.1], [12.8, -2.04, 8.115],
  ], 11, 0x54b7f6, 0.055);
  const drainFlow = makeWaterPath(scene, [
    [12.8, -2.04, 8.115], [-14.8, -2.04, 8.115],
  ], 17, 0x58ccff, 0.062);
  const gardenFlow = makeWaterPath(scene, [
    [12.8, 0.091, 2.25], [11.38, 0.104, 2.25], [11.18, 0.216, 2.49], [10.85, 0.17, 3.73],
    [10.84, 0.335, 4.05], [10.32, 0.244, 4.45], [9.88, 0.245, 4.63],
  ], 13, 0x36ddba, 0.065);
  const gardenOverflow = makeWaterPath(scene, [
    [12.8, -2.04, 8.115], [-14.8, -2.04, 8.115],
  ], 5, 0x459bbb, 0.028);

  let rainActive = false;
  let gardenActive = false;
  let rainTime = 0;

  function update(dt, elapsed, depth) {
    for (const { model, start, speed, heading } of roadCars) {
      const distance = (start + 54 + elapsed * speed) % 36;
      model.position.set((distance - 18) * heading, 0.035, heading * 1.05);
    }

    const trainX = ((elapsed * 2.64 + 19.25) % 46) - 23;
    const tunnelReveal = THREE.MathUtils.clamp((depth - 7.2) / 7, 0, 1);
    train.position.set(trainX, -3.22 + (TRAIN_Y + 3.22) * tunnelReveal, TRAIN_Z);
    train.visible = tunnelReveal > 0.001;
    train.scale.y = Math.max(tunnelReveal, 0.001);

    rain.lines.visible = rainActive;
    if (rainActive) {
      rainTime += dt;
      rain.update(rainTime);
    }
    roofFlow(rainActive, rainTime, 0.24, 0.5);
    curbFlow(rainActive, rainTime, 0.27, 1.45);
    drainIntake(rainActive && !gardenActive && depth >= 7.2, rainTime, 0.47, 3.65);
    drainFlow(rainActive && !gardenActive && depth >= 7.2, rainTime, 0.26, 5.1);
    gardenFlow(rainActive && gardenActive, rainTime, 0.43, 3.65);
    gardenOverflow(rainActive && gardenActive && depth >= 7.2, rainTime, 0.19, 6.3);
  }

  function setRain(active) {
    if (active === rainActive) return;
    rainActive = active;
    rainTime = 0;
  }

  function setGarden(active) {
    gardenActive = active;
    garden.visible = active;
  }

  function replay() {
    rainTime = 0;
  }

  function getTrainPosition(target) {
    target.copy(train.position);
    target.x = THREE.MathUtils.clamp(target.x, -14, 14);
    return target;
  }

  function getPhase() {
    return Math.min(rainTime / RAIN_DURATION, 1);
  }

  update(0, 0, 18);
  return { update, setRain, setGarden, replay, getTrainPosition, getPhase };
}
