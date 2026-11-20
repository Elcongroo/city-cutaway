import * as THREE from './vendor/three.module.js';
import { coastX, groundY, riverRadius, riverZ } from './coast-terrain.js';

const { clamp, lerp, smoothstep } = THREE.MathUtils;
const seaLevel = 0.16;
const outer = { left: -235, right: 235, back: -164, front: 128 };
const inner = { left: -125, right: 125, back: -75, front: 75 };
const lowerIsles = [
  [169, -117, 18, 12, 36],
  [193, -105, 12, 9, 43],
  [213, -129, 15, 10, 48],
];
const ridges = [
  [-185, -99, 26, 37, 53],
  [-159, -125, 29, 33, 41],
  [-119, -119, 34, 25, 46],
  [-92, -148, 27, 20, 49],
  [-202, -38, 23, 30, 44],
  [-178, 38, 30, 20, 22],
  [-148, 91, 30, 25, 14],
];
const builtZones = [
  [-37, -113, 69, 61, 0.53],
  [28, -125, 52, 44, 0.58],
  [38, 93, 56, 29, 0.31],
];
const shade = {
  meadow: new THREE.Color('#789467'),
  bright: new THREE.Color('#96a467'),
  forest: new THREE.Color('#566f5f'),
  crest: new THREE.Color('#a7ada3'),
  rock: new THREE.Color('#879495'),
  shore: new THREE.Color('#b9a982'),
  mud: new THREE.Color('#7e8370'),
  urban: new THREE.Color('#899593'),
  deep: new THREE.Color('#4d6265'),
};
const boxGeometry = new THREE.BoxGeometry();
const coneGeometry = new THREE.ConeGeometry(1, 1, 6);
const ridgeGeometry = new THREE.CylinderGeometry(0.35, 1, 1, 5, 1);
const prowGeometry = new THREE.CylinderGeometry(0.8, 1, 1, 3, 1);
const glassGeometry = new THREE.PlaneGeometry();

function mound(x, z, [px, pz, sx, sz, height]) {
  const dx = (x - px) / sx;
  const dz = (z - pz) / sz;
  return Math.exp(-dx * dx - dz * dz) * height;
}

function outsideBlend(x, z) {
  const distance = Math.max(inner.left - x, x - inner.right, inner.back - z, z - inner.front);
  return smoothstep(distance, 0, 32);
}

function shoreDistance(x, z) {
  return Math.min(coastX(z) - x, Math.abs(z - riverZ(x)) - riverRadius(x));
}

function elevation(x, z) {
  const base = groundY(x, z);
  const blend = outsideBlend(x, z);
  if (blend === 0) return base;
  const shore = shoreDistance(x, z);
  if (shore <= 0) {
    const island = Math.max(...lowerIsles.map(profile => mound(x, z, profile)));
    return base + blend * island;
  }
  const peak = Math.max(...ridges.map(profile => mound(x, z, profile)));
  const rough = Math.sin(x * 0.24 + z * 0.27) * 1.3 + Math.sin(x * 0.54 - z * 0.31) * 0.8;
  const bankFade = smoothstep(shore, 1.6, 14.5);
  return base + blend * bankFade * (peak + rough * smoothstep(peak, 3, 23));
}

function groundColor(color, x, z, y) {
  const shore = shoreDistance(x, z);
  const blend = outsideBlend(x, z);
  if (shore <= 0 && y <= seaLevel) {
    return color.copy(shade.mud).lerp(shade.forest, smoothstep(-shore, 0, 12));
  }
  const texture = Math.sin(x * 0.17 + z * 0.09) * Math.cos(z * 0.19)
    + Math.sin(x * 0.059 + z * 0.056) * 0.58 + Math.cos(x * 0.41 - z * 0.29) * 0.17;
  color.copy(shade.meadow);
  if (texture >= 0) color.lerp(shade.bright, clamp(texture * 0.54, 0, 0.86));
  else color.lerp(shade.forest, clamp(-texture * 0.5, 0, 0.74));
  const innerUrban = smoothstep(x, -64, -45) * (1 - smoothstep(x, 47, 63))
    * (1 - smoothstep(Math.abs(z - 10), 53, 68));
  const outerUrban = Math.max(...builtZones.map(profile => mound(x, z, profile)));
  color.lerp(shade.urban, lerp(innerUrban * 0.5, outerUrban, blend));
  const gradient = Math.hypot(
    elevation(x + 0.6, z) - elevation(x - 0.6, z),
    elevation(x, z + 0.6) - elevation(x, z - 0.6),
  ) / 1.2;
  color.lerp(shade.rock, smoothstep(gradient, 0.23, 0.91) * smoothstep(y, 3, 24));
  color.lerp(shade.crest, smoothstep(y, 23, 43) * 0.66);
  const bank = shore < 0 ? smoothstep(y, seaLevel, seaLevel + 3) : smoothstep(shore, 0.3, 4.15);
  return color.lerp(shade.shore, (1 - bank) * 0.83);
}

const strips = [
  [outer.left, inner.left, outer.back, inner.back, 27, 20],
  [inner.left, inner.right, outer.back, inner.back, 218, 20],
  [inner.right, outer.right, outer.back, inner.back, 30, 20],
  [outer.left, inner.left, inner.back, inner.front, 27, 134],
  [inner.right, outer.right, inner.back, inner.front, 30, 134],
  [outer.left, inner.left, inner.front, outer.front, 27, 13],
  [inner.left, inner.right, inner.front, outer.front, 218, 13],
  [inner.right, outer.right, inner.front, outer.front, 30, 13],
];

function landscape(group) {
  const positions = [];
  const colors = [];
  const indices = [];
  const color = new THREE.Color();
  for (const [left, right, back, front, cols, rows] of strips) {
    const start = positions.length / 3;
    for (let row = 0; row <= rows; row++) {
      const z = lerp(back, front, row / rows);
      for (let col = 0; col <= cols; col++) {
        const x = lerp(left, right, col / cols);
        const y = elevation(x, z);
        positions.push(x, y, z);
        groundColor(color, x, z, y);
        colors.push(color.r, color.g, color.b);
        if (col < cols && row < rows) {
          const a = start + row * (cols + 1) + col;
          const b = a + cols + 1;
          indices.push(a, b, b + 1, a, b + 1, a + 1);
        }
      }
    }
  }
  const meshGeometry = new THREE.BufferGeometry();
  meshGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  meshGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  meshGeometry.setIndex(indices);
  meshGeometry.computeVertexNormals();
  group.add(new THREE.Mesh(meshGeometry, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.96,
  })));

  const walls = [];
  const sides = [
    [outer.left, outer.back, outer.right, outer.back],
    [outer.right, outer.back, outer.right, outer.front],
    [outer.right, outer.front, outer.left, outer.front],
    [outer.left, outer.front, outer.left, outer.back],
  ];
  for (const [x0, z0, x1, z1] of sides) {
    const parts = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 4.1);
    for (let part = 0; part < parts; part++) {
      const a = part / parts;
      const b = (part + 1) / parts;
      const x = lerp(x0, x1, a), z = lerp(z0, z1, a);
      const nx = lerp(x0, x1, b), nz = lerp(z0, z1, b);
      const y = Math.max(elevation(x, z), seaLevel - 0.03);
      const ny = Math.max(elevation(nx, nz), seaLevel - 0.03);
      walls.push(x, y, z, x, -7, z, nx, ny, nz, nx, ny, nz, x, -7, z, nx, -7, nz);
    }
  }
  const wallsGeometry = new THREE.BufferGeometry();
  wallsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(walls, 3));
  wallsGeometry.computeVertexNormals();
  group.add(new THREE.Mesh(wallsGeometry, new THREE.MeshStandardMaterial({
    color: shade.deep, roughness: 1, side: THREE.DoubleSide,
  })));
}

function createOuterWater(group) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      flowTime: { value: 0 },
      night: { value: 0 },
      shallows: { value: new THREE.Color('#66b8b0') },
      riverBlue: { value: new THREE.Color('#337d91') },
      oceanBlue: { value: new THREE.Color('#295b83') },
      shimmer: { value: new THREE.Color('#a1e2e1') },
    },
  ]);
  const water = new THREE.ShaderMaterial({
    fog: true,
    uniforms,
    vertexShader: `
      varying vec2 waterXZ;
      #include <fog_pars_vertex>
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        waterXZ = (modelMatrix * vec4(position, 1.0)).xz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      varying vec2 waterXZ;
      uniform float flowTime;
      uniform float night;
      uniform vec3 shallows;
      uniform vec3 riverBlue;
      uniform vec3 oceanBlue;
      uniform vec3 shimmer;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = waterXZ;
        float mouth = (p.y - 22.0) / 16.0;
        float c = 79.0 + 7.5 * sin((p.y + 6.0) / 16.0) + 7.0 * sin((p.y + 28.0) / 37.0)
          - 32.0 * exp(-mouth * mouth);
        float riverZ = 9.0 + 13.0 * sin(p.x / 53.0) + 6.0 * sin(p.x / 19.0);
        float width = 6.45 + 1.2 * sin(p.x / 38.0 + 1.0) + 3.4 * smoothstep(28.0, 90.0, p.x);
        float bay = p.x - c;
        float bank = max(width - abs(p.y - riverZ), bay);
        float openWater = smoothstep(-6.0, 36.0, bay);
        vec3 base = mix(shallows, mix(riverBlue, oceanBlue, openWater), smoothstep(-0.1, 8.5 + 6.0 * openWater, bank));
        float longWave = sin(dot(p, vec2(0.22, 0.61)) + sin(p.x * 0.23 + flowTime * 0.47) * 0.70 - flowTime * 0.73);
        float wave = sin(dot(p, vec2(-1.11, 2.53)) + longWave * 0.69 + p.x * 0.045 - flowTime * 1.12);
        float mask = 0.53 + 0.47 * sin(p.x * 0.71 + p.y * 0.35 + longWave * 0.51 + flowTime * 0.14);
        float ridge = smoothstep(0.8, 1.0, wave) * mask * (0.26 + 0.74 * smoothstep(-0.45, 0.87, longWave));
        float edge = (1.0 - smoothstep(0.04, 1.5, abs(bank - 0.45))) * (0.21 + 0.19 * longWave);
        base = mix(base * (1.01 + longWave * 0.065), shimmer, ridge * 0.27 + edge * 0.49);
        base *= mix(vec3(1.0), vec3(0.36, 0.57, 0.75), night);
        gl_FragColor = vec4(base, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  const positions = [];
  for (const [left, right, back, front] of [
    [outer.left, outer.right, outer.back, inner.back],
    [outer.left, inner.left, inner.back, inner.front],
    [inner.right, outer.right, inner.back, inner.front],
    [outer.left, outer.right, inner.front, outer.front],
  ]) {
    positions.push(left, seaLevel, back, left, seaLevel, front, right, seaLevel, front);
    positions.push(left, seaLevel, back, right, seaLevel, front, right, seaLevel, back);
  }
  const waterGeometry = new THREE.BufferGeometry();
  waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  group.add(new THREE.Mesh(waterGeometry, water));
  return uniforms;
}

const material = (color, details = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.82, ...details,
});

function createBatches(group) {
  const batches = new Map();
  const dummy = new THREE.Object3D();
  const axis = new THREE.Vector3(0, 1, 0);
  function store(shape, paint) {
    let shapes = batches.get(paint);
    if (!shapes) batches.set(paint, shapes = new Map());
    let matrices = shapes.get(shape);
    if (!matrices) shapes.set(shape, matrices = []);
    dummy.updateMatrix();
    matrices.push(dummy.matrix.clone());
  }
  function box(paint, x, y, z, w, h, l, yaw = 0, shape = boxGeometry) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(w, h, l);
    store(shape, paint);
  }
  function beam(paint, from, to, width, length = width) {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const displacement = end.clone().sub(start);
    dummy.position.addVectors(start, end).multiplyScalar(0.5);
    dummy.quaternion.setFromUnitVectors(axis, displacement.clone().normalize());
    dummy.scale.set(width, displacement.length(), length);
    store(boxGeometry, paint);
  }
  function pane(paint, x, y, z, w, h, yaw) {
    box(paint, x, y, z, w, h, 1, yaw, glassGeometry);
  }
  function flush() {
    for (const [paint, shapes] of batches) {
      for (const [shape, matrices] of shapes) {
        const mesh = new THREE.InstancedMesh(shape, paint, matrices.length);
        matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
      }
    }
    batches.clear();
  }
  return { box, beam, pane, flush };
}

function route(routes, points, width, paint, offset = 0) {
  if (!routes.has(paint)) routes.set(paint, []);
  const strips = routes.get(paint);
  for (let segment = 0; segment < points.length - 1; segment++) {
    const [ax, az, ay] = points[segment];
    const [bx, bz, by] = points[segment + 1];
    const steps = Math.ceil(Math.hypot(ax - bx, az - bz) / 3.2);
    const stride = new THREE.Vector2(bx - ax, bz - az).normalize();
    const sample = (t, side) => {
      const x = lerp(ax, bx, t) - stride.y * width / 2 * side;
      const z = lerp(az, bz, t) + stride.x * width / 2 * side;
      const y = ay !== undefined && by !== undefined ? lerp(ay, by, t) : elevation(x, z) + 0.17;
      return [x, y + offset, z];
    };
    for (let step = 0; step < steps; step++) {
      const a = step / steps, b = (step + 1) / steps;
      const left = sample(a, -1), nextLeft = sample(b, -1);
      const right = sample(a, 1), nextRight = sample(b, 1);
      strips.push(...left, ...right, ...nextLeft, ...nextLeft, ...right, ...nextRight);
    }
  }
}

function populateDistricts(group) {
  const { box, beam, pane, flush } = createBatches(group);
  const routes = new Map();
  let seed = 47193;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const façade = [0x79969c, 0x65818a, 0x97a3a0, 0xb1a795, 0xc0b49a, 0x73868a].map(color => material(color));
  const roof = [0x69787b, 0x877569, 0x52666d].map(color => material(color));
  const glass = material(0x648c9d, { emissive: 0x0d3d55, emissiveIntensity: 0.2, side: THREE.DoubleSide });
  const roomLights = material(0xf5d894, { emissive: 0xddab67, emissiveIntensity: 0.3, side: THREE.DoubleSide });
  const concrete = material(0xa7aea1);
  const asphalt = material(0x46545e, { side: THREE.DoubleSide });
  const roadEdge = material(0x88948d, { side: THREE.DoubleSide });
  const rail = material(0xa6a99a, { side: THREE.DoubleSide });
  const finish = material(0x637f83, { metalness: 0.25 });
  const beacon = material(0xf3b965, { emissive: 0xff9740, emissiveIntensity: 0.5 });
  const canopy = [0x4d7858, 0x5d855d, 0x78905d].map(color => material(color));
  const steel = material(0x707e84);
  const choose = array => array[Math.floor(random() * array.length)];
  const roadways = [
    [[-56, -55], [-62, -72], [-67, -96], [-67, -125], [-65, -154]],
    [[28, -59], [34, -74], [36, -103], [48, -135], [49, -160]],
    [[-73, -117], [-49, -117], [-28, -117], [-1, -117], [22, -117], [50, -117], [69, -114]],
    [[-71, -83], [-40, -83], [-15, -83], [11, -83], [37, -83], [71, -83]],
    [[-71, -141], [-40, -141], [-18, -141], [8, -141], [28, -141], [42, -140], [62, -136]],
    [[51, 69], [52, 83], [55, 104], [54, 119], [14, 119], [-15, 116], [-51, 103], [-82, 96]],
    [[-112, 67], [-126, 80], [-155, 91], [-186, 85], [-198, 56], [-205, 29]],
  ];
  roadways.forEach(points => {
    route(routes, points, 5.1, roadEdge);
    route(routes, points, 3.8, asphalt, 0.035);
  });
  for (const x of [-47, -27, -7, 13, 27, 61]) {
    route(routes, [[x, -149], [x, -119], [x, -84]], 2.1, asphalt);
  }
  for (const z of [-104, -132]) route(routes, [[-64, z], [-35, z], [32, z], [62, z]], 1.9, asphalt);

  function tower(x, z, width, length, height) {
    if (elevation(x, z) <= seaLevel + 0.2) return;
    const y = elevation(x, z) + 0.12;
    const podium = Math.min(3.0, height * 0.26);
    const base = choose(façade);
    box(concrete, x, y - 0.15, z, width + 1.35, 0.34, length + 1.25);
    box(choose(roof), x, y + podium / 2, z, width + 0.76, podium, length + 0.84);
    const setback = height > 21 ? height * (0.70 + random() * 0.16) : height;
    const mainHeight = setback - podium;
    box(base, x, y + podium + mainHeight / 2, z, width, mainHeight, length);
    if (setback < height) {
      box(choose(façade), x + width * 0.08, y + setback + (height - setback) / 2,
        z - length * 0.05, width * 0.72, height - setback, length * 0.69);
    }
    box(choose(roof), x, y + height + 0.16, z, width * 0.54, 0.32, length * 0.64);
    if (height > 27) box(steel, x, y + height + 1.25, z, 0.17, 2.3, 0.17);
    const bands = Math.min(11, Math.max(3, Math.floor(mainHeight / 2.15)));
    for (let band = 0; band < bands; band++) {
      const row = y + podium + (band + 0.59) / bands * mainHeight;
      const paint = random() > 0.73 ? roomLights : glass;
      pane(paint, x, row, z + length * 0.5 + 0.013, width * 0.83, mainHeight / bands * 0.46, 0);
      pane(paint, x + width * 0.5 + 0.013, row, z, length * 0.81, mainHeight / bands * 0.46, Math.PI / 2);
      pane(glass, x, row, z - length * 0.5 - 0.013, width * 0.78, mainHeight / bands * 0.42, Math.PI);
      if (paint === roomLights) {
        pane(glass, x - width * 0.5 - 0.013, row, z, length * 0.81, mainHeight / bands * 0.38, -Math.PI / 2);
      }
    }
  }

  for (const z of [-91, -99, -110, -125, -137, -150]) {
    for (const column of [-58, -39, -19, 2, 20, 43, 54, 67]) {
      const x = column + (random() - 0.5) * 2;
      if (Math.abs(x - 1) < 18 && z < -109 && z > -135) continue;
      const focal = Math.exp(-Math.pow((x + 8) / 49, 2) - Math.pow((z + 118) / 39, 2));
      const height = 8.5 + 10 * focal + random() * 17 * focal + random() * 7;
      const width = 5.5 + random() * 2.4, length = 5.0 + random() * 2.5;
      tower(x, z, width, length, height);
      if (random() > 0.24) tower(x + 8.4, z - 0.4, 4.1 + random() * 2, 4.4 + random(), 5 + random() * 12);
    }
  }

  // The civic towers have separate elevator cores and an original elevated public crossing.
  const landmarkZ = -122.5;
  const floors = [4.2, 3.6, 3.15, 2.76];
  for (const [side, maxHeight] of [[-1, 57], [1, 48]]) {
    const coreX = 1 + side * 9.2;
    const baseY = elevation(coreX, landmarkZ) + 0.38;
    box(concrete, coreX, baseY + 0.26, landmarkZ, 14, 0.52, 15.3);
    for (let tier = 0; tier < floors.length; tier++) {
      const width = floors[tier] * 2.65;
      const step = maxHeight / floors.length;
      const x = coreX + side * tier * 0.87;
      const y = baseY + (tier + 0.5) * step;
      box(tier % 2 ? finish : façade[0], x, y, landmarkZ, width, step + 0.02, width * 0.85);
      box(glass, x - width * 0.19, y, landmarkZ + width * 0.431, width * 0.56, step * 0.79, 0.14);
      for (const strip of [-1, 1]) {
        box(concrete, x + strip * width * 0.425, y, landmarkZ + width * 0.44, 0.22, step, 0.19);
      }
      for (let row = 0; row < 5; row++) {
        pane(row % 3 === 0 ? roomLights : glass, x, y + (row - 2) * step / 5.5,
          landmarkZ + width * 0.436, width * 0.70, 0.41, 0);
      }
    }
    box(beacon, coreX + side * 2.65, baseY + maxHeight + 0.17, landmarkZ, 0.38, 0.33, 0.38);
  }
  const bridgeBase = elevation(1, landmarkZ) + 31.4;
  box(concrete, 1, bridgeBase, landmarkZ, 24, 0.65, 5.3);
  box(glass, 1, bridgeBase + 1.3, landmarkZ, 22.4, 2.4, 4.4);
  box(beacon, 1, bridgeBase + 0.12, landmarkZ + 2.53, 23, 0.14, 0.17);
  for (const side of [-1, 1]) {
    beam(concrete, [1 + side * 0.35, bridgeBase + 3.7, landmarkZ + 2.52],
      [1 + side * 10.8, bridgeBase + 0.31, landmarkZ + 2.52], 0.28);
  }

  // The lower edge is deliberately modest so the main cutaway remains visible behind it.
  for (const z of [80, 88, 100, 109]) {
    for (const x of [-55, -42, -27, -11, 4, 19, 35]) {
      if (x >= -26 && x <= 32 && z <= 91) continue;
      const y = elevation(x, z);
      if (y <= seaLevel + 0.35) continue;
      const length = 4.1 + random() * 3.7;
      const width = 4.1 + random() * 3.2;
      const height = 2.2 + random() * 4.1;
      box(choose(façade), x, y + height * 0.5, z, width, height, length);
      box(choose(roof), x, y + height + 0.55, z, width * 0.70, 1.04, length * 0.65, Math.PI * 0.125, ridgeGeometry);
      pane(roomLights, x, y + height * 0.53, z + length * 0.5 + 0.01, width * 0.69, 0.57, 0);
    }
  }
  for (const x of [42, 64, 73]) {
    for (const z of [87, 96, 109]) {
      const y = elevation(x, z);
      if (y <= seaLevel + 0.42) continue;
      box(choose(façade), x, y + 2.25, z, 12.1, 4.5, 5.2);
      box(choose(roof), x, y + 4.59, z, 12.35, 0.18, 5.58);
      box(finish, x + 1.6, y + 4.89, z, 5, 0.15, 2.3);
      pane(glass, x, y + 2.65, z + 2.61, 8.6, 0.56, 0);
    }
  }

  const guides = [[68, -70, 3.2], [69, -94, 3.2], [74, -116, 3.2], [66, -149, 3.2]];
  route(routes, guides, 2.8, concrete);
  for (const offset of [-0.71, 0.71]) {
    route(routes, guides.map(([x, z, y]) => [x + offset, z, y + 0.14]), 0.22, rail);
  }
  for (const [ax, az, h] of guides) {
    const base = elevation(ax, az);
    if (h > base + 0.32) box(concrete, ax, (base + h) / 2, az, 1, h - base, 1);
  }
  for (let i = 1; i < 21; i++) {
    const f = i / 22;
    const x = lerp(69, 71, f), z = lerp(-72, -142, f), h = 3.24;
    const base = elevation(x, z);
    if (h > base + 0.3) box(concrete, x, (base + h) / 2, z, 0.64, h - base, 0.81);
  }
  const freightY = elevation(61, 119) + 0.29;
  for (let row = 0; row < 3; row++) {
    for (let part = 0; part < 7; part++) {
      const x = 58 + part * 3.06, z = 112 + row * 2.5;
      if (elevation(x, z) < seaLevel + 0.35) continue;
      box(choose(façade), x, Math.max(freightY, elevation(x, z) + 0.22) + 0.55, z, 2.88, 1.1, 1.63);
    }
  }

  for (let index = 0; index < 153; index++) {
    const x = lerp(-218, -77, random()), z = lerp(-146, 110, random());
    if (x > inner.left && z > inner.back && z < inner.front) continue;
    const y = elevation(x, z);
    if (y < 1.2 || Math.abs(z - riverZ(x)) < riverRadius(x) + 1.5) continue;
    const height = 1.4 + random() * 3.15;
    box(choose(canopy), x, y + height * 0.51, z, height * 0.37, height, height * 0.39, random(), coneGeometry);
  }
  for (const [paint, positions] of routes) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    group.add(new THREE.Mesh(geometry, paint));
  }
  flush();
  return { roomLights, glass, beacon };
}

function vessel(scene, paints, index) {
  const model = new THREE.Group();
  scene.add(model);
  const { box, flush } = createBatches(model);
  const size = index === 1 ? 1.23 : index === 3 ? 0.65 : 1;
  const length = index % 2 ? 15.8 * size : 12.8 * size;
  const width = 3.45 * size;
  box(paints.hull, 0, 0.59, 0, width, 1.23, length);
  box(paints.deck, 0, 1.21, 0, width * 0.90, 0.17, length * 0.91);
  box(paints.hull, 0, 0.46, length * 0.5, width * 0.57, 1.02, width * 0.55, 0, prowGeometry);
  box(paints.deck, 0, 1.37, length * 0.31, width * 0.75, 0.31, width * 0.96);
  box(paints.top, 0, 2.02, -length * 0.33, width * 0.78, 1.6, length * 0.17);
  box(paints.glass, 0, 2.25, -length * 0.235, width * 0.69, 0.44, 0.065);
  box(paints.light, -width * 0.37, 2.2, length * 0.33, 0.23, 0.22, 0.32);
  box(paints.light, width * 0.37, 2.2, -length * 0.33, 0.23, 0.22, 0.32);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      const z = -length * 0.185 + row * length * 0.128;
      box(paints.cargo[(row + col + index) % paints.cargo.length], (col - 1) * width * 0.263,
        1.72 + 0.12 * ((row + col) % 2), z, width * 0.246, 0.87, length * 0.117);
    }
  }
  const wake = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), paints.wake);
  wake.rotation.x = -Math.PI / 2;
  wake.scale.set(width * 1.75, size * 8.7, 1);
  wake.position.set(0, 0.178, -length * 0.75);
  model.add(wake);
  flush();
  return model;
}

export function createCoastExpansion(scene) {
  const group = new THREE.Group();
  group.name = 'Continuous metropolitan approaches and outer bay';
  scene.add(group);
  landscape(group);
  const water = createOuterWater(group);
  const districts = populateDistricts(group);
  const shipPaint = {
    hull: material(0x384e62),
    deck: material(0x76918c),
    top: material(0xe4cfad),
    glass: material(0x386982),
    cargo: [0xbb7c51, 0xd8a067, 0x487d91, 0x82a29b].map(color => material(color)),
    light: material(0xfac775, { emissive: 0xfe9c37, emissiveIntensity: 0.49 }),
    wake: new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec2 texcoord;
        void main() {
          texcoord = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 texcoord;
        void main() {
          float y = texcoord.y;
          float edge = abs(abs(texcoord.x - 0.5) - (0.12 + (1.0 - y) * 0.31));
          float streak = 1.0 - smoothstep(0.015, 0.052, edge);
          gl_FragColor = vec4(0.68, 0.90, 0.91, streak * smoothstep(0.0, 0.77, y) * 0.53);
        }
      `,
    }),
  };
  const ships = [0, 1, 2, 3].map(index => vessel(group, shipPaint, index));
  const tracks = [
    [146, 15, 143, 123, 0.053],
    [189, 55, 155, -44, 0.033],
    [175, -77, 146, -150, 0.044],
    [216, -13, 187, 102, 0.065],
  ];
  let nightTarget = 0;

  function setNight(on) {
    nightTarget = Number(Boolean(on));
  }

  function update(dt, elapsed) {
    water.flowTime.value = elapsed;
    const light = water.night;
    light.value = THREE.MathUtils.damp(light.value, nightTarget, 3.8, dt);
    districts.roomLights.emissiveIntensity = lerp(0.3, 1.92, light.value);
    districts.glass.emissiveIntensity = lerp(0.2, 0.56, light.value);
    districts.beacon.emissiveIntensity = lerp(0.5, 1.96, light.value);
    shipPaint.light.emissiveIntensity = lerp(0.49, 1.95, light.value);
    ships.forEach((ship, index) => {
      const [x0, z0, x1, z1, pace] = tracks[index];
      const fraction = (elapsed * pace / 10 + 0.23 * index + 0.27) % 1;
      ship.position.set(lerp(x0, x1, fraction), Math.sin(elapsed * 1.7 + index) * 0.035, lerp(z0, z1, fraction));
      ship.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    });
  }

  update(0, 0);
  return { update, setNight };
}
