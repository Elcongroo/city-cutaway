import * as THREE from './vendor/three.module.js';

const SURFACE_Y = 0.16;
const WORLD = { left: -125, right: 125, back: -75, front: 75 };
const CUT = { left: -23, right: 29, back: -26, front: 61, bottom: -31 };
const { clamp, lerp, smoothstep } = THREE.MathUtils;

export function riverZ(x) {
  return 9 + 13 * Math.sin(x / 53) + 6 * Math.sin(x / 19);
}

export function riverRadius(x) {
  return 6.45 + 1.2 * Math.sin(x / 38 + 1) + 3.4 * smoothstep(x, 28, 90);
}

export function coastX(z) {
  const mouth = (z - 22) / 16;
  return 79 + 7.5 * Math.sin((z + 6) / 16) + 7 * Math.sin((z + 28) / 37)
    - 32 * Math.exp(-mouth * mouth);
}

function waterDistance(x, z) {
  const lake = (Math.hypot((x - 25) / 15, (z + 43) / 10) - 1) * 11;
  const channelX = 37.8 + 3.2 * Math.sin((z + 45) / 18);
  const channel = Math.max(Math.abs(x - channelX) - 2.1, -46 - z, z - riverZ(x));
  const river = Math.abs(z - riverZ(x)) - riverRadius(x);
  return Math.min(lake, channel, river, coastX(z) - x);
}

export function waterAt(x, z) {
  return waterDistance(x, z) <= 0;
}

function mound(x, z, centerX, centerZ, extentX, extentZ) {
  const dx = (x - centerX) / extentX;
  const dz = (z - centerZ) / extentZ;
  return Math.exp(-dx * dx - dz * dz);
}

function landHeight(x, z) {
  const foothills = 1 - smoothstep(x, -61, -40);
  const largeRidge = Math.max(
    30.2 * mound(x, z, -106, -48, 24, 19),
    29.8 * mound(x, z, -83, -44, 22, 26),
    20.2 * mound(x, z, -65, -57, 28, 19),
    16.6 * mound(x, z, -117, -25, 23, 20),
    11.8 * mound(x, z, -78, -22, 22, 18),
  ) + 5 * mound(x, z, -94, -42, 42, 39);
  const rough = (
    1.35 * Math.sin(x * 0.32 + z * 0.18)
    + 1.15 * Math.cos(z * 0.33 - x * 0.12)
    + 0.72 * Math.sin(z * 0.56 + x * 0.24)
  ) * smoothstep(largeRidge, 4, 24);
  const fields = 3.8 * mound(x, z, -103, 54, 29, 18)
    + 1.9 * mound(x, z, -76, 38, 19, 20);
  const plain = 0.95 + 0.27 * Math.sin(x * 0.039 + z * 0.056)
    + 0.14 * Math.cos(z * 0.11 - x * 0.035);
  return plain + Math.max((largeRidge + rough) * foothills, fields);
}

export function groundY(x, z) {
  const shore = waterDistance(x, z);
  if (shore <= 0) {
    const coastDepth = Math.max(0, x - coastX(z));
    const regionalDepth = coastDepth > 0 ? 7.5 + coastDepth * 0.14 : 5.25;
    return SURFACE_Y - smoothstep(-shore, 0, coastDepth > 0 ? 10 : 5.1) * regionalDepth;
  }
  return lerp(SURFACE_Y, landHeight(x, z), smoothstep(shore, 0, 2.75));
}

const landColors = {
  meadow: new THREE.Color('#789467'),
  bright: new THREE.Color('#96a467'),
  shade: new THREE.Color('#566f5f'),
  cliff: new THREE.Color('#879495'),
  crest: new THREE.Color('#a7ada3'),
  shore: new THREE.Color('#b9a982'),
  mud: new THREE.Color('#7e8370'),
  plain: new THREE.Color('#899593'),
};
const stoneColors = [
  new THREE.Color('#86715a'), new THREE.Color('#9a7c60'),
  new THREE.Color('#826653'), new THREE.Color('#675b55'),
  new THREE.Color('#6e645e'), new THREE.Color('#52606b'),
  new THREE.Color('#42515e'), new THREE.Color('#5c6569'),
  new THREE.Color('#3b4857'), new THREE.Color('#323d4c'),
  new THREE.Color('#4b5360'), new THREE.Color('#394652'),
];
const strata = [0.03, -1.2, -2.9, -4.7, -7.9, -10.1, -13.9, -17.2, -20.0, -22.6, -26.0, -29.2, -31.4, -33];

function tintTerrain(color, x, z, y) {
  const shore = waterDistance(x, z);
  if (shore <= 0) return color.copy(landColors.mud).lerp(landColors.shade, smoothstep(-shore, 0, 12));
  const pattern = Math.sin(x * 0.17 + z * 0.09) * Math.cos(z * 0.19)
    + Math.sin(x * 0.059 + z * 0.056) * 0.58 + Math.cos(x * 0.41 - z * 0.29) * 0.17;
  const urban = smoothstep(x, -64, -45) * (1 - smoothstep(x, 47, 63))
    * (1 - smoothstep(Math.abs(z - 10), 53, 68));
  const rocky = Math.hypot(
    groundY(x + 0.6, z) - groundY(x - 0.6, z),
    groundY(x, z + 0.6) - groundY(x, z - 0.6),
  ) / 1.2;
  color.copy(landColors.meadow);
  if (pattern >= 0) color.lerp(landColors.bright, clamp(pattern * 0.54, 0, 0.86));
  else color.lerp(landColors.shade, clamp(-pattern * 0.5, 0, 0.74));
  color.lerp(landColors.plain, urban * 0.5);
  color.lerp(landColors.cliff, smoothstep(rocky, 0.23, 0.91) * smoothstep(y, 3, 24));
  color.lerp(landColors.crest, smoothstep(y, 23, 37) * 0.66);
  color.lerp(landColors.shore, (1 - smoothstep(shore, 0.3, 4.15)) * 0.83);
  return color;
}

function terrainGrid(bounds, columns, rows, heightOf, paint) {
  const count = (columns + 1) * (rows + 1);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const indices = [];
  const color = new THREE.Color();
  for (let j = 0; j <= rows; j++) {
    const z = lerp(bounds.back, bounds.front, j / rows);
    for (let i = 0; i <= columns; i++) {
      const x = lerp(bounds.left, bounds.right, i / columns);
      const pos = j * (columns + 1) + i;
      const y = heightOf(x, z);
      positions.set([x, y, z], pos * 3);
      paint(color, x, z, y).toArray(colors, pos * 3);
      if (j < rows && i < columns) {
        const b = pos + columns + 1;
        if ((i + j) % 2) indices.push(pos, b, b + 1, pos, b + 1, pos + 1);
        else indices.push(pos, b, pos + 1, b, b + 1, pos + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function outlinePoints(bounds, offset = 0) {
  const sides = [
    [bounds.left + offset, bounds.back + offset, bounds.right - offset, bounds.back + offset],
    [bounds.right - offset, bounds.back + offset, bounds.right - offset, bounds.front - offset],
    [bounds.right - offset, bounds.front - offset, bounds.left + offset, bounds.front - offset],
    [bounds.left + offset, bounds.front - offset, bounds.left + offset, bounds.back + offset],
  ];
  return sides.map(([x0, z0, x1, z1]) => {
    const parts = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 1.12);
    return Array.from({ length: parts + 1 }, (_, i) => {
      const x = lerp(x0, x1, i / parts);
      const z = lerp(z0, z1, i / parts);
      return { x, y: groundY(x, z), z };
    });
  });
}

function cliffWalls(outlines, bottomAt) {
  const positions = [];
  const colors = [];
  const color = new THREE.Color();
  for (const points of outlines) {
    for (let i = 0; i < points.length - 1; i++) {
      const first = points[i];
      const next = points[i + 1];
      for (let j = 0; j < strata.length - 1; j++) {
        const vertices = [[first, j], [first, j + 1], [next, j], [next, j], [first, j + 1], [next, j + 1]];
        for (const [point, band] of vertices) {
          const ripple = 0.46 * Math.sin(point.x * 0.085 + point.z * 0.115 + band * 0.48)
            + 0.21 * Math.cos(point.z * 0.37 - point.x * 0.19 + band / 3);
          const y = band === 0 ? point.y : clamp(strata[band] + ripple, bottomAt(point), point.y);
          positions.push(point.x, y, point.z);
          const mottle = 0.94 + 0.065 * Math.sin(point.x * 1.11 + point.z * 0.91 - band * 1.93)
            + 0.038 * Math.cos(point.x * 1.77 - point.z * 0.39 + band * 2.13);
          color.copy(stoneColors[Math.min(j, stoneColors.length - 1)]).multiplyScalar(mottle);
          if (j < 3 && point.y < -1) color.lerp(landColors.mud, 0.28);
          colors.push(color.r, color.g, color.b);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function waterWalls(outlines, depthPlane) {
  const positions = [];
  for (const points of outlines) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (a.y >= SURFACE_Y && b.y >= SURFACE_Y) continue;
      const y = Math.min(a.y, SURFACE_Y);
      const y1 = Math.min(b.y, SURFACE_Y);
      positions.push(
        a.x, SURFACE_Y, a.z, a.x, y, a.z, b.x, SURFACE_Y, b.z,
        b.x, SURFACE_Y, b.z, a.x, y, a.z, b.x, y1, b.z,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.MeshBasicMaterial({
    color: '#5dcfda', opacity: 0.24, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, clippingPlanes: [depthPlane],
  });
  const result = new THREE.Mesh(geometry, material);
  result.renderOrder = 4;
  return result;
}

function sectionEdge(outlines) {
  const points = [];
  for (const side of outlines) {
    for (let i = 0; i < side.length - 1; i++) {
      for (const p of [side[i], side[i + 1]]) points.push(p.x, Math.max(p.y, SURFACE_Y) + 0.06, p.z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: '#ffd89e', transparent: true, opacity: 0.55, depthWrite: false,
  }));
}

function createWater(cutPlanes) {
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
  const material = new THREE.ShaderMaterial({
    uniforms,
    clipping: true,
    clippingPlanes: cutPlanes,
    clipIntersection: true,
    fog: true,
    vertexShader: [
      'varying vec2 waterXZ;',
      '#include <clipping_planes_pars_vertex>',
      '#include <fog_pars_vertex>',
      'void main() {',
      '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
      '  waterXZ = (modelMatrix * vec4(position, 1.0)).xz;',
      '  gl_Position = projectionMatrix * mvPosition;',
      '  #include <clipping_planes_vertex>',
      '  #include <fog_vertex>',
      '}',
    ].join('\n'),
    fragmentShader: [
      'varying vec2 waterXZ;',
      'uniform float flowTime;',
      'uniform float night;',
      'uniform vec3 shallows;',
      'uniform vec3 riverBlue;',
      'uniform vec3 oceanBlue;',
      'uniform vec3 shimmer;',
      '#include <clipping_planes_pars_fragment>',
      '#include <fog_pars_fragment>',
      'float riverCenter(float x) { return 9.0 + 13.0 * sin(x / 53.0) + 6.0 * sin(x / 19.0); }',
      'float coastLine(float z) {',
      '  float mouth = (z - 22.0) / 16.0;',
      '  return 79.0 + 7.5 * sin((z + 6.0) / 16.0) + 7.0 * sin((z + 28.0) / 37.0) - 32.0 * exp(-mouth * mouth);',
      '}',
      'void main() {',
      '  #include <clipping_planes_fragment>',
      '  vec2 p = waterXZ;',
      '  float c = coastLine(p.y);',
      '  float width = 6.45 + 1.2 * sin(p.x / 38.0 + 1.0) + 3.4 * smoothstep(28.0, 90.0, p.x);',
      '  float river = width - abs(p.y - riverCenter(p.x));',
      '  float lake = (1.0 - length((p - vec2(25.0, -43.0)) / vec2(15.0, 10.0))) * 11.0;',
      '  float canal = min(2.1 - abs(p.x - (37.8 + 3.2 * sin((p.y + 45.0) / 18.0))), min(p.y + 46.0, riverCenter(p.x) - p.y));',
      '  float bay = p.x - c;',
      '  float bank = max(max(river, bay), max(lake, canal));',
      '  float openWater = smoothstep(-6.0, 36.0, bay);',
      '  vec3 base = mix(shallows, mix(riverBlue, oceanBlue, openWater), smoothstep(-0.1, 8.5 + 6.0 * openWater, bank));',
      '  float longWave = sin(dot(p, vec2(0.22, 0.61)) + sin(p.x * 0.23 + flowTime * 0.47) * 0.70 - flowTime * 0.73);',
      '  float wave = sin(dot(p, vec2(-1.11, 2.53)) + longWave * 0.69 + p.x * 0.045 - flowTime * 1.12);',
      '  float waveMask = 0.53 + 0.47 * sin(p.x * 0.71 + p.y * 0.35 + longWave * 0.51 + flowTime * 0.14);',
      '  float sparseRidge = smoothstep(0.8, 1.0, wave) * waveMask * (0.26 + 0.74 * smoothstep(-0.45, 0.87, longWave));',
      '  float edge = (1.0 - smoothstep(0.04, 1.5, abs(bank - 0.45))) * (0.21 + 0.19 * longWave);',
      '  base = mix(base * (1.01 + longWave * 0.065), shimmer, sparseRidge * 0.27 + edge * 0.49);',
      '  base *= mix(vec3(1.0), vec3(0.36, 0.57, 0.75), night);',
      '  gl_FragColor = vec4(base, 1.0);',
      '  #include <tonemapping_fragment>',
      '  #include <colorspace_fragment>',
      '  #include <fog_fragment>',
      '}',
    ].join('\n'),
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.right - WORLD.left, WORLD.front - WORLD.back), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = SURFACE_Y;
  return { mesh, uniforms };
}

export function createCoastTerrain(scene) {
  const group = new THREE.Group();
  group.name = 'Continuous terrain, water and section';
  scene.add(group);

  const cutPlanes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), CUT.left),
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -CUT.right),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), CUT.back),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -CUT.front),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 150),
  ];
  const landMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.96, clippingPlanes: cutPlanes, clipIntersection: true,
  });
  const land = new THREE.Mesh(terrainGrid(WORLD, 218, 134, groundY, tintTerrain), landMaterial);
  land.receiveShadow = true;
  group.add(land);

  const outer = outlinePoints(WORLD);
  const shellMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  const shell = new THREE.Mesh(cliffWalls(outer, p => Math.min(-6.75, p.y - 2.4)), shellMaterial);
  group.add(shell);

  const water = createWater(cutPlanes);
  group.add(water.mesh);

  const section = new THREE.Group();
  section.visible = false;
  group.add(section);
  const sectionPoints = outlinePoints(CUT, 0.025);
  const wallDepth = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const rockMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, side: THREE.DoubleSide, clippingPlanes: [wallDepth],
  });
  section.add(new THREE.Mesh(cliffWalls(sectionPoints, () => CUT.bottom - 0.3), rockMaterial));
  section.add(waterWalls(sectionPoints, wallDepth), sectionEdge(sectionPoints));
  const floorColor = new THREE.Color('#596373');
  const floor = new THREE.Mesh(terrainGrid(CUT, 33, 50, () => 0, (color, x, z) => {
    const grain = 0.86 + 0.10 * Math.sin(z * 0.59 + x * 0.24)
      + 0.05 * Math.sin(x * 1.65 + z * 0.28);
    return color.copy(floorColor).multiplyScalar(grain);
  }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  floor.receiveShadow = true;
  section.add(floor);

  let nightTarget = 0;
  function setNight(active) {
    nightTarget = active ? 1 : 0;
  }
  function update(dt, elapsed) {
    water.uniforms.flowTime.value = elapsed;
    const glow = water.uniforms.night;
    glow.value = THREE.MathUtils.damp(glow.value, nightTarget, 3.8, dt);
  }
  function setDepth(value) {
    const depth = clamp(value, 0, 30);
    section.visible = depth > 0.1;
    cutPlanes[4].constant = section.visible ? -depth : 150;
    wallDepth.constant = depth;
    floor.position.y = -depth + 0.012;
  }
  return { update, setDepth, cutPlanes, setNight };
}
