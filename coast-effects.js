import * as THREE from './vendor/three.module.js';
import { coastX, groundY, riverZ, waterAt } from './coast-terrain.js';

const guideSphere = new THREE.SphereGeometry(0.31, 8, 5);
const particleMatrix = new THREE.Matrix4();

function trail(parent, points, color, count = 19) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const length = curve.getLength();
  const group = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 85, 0.105, 5, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.58, toneMapped: false }),
  );
  const pulses = new THREE.InstancedMesh(guideSphere, new THREE.MeshBasicMaterial({ color, toneMapped: false }), count);
  const position = new THREE.Vector3();
  pulses.frustumCulled = false;
  group.add(strip, pulses);
  group.visible = false;
  parent.add(group);
  return {
    group,
    update(elapsed, speed = 9) {
      if (!group.visible) return;
      for (let i = 0; i < count; i++) {
        curve.getPointAt(((i / count + elapsed * speed / length) % 1 + 1) % 1, position);
        particleMatrix.makeTranslation(position.x, position.y, position.z);
        pulses.setMatrixAt(i, particleMatrix);
      }
      pulses.instanceMatrix.needsUpdate = true;
    },
  };
}

function groundPoints(points, lift = 0.4) {
  return points.map(([x, z]) => new THREE.Vector3(x, Math.max(0.18, groundY(x, z)) + lift, z));
}

function waterPoints(points) {
  return points.map(([x, z]) => {
    const aboveWater = 0.42;
    if (waterAt(x, z)) return new THREE.Vector3(x, aboveWater, z);
    for (let delta = 1; delta <= 9; delta++) {
      if (waterAt(x + delta, z)) return new THREE.Vector3(x + delta, aboveWater, z);
      if (waterAt(x - delta, z)) return new THREE.Vector3(x - delta, aboveWater, z);
    }
    return new THREE.Vector3(x, groundY(x, z) + 0.16, z);
  });
}

function rainLines(scene) {
  const count = 530;
  const seeds = Array.from({ length: count }, (_, i) => ({
    x: -24 + ((i * 16807 % 911) / 911) * 46,
    z: 29 + ((i * 4561 % 577) / 577) * 26,
    phase: (i * 6547 % 697) / 697,
  }));
  const positions = new Float32Array(count * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: 0xbdeaff, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false,
  }));
  lines.frustumCulled = false;
  lines.visible = false;
  scene.add(lines);
  return {
    lines,
    update(elapsed) {
      if (!lines.visible) return;
      for (let i = 0; i < count; i++) {
        const { x, z, phase } = seeds[i];
        const y = 0.6 + (1 - (elapsed * 0.72 + phase) % 1) * 19;
        positions.set([x, y, z, x + 0.24, y - 1.4, z + 0.12], i * 6);
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

function rainGarden(scene) {
  const group = new THREE.Group();
  group.position.set(14, groundY(14, 45) + 0.24, 45);
  const soil = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.24, 2.8), new THREE.MeshStandardMaterial({ color: 0x58885f }));
  group.add(soil);
  const leaf = new THREE.MeshStandardMaterial({ color: 0x9dc386 });
  const stems = new THREE.InstancedMesh(new THREE.ConeGeometry(0.25, 0.95, 5), leaf, 28);
  for (let i = 0; i < 28; i++) {
    particleMatrix.makeTranslation(((i * 53) % 63) / 10 - 3.1, 0.5, ((i * 29) % 19) / 10 - 0.94);
    stems.setMatrixAt(i, particleMatrix);
  }
  group.add(stems);
  group.visible = false;
  scene.add(group);
  return group;
}

export function createCoastExperiments(scene) {
  const dock = coastX(55);
  const routes = {
    hill: [trail(scene, groundPoints([[-52,-32],[-62,-29],[-70,-27],[-78,-26],[-88,-30],[-93,-39]], 0.68), 0xffe38d)],
    rural: [
      trail(scene, groundPoints([[-74,27],[-74,36],[-74,45],[-74,56]], 0.39), 0x8af7eb, 13),
      trail(scene, groundPoints([[-74,37],[-82,37],[-89,37],[-96,37]], 0.35), 0x74e7ed, 10),
      trail(scene, groundPoints([[-74,46],[-82,46],[-89,46],[-96,46]], 0.35), 0x74e7ed, 10),
    ],
    lake: [trail(scene, waterPoints([[34,riverZ(34)], [38,8], [43,-5], [43,-17], [41,-27], [35,-37], [26,-43]]), 0xa3fff4)],
    harbor: [trail(scene, groundPoints([[32,58],[48,58],[60,58],[dock - 4,58],[dock - 1,55],[dock + 4,55]], 0.76), 0xffd28a)],
  };
  const rain = rainLines(scene);
  const garden = rainGarden(scene);
  const runoff = trail(scene, groundPoints([[-14,42],[-8,42],[-3,44],[2,45],[7,45],[16,47]], 0.46), 0x77d7ff);
  const diverted = trail(scene, groundPoints([[-14,42],[-8,42],[-3,44],[3,44],[8,44],[12,45],[14,45]], 0.48), 0xa9f7bb);
  let mode = '';
  let enabled = false;
  let planted = false;
  let time = 0;

  function refresh() {
    for (const [id, paths] of Object.entries(routes)) {
      for (const route of paths) route.group.visible = enabled && mode === id;
    }
    const rainActive = mode === 'plain' && enabled;
    garden.visible = mode === 'plain' && planted;
    rain.lines.visible = rainActive;
    runoff.group.visible = rainActive && time > 1.1 && !planted;
    diverted.group.visible = rainActive && time > 1.1 && planted;
  }

  return {
    set(id, active) {
      if (mode !== id || enabled !== active) time = 0;
      mode = id;
      enabled = active;
      refresh();
    },
    setGarden(active) {
      planted = active;
      refresh();
    },
    restart() {
      time = 0;
      refresh();
    },
    progress() { return enabled ? Math.min(time / 8, 1) : 0; },
    update(dt, elapsed) {
      if (!enabled) return;
      time += dt;
      if (mode === 'plain') {
        refresh();
        rain.update(time);
        runoff.update(time, 8);
        diverted.update(time, 8);
      } else {
        for (const route of routes[mode] || []) route.update(elapsed, 8);
      }
    },
  };
}
