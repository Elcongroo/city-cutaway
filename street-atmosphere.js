import * as THREE from './vendor/three.module.js';

const { clamp, lerp } = THREE.MathUtils;
const closedBottom = -0.862;
const platformGap = 0.11;

function footprint(width, length, radius) {
  const x = width / 2;
  const z = length / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x + radius, -z);
  shape.lineTo(x - radius, -z);
  shape.quadraticCurveTo(x, -z, x, -z + radius);
  shape.lineTo(x, z - radius);
  shape.quadraticCurveTo(x, z, x - radius, z);
  shape.lineTo(-x + radius, z);
  shape.quadraticCurveTo(-x, z, -x, z - radius);
  shape.lineTo(-x, -z + radius);
  shape.quadraticCurveTo(-x, -z, -x + radius, -z);
  return shape;
}

function podiumLayer(width, length, radius, depth, bevel, materials) {
  const geometry = new THREE.ExtrudeGeometry(footprint(width, length, radius), {
    depth,
    steps: 1,
    curveSegments: 7,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -depth - bevel, 0);
  return new THREE.Mesh(geometry, materials);
}

function floorTexture() {
  const width = 224;
  const height = 176;
  const pixels = new Uint8Array(width * height * 4);
  const gradient = (x, y, ox, oy, rx, ry) => Math.exp(-2.65 * (((x - ox) / rx) ** 2 + ((y - oy) / ry) ** 2));
  for (let row = 0; row < height; row++) {
    const z = (row / (height - 1) - 0.5) * 46;
    for (let column = 0; column < width; column++) {
      const x = (column / (width - 1) - 0.5) * 70;
      const edge = Math.hypot(2 * column / (width - 1) - 1, 2 * row / (height - 1) - 1);
      const falloff = 1 - THREE.MathUtils.smoothstep(edge, 0.73, 1);
      const distance = Math.hypot(Math.max(0, Math.abs(x - 0.7) - 17.1), Math.max(0, Math.abs(z + 0.8) - 10));
      const contact = 0.94 * Math.exp(-0.08 * distance ** 2);
      const warm = gradient(x, z, -13, -10, 22, 12) * (1 - contact);
      const cool = gradient(x, z, 11, 6, 25, 17) * (1 - contact);
      const ambient = 0.40 * gradient(x, z, 0, 0, 32, 22);
      const total = contact + warm + cool + ambient;
      const i = (row * width + column) * 4;
      pixels[i] = total ? (3 * contact + 116 * warm + 63 * cool + 25 * ambient) / total : 0;
      pixels[i + 1] = total ? (8 * contact + 83 * warm + 115 * cool + 46 * ambient) / total : 0;
      pixels[i + 2] = total ? (13 * contact + 72 * warm + 136 * cool + 60 * ambient) / total : 0;
      pixels[i + 3] = 255 * falloff * Math.min(1, contact * 0.86 + warm * 0.25 + cool * 0.46 + ambient * 0.75);
    }
  }
  const map = new THREE.DataTexture(pixels, width, height);
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = false;
  map.magFilter = map.minFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  return map;
}

function podiumRim() {
  const outline = footprint(38.26, 24.17, 0.86).getPoints(8);
  const points = outline.map(point => new THREE.Vector3(point.x, 0.008, -point.y));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0x8196a9,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
    toneMapped: false,
  });
  return new THREE.LineLoop(geometry, material);
}

function frontAccent() {
  const geometry = new THREE.BufferGeometry();
  const locations = [];
  const weight = [];
  const color = new THREE.Color(0xb4c9dc);
  const amber = new THREE.Color(0xffb98a);
  for (let i = 0; i <= 64; i++) {
    const progress = i / 64;
    const strength = Math.pow(Math.sin(progress * Math.PI), 1.15) * 0.72;
    locations.push(lerp(-15.6, 15.6, progress), -0.348, 12.35);
    const tint = color.clone().lerp(amber, progress).multiplyScalar(strength);
    weight.push(tint.r, tint.g, tint.b);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(locations, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(weight, 3));
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    toneMapped: false,
  }));
}

function dustCloud() {
  const count = 22;
  const positions = new Float32Array(count * 3);
  const origins = [];
  for (let i = 0; i < count; i++) {
    const phase = i * 2.399963;
    const radius = 1 + 0.21 * Math.sin(i * 4.15) + 0.14 * Math.cos(i * 2.6);
    origins.push({
      x: Math.cos(phase) * 24 * radius,
      y: 2 + ((i * 13.1) % 16),
      z: Math.sin(phase) * 18 * radius,
      phase,
    });
  }
  const geometry = new THREE.BufferGeometry();
  const buffer = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', buffer);
  const size = 16;
  const mask = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const radius = Math.hypot((x - 7.5) / 8, (y - 7.5) / 8);
      mask[i] = mask[i + 1] = mask[i + 2] = 255;
      mask[i + 3] = Math.floor(255 * Math.max(0, 1 - radius) ** 2);
    }
  }
  const map = new THREE.DataTexture(mask, size, size);
  map.minFilter = map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;

  const material = new THREE.PointsMaterial({
    color: 0xf2dfc4,
    map,
    size: 0.115,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return {
    points,
    update(elapsed, night) {
      material.opacity = lerp(0.07, 0.26, night);
      for (let i = 0; i < count; i++) {
        const item = origins[i];
        const phase = elapsed * 0.105 + item.phase;
        buffer.setXYZ(i, item.x + Math.sin(phase) * 1.2, item.y + Math.sin(phase * 0.76) * 0.73,
          item.z + Math.cos(phase * 0.81) * 0.79);
      }
      buffer.needsUpdate = true;
    },
  };
}

export function createStreetAtmosphere(scene) {
  const podium = new THREE.Group();
  podium.name = 'Graphite exhibition stand';

  const charcoal = new THREE.MeshStandardMaterial({ color: 0x202a34, metalness: 0.19, roughness: 0.72 });
  const lip = new THREE.MeshStandardMaterial({ color: 0x313d48, metalness: 0.39, roughness: 0.52 });
  const base = podiumLayer(38.38, 24.26, 1.02, 0.64, 0.28, [charcoal, lip]);
  base.position.y = -0.26;
  const top = podiumLayer(38.65, 24.5, 1.04, 0.20, 0.10, [charcoal, lip]);
  const rim = podiumRim();
  const accent = frontAccent();
  podium.add(base, top, rim, accent);
  scene.add(podium);

  const falloff = new THREE.Mesh(new THREE.PlaneGeometry(70, 46), new THREE.MeshBasicMaterial({
    map: floorTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 1,
    toneMapped: false,
  }));
  falloff.name = 'Soft contact shading';
  falloff.rotation.x = -Math.PI / 2;
  falloff.renderOrder = -1;
  scene.add(falloff);

  const dust = dustCloud();
  scene.add(dust.points);
  let night = 1;
  let targetNight = 1;
  function update(dt, elapsed, open) {
    const aperture = clamp(Number(open) || 0, 0, 1);
    const bottom = aperture > 0.07 ? -0.25 - 12.61 * (0.034 + 0.966 * aperture) : closedBottom;
    podium.position.y = bottom - platformGap;
    falloff.position.y = podium.position.y - 1.52;
    night = THREE.MathUtils.damp(night, targetNight, 3.6, Math.max(0, dt));
    falloff.material.opacity = lerp(0.83, 1, night);
    rim.material.opacity = lerp(0.29, 0.44, night);
    accent.material.opacity = lerp(0.18, 0.40, night);
    dust.update(elapsed, night);
  }
  update(0, 0, 0);
  return { update, setNight(active) { targetNight = Number(Boolean(active)); } };
}
