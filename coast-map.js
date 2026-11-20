import { buildingParts, destinations, underground } from './coast-guide.js?v=20261120.5';

const TAU = Math.PI * 2;
const WORLD = { left: -235, right: 235, north: -164, south: 128 };
const FACES = ['#c2ccbe', '#a9bebe', '#b9cbc6', '#d1c9ad', '#aebfc9'];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mix = (a, b, t) => a + (b - a) * t;
const riverZ = x => 9 + 13 * Math.sin(x / 53) + 6 * Math.sin(x / 19);
const riverRadius = x => 6.45 + 1.2 * Math.sin(x / 38 + 1) + 3.4 * clamp((x - 28) / 62, 0, 1);
const coastX = z => 79 + 7.5 * Math.sin((z + 6) / 16) + 7 * Math.sin((z + 28) / 37) - 32 * Math.exp(-(((z - 22) / 16) ** 2));
const waterAt = (x, z) => x > coastX(z) || Math.abs(z - riverZ(x)) < riverRadius(x) + 2
  || Math.hypot((x - 25) / 16, (z + 43) / 11) < 1
  || (z > -46 && z < riverZ(x) && Math.abs(x - (37.8 + 3.2 * Math.sin((z + 45) / 18))) < 3);
const project = (x, z, altitude = 0) => [x + 0.26 * z, 0.7 * z + 0.059 * x - 0.75 * altitude];
const anchors = [
  ['hill', -86, -45, 24],
  ['rural', -105, 45, 0],
  ['lake', 24, -42, 1],
  ['plain', -21, -29, 15],
  ['skyline', 0, -115, 17],
  ['river', 6, riverZ(6), 0],
  ['harbor', 88, 57, 1],
  ['offshore', 170, 40, 0],
  ['building', -34, -21, 10],
];

function path(ctx, points, fill, stroke, lineWidth = 1, close = false) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  if (close || fill) ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function plot(ctx, points, fill, stroke, width = 1, close) {
  path(ctx, points.map(([x, z, y]) => project(x, z, y)), fill, stroke, width, close);
}

function curves(a, b, step, point) {
  const list = [];
  const count = Math.ceil(Math.abs(b - a) / step);
  for (let i = 0; i <= count; i++) list.push(point(mix(a, b, i / count)));
  return list;
}

function roundBox(ctx, x, y, width, height, color, stroke, radius = 6) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function text(ctx, label, x, y, color, size = 13, weight = 600, align = 'left') {
  ctx.font = weight + ' ' + size + 'px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
}

function dot(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

function random(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function parcel(x, z, width, length, y = 0) {
  return [[x, z, y], [x + width, z, y], [x + width, z + length, y], [x, z + length, y]];
}

function house(ctx, x, z, w, d, height, shade, night) {
  const base = parcel(x, z, w, d);
  const top = parcel(x, z, w, d, height);
  plot(ctx, parcel(x + 1.3, z + 1.9, w + height * 0.19, d + 1.6), night ? '#05151f90' : '#24312253');
  plot(ctx, [top[3], top[2], base[2], base[3]], night ? '#274759' : '#6f9590');
  plot(ctx, [top[1], top[2], base[2], base[1]], night ? '#122d44' : '#456d76');
  plot(ctx, top, night ? '#436277' : shade, night ? '#5b7f8c' : '#d8e5d4', 0.19);
  if (height > 7) {
    plot(ctx, parcel(x + w * 0.26, z + 0.65, w * 0.48, d * 0.55, height + 0.6), night ? '#8c7c60' : '#627e84');
    const rows = Math.min(5, Math.floor(height / 3));
    for (let i = 1; i < rows + 1; i++) {
      const a = height * i / (rows + 1);
      for (let j = 0; j < 3; j++) {
        const mid = x + w * (j + 0.6) / 3.3;
        plot(ctx, [[mid - 0.37, z + d + 0.02, a], [mid + 0.37, z + d + 0.02, a]], null, night ? '#ffe0a1' : '#c2e4df', 0.23);
      }
    }
  }
}

function road(ctx, points, night, principal = false) {
  plot(ctx, points, null, night ? '#112e3c' : '#465e5a', principal ? 3.3 : 2.0);
  plot(ctx, points, null, night ? '#5b5962' : '#96a699', principal ? 2.1 : 1.15);
  if (!principal) return;
  ctx.setLineDash([1.3, 2.4]);
  plot(ctx, points, null, night ? '#ddaf76' : '#f2dcac', 0.36);
  ctx.setLineDash([]);
}

function makeAtlas(night) {
  const backing = document.createElement('canvas');
  const rasterScale = 3.1;
  const x0 = -289, y0 = -172;
  const width = 568, height = 296;
  backing.width = Math.ceil(width * rasterScale);
  backing.height = Math.ceil(height * rasterScale);
  const ctx = backing.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.setTransform(rasterScale, 0, 0, rasterScale, -x0 * rasterScale, -y0 * rasterScale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const { left, right, north, south } = WORLD;
  const crown = [[left, north], [right, north], [right, south], [left, south]];
  const waterShade = ctx.createLinearGradient(-190, -110, 235, 105);
  waterShade.addColorStop(0, night ? '#20485b' : '#468e91');
  waterShade.addColorStop(1, night ? '#0b273f' : '#205e79');
  const landShade = ctx.createLinearGradient(-160, -85, 85, 76);
  landShade.addColorStop(0, night ? '#284333' : '#789366');
  landShade.addColorStop(1, night ? '#3d574f' : '#a7ac83');
  plot(ctx, [[left, south], [right, south], [right, south, -8], [left, south, -8]], night ? '#243842' : '#415d60');
  plot(ctx, [[right, north], [right, south], [right, south, -8], [right, north, -8]], night ? '#1c3448' : '#315e6d');
  plot(ctx, crown, waterShade, night ? '#537a86' : '#7aa7a4', 0.43);

  const chance = random(45);
  for (let i = 0; i < 185; i++) {
    const z = mix(north + 6, south - 5, chance());
    const x = mix(coastX(z) + 2, right - 12, chance());
    const length = chance() * 9 + 1;
    plot(ctx, [[x, z], [x + length, z]], null, night ? '#77c5d036' : '#9ce3dd65', 0.24 + chance() * 0.35);
  }
  const coastalBank = curves(north, south, 3, z => [coastX(z), z]);
  plot(ctx, [[left, north], ...coastalBank, [left, south]], landShade, night ? '#59847e' : '#9ad1ba', 0.87);

  for (const [cx, cz, rx, rz] of [[174, -113, 15, 12], [211, -126, 10, 8]]) {
    const outline = curves(0, TAU, 0.22, a => {
      const landform = 1 + Math.sin(a * 3 + 1.2) * 0.16;
      return [cx + Math.cos(a) * rx * landform, cz + Math.sin(a) * rz * landform];
    });
    plot(ctx, outline, night ? '#45644d' : '#9da36f', night ? '#588a88' : '#9fd5b1', 1.1);
    plot(ctx, curves(0, TAU, 0.24, a => [cx + Math.cos(a) * rx * 0.63, cz + Math.sin(a) * rz * 0.61, 1.4]),
      night ? '#527358' : '#adba86', night ? '#8aa498' : '#cee5ba', 0.35);
    plot(ctx, [[cx - rx * 0.6, cz + rz * 0.39], [cx + rx * 0.37, cz - rz * 0.44]], null, night ? '#7f8980' : '#d6d8ac', 0.52);
  }

  const peaks = [
    [-182, -102, 38, 36, 44], [-149, -67, 41, 36, 33], [-113, -79, 41, 30, 32], [-99, -46, 27, 29, 29],
    [-70, -68, 36, 30, 25], [-187, -47, 35, 32, 34], [-158, -29, 31, 28, 21], [-55, -41, 23, 28, 15],
  ];
  for (let i = 0; i < peaks.length; i++) {
    const [x, z, w, h, elevation] = peaks[i];
    for (let band = 0; band < 12; band++) {
      const q = (band + 1) / 12;
      const ring = curves(0, TAU, 0.16, a => {
        const jiggle = 1 + 0.12 * Math.sin(a * 3 + i) + 0.084 * Math.cos(a * 5 + 2 * i);
        return [x + w * (1.12 - q) * jiggle * Math.cos(a), z + h * (1.12 - q) * jiggle * Math.sin(a), elevation * q ** 1.08];
      });
      const color = night ? ['#324e3e', '#3e5a49', '#485f56', '#607368'] : ['#6f8c60', '#779566', '#89a074', '#adb096'];
      plot(ctx, ring, color[Math.min(3, Math.floor(q * 3.5))], night ? '#8faa8d5d' : '#cedbbb77', 0.34);
    }
  }
  for (let i = 0; i < 290; i++) {
    const x = mix(left + 4, coastX(0) - 2, chance());
    const z = mix(north + 6, south - 8, chance());
    if (waterAt(x, z) || (x > -63 && z > -77 && z < 88)) continue;
    const [s, t] = project(x, z);
    dot(ctx, s, t, 0.25 + chance() * 0.38, night ? '#adc28a45' : '#405f3d62');
  }

  const riverL = curves(left, 69, 2, x => [x, riverZ(x) - riverRadius(x)]);
  const riverR = curves(69, left, 2, x => [x, riverZ(x) + riverRadius(x)]);
  plot(ctx, [...riverL, ...riverR], night ? '#24586d' : '#4f9c9e', night ? '#69bac67e' : '#b1ded183', 0.7);
  plot(ctx, curves(left + 10, 92, 2, x => [x, riverZ(x)]), null, night ? '#65a8b95b' : '#d1efe889', 0.56);
  plot(ctx, curves(-44, riverZ(38), 1.6, z => [37.8 + 3.2 * Math.sin((z + 45) / 18), z]), null, night ? '#4da1b7' : '#5ea2a2', 5);
  plot(ctx, curves(0, TAU, 0.14, a => [25 + 16 * Math.cos(a), -43 + 11 * Math.sin(a)]), night ? '#286174' : '#559ca0', night ? '#83bd9c' : '#c9e2a2', 0.91);

  const fieldColors = night ? ['#526743', '#788050', '#365b42', '#6b7451'] : ['#aab161', '#c0ae66', '#779964', '#9ca76c'];
  for (let z = 17; z < 103; z += 11) {
    for (let x = -174; x < -62; x += 12) {
      if (waterAt(x + 6, z + 4) || chance() < 0.145) continue;
      const u = x + (z % 4) * 0.56;
      const height = 7.8 + chance() * 1.15;
      plot(ctx, parcel(u, z, 9.9, height), fieldColors[Math.floor(chance() * fieldColors.length)], night ? '#9095736b' : '#d0d19e80', 0.27);
      for (let j = 1; j < 8; j++) {
        plot(ctx, [[u + j * 1.17, z + 0.66], [u + j * 1.17, z + height - 0.51]], null, night ? '#142d3a55' : '#50684062', 0.26);
      }
    }
  }
  const mainCanal = [[-74, 27], [-77, 58], [-109, 73], [-159, 69]];
  plot(ctx, mainCanal, null, night ? '#438595' : '#4e9f9e', 1.35);
  for (let i = 0; i < 4; i++) plot(ctx, [[-77, 31 + 8 * i], [-118 - i * 12, 31 + 9 * i]], null, night ? '#438595' : '#4e9f9e', 0.66);

  for (const z of [-137, -119, -106, -95, -78, -63, -29, -16, 27, 40, 55, 67, 86, 102]) {
    const usable = x => x < coastX(z) - 1.4 && !waterAt(x, z);
    let ongoing = null;
    for (let x = -171; x <= 88; x += 2) {
      if (usable(x)) {
        if (!ongoing) ongoing = [x, z];
      } else if (ongoing) {
        road(ctx, [ongoing, [x - 2, z]], night, z === -78 || z === 55);
        ongoing = null;
      }
    }
    if (ongoing) road(ctx, [ongoing, [88, z]], night, true);
  }
  for (const x of [-168, -125, -95, -64, -49, -33, -18, -2, 16, 32, 50, 64]) {
    const usable = z => !waterAt(x, z) && !(z < -80 && x < -55);
    let ongoing = null;
    for (let z = -98; z <= 112; z += 2) {
      if (usable(z)) {
        if (!ongoing) ongoing = [x, z];
      } else if (ongoing) {
        road(ctx, [ongoing, [x, z - 2]], night);
        ongoing = null;
      }
    }
    if (ongoing) road(ctx, [ongoing, [x, 112]], night);
  }
  road(ctx, curves(-187, 68, 1.7, x => [x, riverZ(x) - riverRadius(x) - 4.5]), night, true);
  road(ctx, curves(-187, 66, 1.7, x => [x, riverZ(x) + riverRadius(x) + 5.6]), night, true);
  road(ctx, [[-183, 70], [-151, 64], [-119, 67], [-96, 59], [-66, 60], [82, 55]], night, true);
  road(ctx, [[-147, -31], [-129, -15], [-116, -17], [-99, -12], [-83, -16], [-70, -9]], night);

  const build = [];
  for (let z = -142; z <= 112; z += 5.8) {
    for (let x = -64; x < 76; x += 6.0) {
      if (chance() < (z > 82 ? 0.44 : 0.2) || waterAt(x, z) || waterAt(x + 3.6, z + 3.8)) continue;
      if (Math.abs(z - riverZ(x)) < riverRadius(x) + 4.3) continue;
      if ((x > -0.5 && x < 31 || x > -51 && x < -45) && Math.abs(z - riverZ(x)) < riverRadius(x) + 8) continue;
      const center = 1 - clamp(Math.abs(x + 9) / 68 + Math.abs(z + 23) / 112, 0, 1);
      const height = 1.4 + chance() * (5.4 + 22 * center ** 2 + (z < -100 && z > -125 ? 5 : 0)) + (chance() > 0.97 ? 8 : 0);
      build.push([x, z, 2.15 + chance() * 2.2, 2.15 + chance() * 2.2, height, FACES[Math.floor(chance() * FACES.length)]]);
    }
  }
  for (let i = 0; i < 42; i++) {
    const x = mix(-160, -65, chance());
    const z = mix(20, 99, chance());
    if (!waterAt(x, z)) build.push([x, z, 2.35, 1.7, 1.2 + chance() * 1.4, ['#ead6ab', '#dbad83', '#8eabad'][i % 3]]);
  }
  build.sort((a, b) => a[1] - b[1]);
  for (const fields of build) house(ctx, ...fields, night);
  for (let i = 0; i < 13; i++) {
    const x = 11 + i * 4.9;
    const z = 102 + (i % 3) * 4.6;
    if (!waterAt(x, z)) house(ctx, x, z, 4.4, 8.7, 1.55, '#c2c0a3', night);
  }

  for (const [x, lift, width] of [[-49, 2.5, 4.7], [50, 4.2, 6.1]]) {
    const z = riverZ(x);
    const extent = riverRadius(x) + 7;
    plot(ctx, [[x, z - extent, lift], [x, z + extent, lift]], null, night ? '#86a6a6' : '#d0d0af', width);
    plot(ctx, [[x, z - extent, lift], [x, z + extent, lift]], null, '#43585e', width * 0.68);
    for (const dz of [-6, 6]) {
      plot(ctx, [[x - 2.0, z + dz, 2], [x - 2.0, z + dz, 12]], null, night ? '#e2bc8a' : '#ece6bd', 1);
      plot(ctx, [[x - 2.0, z + dz, 12], [x - 2.0, z + dz * 0.24, lift]], null, night ? '#cda985' : '#f1e5c0', 0.43);
      plot(ctx, [[x - 2.0, z + dz, 12], [x - 2.0, z + dz * 1.96, lift]], null, night ? '#cda985' : '#f1e5c0', 0.43);
    }
  }
  for (const z of [41, 53, 66, 80]) {
    const x = coastX(z) - 1;
    plot(ctx, parcel(x, z, 25, 4), night ? '#6d7d71' : '#bfbd9e', '#cbd7bf', 0.28);
    for (let i = 0; i < 12; i++) {
      const color = ['#bf765b', '#567b91', '#d6ba71', '#617f72'][i % 4];
      plot(ctx, parcel(x + 0.8 + i * 1.52, z + (i % 2) * 1.24, 1.35, 1.02), color);
    }
    for (const dx of [4.2, 13.2, 20.2]) {
      plot(ctx, [[x + dx, z + 3.7], [x + dx, z + 3.7, 6.0], [x + dx + 5.2, z + 3.7, 6.0]], null, night ? '#ffd585' : '#ddb06b', 0.68);
    }
    const shipX = x + 13 + (z % 3) * 3;
    plot(ctx, [[shipX - 6, z + 8], [shipX - 5, z + 6], [shipX + 4, z + 6], [shipX + 7, z + 7.4], [shipX + 4, z + 9.4], [shipX - 5, z + 9.4]], night ? '#a3ad9b' : '#f1dfb4');
    plot(ctx, parcel(shipX - 4, z + 6.6, 6.4, 2.08), '#526e78');
  }
  plot(ctx, [[12, -4], [31, -4], [31, 49], [12, 49]], null, night ? '#65d5e0a0' : '#e4f9ea9c', 0.52, true);
  return { backing, x0, y0, width, height };
}

const trails = {
  hill: [[-151, -33], [-128, -15], [-116, -17], [-99, -12], [-83, -16], [-70, -9]],
  rural: [[-156, 69], [-108, 73], [-78, 59], [-74, 28]],
  lake: [[27, -44], [38, -41], [40, -20], [41, 2], [40, riverZ(40)]],
  plain: [[-57, 34], [-34, 37], [-10, 27], [12, riverZ(12) + 10], [21, riverZ(21)]],
  harbor: [[169, 70], [144, 65], [117, 60], [91, 57], [51, 55], [14, 55]],
  skyline: [[-32, -70], [-18, -88], [-17, -118], [10, -119], [34, -120]],
  offshore: [[98, 35], [131, 48], [162, 49], [191, 31], [209, -8], [211, -68]],
};
const gardenTrail = [[-57, 34], [-34, 37], [-10, 27], [2, 29], [10, 34], [18, 38]];

function drawTrail(ctx, camera, world, time, color) {
  const points = world.map(([x, z]) => camera(...project(x, z)));
  ctx.setLineDash([6, 7]);
  ctx.lineDashOffset = -time * 17;
  path(ctx, points, null, color, 2.5);
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
}

function passThrough(phase, left, right, y) {
  const p = (phase % 1 + 1) % 1;
  return [mix(left, right, p), y];
}

function drawSection(ctx, width, height, depth, time, following, discover, addHit) {
  const compact = width < 600;
  const left = compact ? 11 : width * 0.14;
  const right = compact ? (width - 13) : width * 0.87;
  const w = right - left;
  const top = Math.max(compact ? 118 : 92, height * 0.22);
  const bottom = height - (compact ? 57 : 58);
  const section = bottom - top;
  const surface = top + section * 0.23;
  const waterL = left + w * 0.34, waterR = left + w * 0.67;
  const yAt = d => surface + Math.max(0, d) * section * 0.69 / 30;
  const cutoff = yAt(depth);
  roundBox(ctx, left, top, w, section, '#112330ed', '#82b9bba6', 7);
  const sky = ctx.createLinearGradient(0, top, 0, surface);
  sky.addColorStop(0, '#294b5e');
  sky.addColorStop(1, '#457074');
  ctx.fillStyle = sky;
  ctx.fillRect(left + 1, top + 1, w - 2, surface - top - 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(left + 1, surface, w - 2, Math.max(0, cutoff - surface + 3));
  ctx.clip();
  const soilColors = ['#7a7360', '#596466', '#50626d', '#394f60', '#30465a', '#273d52'];
  for (let i = 0; i < soilColors.length; i++) {
    ctx.fillStyle = soilColors[i];
    ctx.fillRect(left + 1, yAt(i * 5), w - 2, yAt(5) - surface + 1);
    const grain = [];
    for (let j = 0; j < 12; j++) grain.push([left + j * w / 11, yAt(i * 5 + 2.4) + 2.3 * Math.sin(j * 1.4 + 1.7 * i)]);
    path(ctx, grain, null, '#bfccc039', 1);
  }
  ctx.restore();
  path(ctx, [[waterL, surface], [waterR, surface], [waterR - w * 0.028, yAt(3.1)], [waterR - w * 0.08, yAt(5.2)], [waterL + w * 0.07, yAt(5.2)], [waterL + w * 0.025, yAt(2.6)]], '#337f97', '#91dfde', 0.7);
  for (let i = 0; i < 7; i++) {
    const cx = mix(waterL + 10, waterR - 15, ((i / 7 + time / 14) % 1 + 1) % 1);
    path(ctx, [[cx, surface + 3], [cx + 8, surface + 3]], null, '#b3f2debc', 1.2);
  }
  for (const [from, to] of [[left, waterL], [waterR, right]]) {
    path(ctx, [[from, surface], [to, surface]], null, '#dae5bd', 1.5);
    for (let i = 0; i < 6; i++) {
      const x = from + 7 + (to - from - 14) * i / 6;
      const bw = (to - from - 14) / 7;
      const bh = [0.11, 0.13, 0.18, 0.07, 0.09, 0.14][i] * section;
      ctx.fillStyle = ['#789b9c', '#8ba7a7', '#a4b1a6'][i % 3];
      ctx.fillRect(x, surface - bh - 1, Math.max(4, bw - 2), bh);
      for (let j = 2; j < bh - 3; j += 7) path(ctx, [[x + 2, surface - j], [x + bw - 4, surface - j]], null, '#c6efe0a6', 0.7);
    }
  }
  if (depth > 4.0) {
    path(ctx, [[left + 6, yAt(5)], [waterL - 9, yAt(5)]], null, '#8de3e7', 3);
    path(ctx, [[waterR + 10, yAt(5)], [right - 6, yAt(5)]], null, '#8de3e7', 3);
  }
  if (depth > 9.8) {
    const bx = left + w * 0.08;
    const bw = w * 0.21;
    const by = yAt(8.3);
    const bh = Math.max(11, yAt(13) - by);
    roundBox(ctx, bx, by, bw, bh, '#292d4a', '#c4acff', 3);
    path(ctx, [[bx, by + bh / 2], [bx + bw, by + bh / 2]], null, '#baa2ec', 0.9);
    for (let i = 1; i < 5; i++) {
      const tx = bx + (bw / 6) * i;
      ctx.fillStyle = '#e0c2f3';
      ctx.fillRect(tx, by + bh * 0.22, Math.max(3, bw * 0.1), 2.8);
      ctx.fillRect(tx, by + bh * 0.71, Math.max(3, bw * 0.1), 2.8);
    }
    path(ctx, [[bx + 2, by + 2], [left + 4, surface]], null, '#b6a2ffb0', 1.5);
  }
  for (const [id, d, color, speed] of [['metro', 16, '#73f3de', 0.072], ['tunnel', 26, '#ffcb83', -0.052]]) {
    if (depth < d - 0.6) continue;
    const y = yAt(d);
    path(ctx, [[left + 5, y], [right - 5, y]], null, '#102339', d === 16 ? 12 : 10);
    path(ctx, [[left + 5, y - 5], [right - 5, y - 5]], null, color, 1);
    path(ctx, [[left + 5, y + 5], [right - 5, y + 5]], null, color, 1);
    const track = y + (d === 16 ? 0 : 1);
    const count = d === 16 ? 2 : 7;
    for (let i = 0; i < count; i++) {
      const [x] = passThrough(time * speed + i / count, left + 12, right - 25, track);
      const length = d === 16 ? Math.max(18, w * 0.085) : Math.max(6, w * 0.021);
      roundBox(ctx, x, track - 3.0, length, 6.0, color, null, 1.5);
      if (d === 16) {
        ctx.fillStyle = '#173b43';
        for (let j = 0; j < 4; j++) ctx.fillRect(x + (j + 0.4) * length / 4, track - 1.4, length * 0.115, 2);
        if (following && i === 0) {
          ctx.beginPath();
          ctx.arc(x + length / 2, track, 9, 0, TAU);
          ctx.lineWidth = 1.3;
          ctx.strokeStyle = '#faffdf';
          ctx.stroke();
        }
      } else dot(ctx, x - 1.0, track, 1.5, '#fff4b8');
    }
  }
  if (depth > 0) path(ctx, [[left + 3, cutoff], [right - 3, cutoff]], null, '#a6d8dc72', 1);
  text(ctx, '江面', (waterL + waterR) / 2, surface - 8, '#d6fbf3', compact ? 11 : 13, 700, 'center');
  const sectionLabels = { utilities: [0.80, 5], parking: [0.18, 12.7], metro: [0.79, 16], tunnel: [0.19, 26] };
  for (const [id, item] of Object.entries(underground)) {
    const spot = sectionLabels[id];
    if (!spot || depth < item.depth - 0.65) continue;
    const x = left + w * spot[0], y = yAt(spot[1]) - 15;
    addHit(id, item.label, x, Math.max(y, top + 12), item.color, true);
  }
  if (discover?.id === 'pump' && depth >= 12) {
    const x = right - w * 0.315, y = yAt(12), pw = w * 0.137, ph = Math.max(17, section * 0.099);
    const waterHeight = mix(ph * 0.88, ph * 0.12, discover.amount);
    roundBox(ctx, x, y, pw, ph, '#142b3c', '#78d8ec', 3);
    ctx.fillStyle = '#52c9eea8';
    ctx.fillRect(x + 2, y + ph - waterHeight, pw - 4, waterHeight - 1);
    path(ctx, [[x + pw, y + ph * 0.49], [x + pw + 10, y + ph * 0.49], [x + pw + 10, yAt(3.0)], [x + pw + 22, yAt(3.0)]], null, '#90eaea', 1.6);
    if (discover.amount > 0) {
      for (let i = 0; i < 4; i++) {
        const phase = (time * discover.amount + i / 4) % 1;
        dot(ctx, x + pw + 10, mix(y + ph * 0.49, yAt(3.0), phase), 1.5, '#acffed');
      }
    }
    addHit('pump', '集水池', x + pw / 2, y + ph, '#8ee9f9', true);
  } else if (discover?.id === 'air' && depth >= 24) {
    const y = yAt(26) - 13;
    const x = mix(waterL, waterR, 0.12), end = mix(waterL, waterR, 0.91);
    const spin = time * discover.amount * 5;
    dot(ctx, x - 10, y, 6.5, '#21485b');
    for (let blade = 0; blade < 4; blade++) {
      const angle = Math.PI * blade / 2 + spin;
      path(ctx, [[x - 10, y], [x - 10 + Math.cos(angle) * 4.5, y + Math.sin(angle) * 4.5]], null, '#b8f4e4', 1.2);
    }
    for (let i = 0; i < 7; i++) {
      const dx = mix(x, end, (i / 7 + time * discover.amount * 0.38) % 1);
      path(ctx, [[dx - 3, y - 2], [dx + 2, y], [dx - 3, y + 2]], null, discover.amount > 0 ? '#bcf3e2' : '#92cbb67a', 1.2);
    }
    addHit('air', '通风风道', end, y + 4, '#aaf8df', true);
  }
}

function drawBuilding(ctx, width, height, expansion, time, discover, addHit) {
  const small = width < 560;
  const center = width * (small ? 0.54 : 0.57);
  const rise = Math.min((height - 145) / 5.9, width * 0.127);
  const wide = Math.min(width * 0.55, rise * 4.5);
  const start = height - (small ? 71 : 63);
  const spread = expansion / 100;
  const levels = [
    ['foundation', '#617889', '基础'],
    ['shops', '#ddb881', '临街商铺'],
    ['homes', '#8abaae', '住宅楼层'],
    ['roof', '#a1bcbf', '屋顶'],
  ];
  const left = center - wide / 2;
  const right = center + wide / 2;
  const bump = Math.max(9, rise * 0.28);
  for (let i = 0; i < levels.length; i++) {
    const [id, shade, name] = levels[i];
    const floorY = start - rise * i * (0.78 + spread * 0.62);
    const thick = (i === 0 || i === levels.length - 1 ? 0.25 : 0.55 - spread * 0.16) * rise;
    path(ctx, [[left, floorY], [right, floorY], [right, floorY + thick], [left, floorY + thick]], shade, '#f3f3d8', 0.85);
    path(ctx, [[right, floorY], [right + bump, floorY - bump], [right + bump, floorY - bump + thick], [right, floorY + thick]], '#54727d', '#a8c6bb', 0.85);
    path(ctx, [[left, floorY], [right, floorY], [right + bump, floorY - bump], [left + bump, floorY - bump]], '#c7d5c0', '#e5e9d5', 0.85);
    if (i === 1 || i === 2) {
      const fill = i === 1 ? '#f8e2a5' : '#d5eee6';
      for (let j = 0; j < 8; j++) {
        const x = left + (0.075 + 0.114 * j) * wide;
        roundBox(ctx, x, floorY + thick * 0.21, wide * 0.074, thick * 0.53, fill, '#6c9b9e', 2);
      }
      if (spread > 0.3) {
        for (const fraction of [0.25, 0.49, 0.73]) {
          path(ctx, [[left + wide * fraction, floorY - 0.6], [left + wide * fraction + bump, floorY - bump]], null, '#243a44', 1.1);
        }
      }
    }
    if (i === 3) {
      for (let j = 0; j < 6; j++) roundBox(ctx, left + bump + 0.11 * wide * j, floorY - bump * 0.73, wide * 0.088, bump * 0.42, '#416b83', '#80aabc', 1.2);
    }
    if (spread > 0.28) addHit(id, buildingParts[id]?.label || name, left - (small ? 5 : 55), floorY + thick / 2, shade, true);
  }
  if (spread > 0.28) {
    const upper = start - rise * 3 * (0.78 + spread * 0.62) - 4;
    const coreX = center + wide * 0.23;
    ctx.setLineDash([3, 4]);
    path(ctx, [[coreX, start + 4], [coreX, upper]], null, '#fff1b3', 2);
    ctx.setLineDash([]);
    addHit('core', buildingParts.core.label, center + wide * 0.43, upper + (start - upper) * 0.38, '#eec88e', true);
  }
  if (discover?.id === 'load') {
    const upper = start - rise * 3 * (0.78 + spread * 0.62) - bump / 2;
    for (const factor of [0.23, 0.54, 0.83]) {
      const x = left + wide * factor;
      path(ctx, [[x, upper], [x, start + 7]], null, '#ffe17caa', 1 + discover.amount * 1.7);
      for (let i = 0; i < 4; i++) {
        const y = mix(upper, start + 3, (i / 4 + time * (0.13 + discover.amount * 0.44)) % 1);
        path(ctx, [[x - 3, y - 2], [x, y + 1.8], [x + 3, y - 2]], null, '#fff1ae', 1.5);
      }
    }
    addHit('load', '荷载传递', right, start + 1, '#ffe096', true);
  }
}

export function createCoastMap(container, { onNavigate = () => {}, onFeature = () => {}, onInteract = () => {} } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'coast-map';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '交互海湾地图。方向键平移，加减键缩放，Home 键还原。');
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: 'grab' });
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas 2D unavailable');
  container.append(canvas);

  const camera = { x: 0, y: 0, zoom: 1 };
  const target = { ...camera };
  const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const hits = [];
  const experiments = new Set();
  let mode = 'atlas', depth = 0, expansion = 0, night = false, following = false, discover = null, selectedPart;
  let width = 1, height = 1, ratio = 1, frameId = 0, shown = true, atlas, lastFrame = 0;
  let garden = false, rainStart = null, renderedTime = 0;
  const touches = new Map();

  function resetView(immediate = false) {
    const destination = destinations[mode] || destinations.atlas;
    const [x, y, z] = destination.focus;
    const [px, py] = project(x, z, y * 0.39);
    const overall = Math.min(width / 551, height / 290) * 1.03;
    target.x = mode === 'atlas' ? 8 : px;
    target.y = mode === 'atlas' ? -16 : py;
    target.zoom = mode === 'atlas' ? overall : Math.min(width / (destination.span * 1.35), height / (destination.span * 0.68));
    if (mode === 'building' || mode === 'river') target.zoom = overall * 1.53;
    if (immediate || reduceMotion?.matches) Object.assign(camera, target);
  }

  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 1.8);
    if (w === width && h === height && ratio === dpr) return;
    width = w;
    height = h;
    ratio = dpr;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    resetView(true);
  }

  function draw(now) {
    frameId = requestAnimationFrame(draw);
    if (!shown || (lastFrame && now - lastFrame < 1000 / 45)) return;
    lastFrame = now;
    renderedTime = now / 1000;
    if (experiments.has('plain') && rainStart === null) rainStart = renderedTime;
    const time = reduceMotion?.matches ? 0 : now / 1000;
    const amount = reduceMotion?.matches ? 1 : 0.105;
    for (const key of ['x', 'y', 'zoom']) camera[key] = mix(camera[key], target[key], amount);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    hits.length = 0;
    atlas ||= makeAtlas(night);
    const centerY = height * (width < 600 ? 0.56 : 0.54);
    const transform = (x, y) => [width * 0.5 + (x - camera.x) * camera.zoom, centerY + (y - camera.y) * camera.zoom];
    const [originX, originY] = transform(atlas.x0, atlas.y0);
    ctx.globalAlpha = mode === 'river' || mode === 'building' ? 0.40 : 1;
    ctx.drawImage(atlas.backing, originX, originY, atlas.width * camera.zoom, atlas.height * camera.zoom);
    ctx.globalAlpha = 1;
    if (experiments.has(mode) && trails[mode]) {
      const diverted = mode === 'plain' && garden;
      drawTrail(ctx, transform, diverted ? gardenTrail : trails[mode], time, diverted ? '#b4ffac' : night ? '#e8f5a6' : '#ffe5a0');
    }
    const labelPositions = [];
    function label(id, title, x, y, shade, feature = false) {
      const compact = width < 550;
      const font = compact ? 11 : 12;
      ctx.font = '650 ' + font + 'px system-ui, sans-serif';
      const boxW = ctx.measureText(title).width + (compact ? 19 : 23);
      const boxH = compact ? 20 : 25;
      if (x < 1 || x > width - 2 || y < 7 || y > height - 32) return;
      const bx = clamp(x - boxW / 2, 7, width - boxW - 7);
      let by = y - boxH - 8;
      if (!feature && by < (compact ? 102 : 79) && bx < width * (compact ? 0.52 : 0.39)) by += boxH + 19;
      for (let attempt = 0; attempt < 4 && labelPositions.some(pos => bx < pos.x + pos.w + 3 && bx + boxW + 3 > pos.x && by < pos.y + pos.h + 3 && by + boxH + 3 > pos.y); attempt++) by += boxH + 4;
      if (by < 40 || by > height - 57) return;
      const selected = feature && id === selectedPart;
      path(ctx, [[x, y], [bx + boxW / 2, by + boxH]], null, shade + 'bd', selected ? 2 : 1);
      dot(ctx, x, y, compact ? 2.5 : 3.0, shade);
      roundBox(ctx, bx, by, boxW, boxH, selected ? shade : '#132735f1', shade + 'b0', 4);
      text(ctx, title, bx + boxW / 2, by + boxH / 2, selected ? '#11242e' : '#f2fbf5', font, 650, 'center');
      labelPositions.push({ x: bx, y: by, w: boxW, h: boxH });
      hits.push({ id, feature, x: bx - 3, y: by - 3, width: boxW + 6, height: boxH + 6 });
    }

    if (mode === 'river') drawSection(ctx, width, height, depth, time, following, discover, label);
    else if (mode === 'building') drawBuilding(ctx, width, height, expansion, time, discover, label);
    else {
      for (const [key, x, z, elevation] of anchors) {
        if (key === mode || (key === 'building' && mode !== 'plain' && mode !== 'lake')) continue;
        const entry = destinations[key];
        if (!entry) continue;
        const [sx, sy] = transform(...project(x, z, elevation));
        label(key, entry.label, sx, sy, entry.accent);
      }
      const vessel = transform(...project(110 - Math.sin(time * 0.12) * 28, 22 + Math.sin(time * 0.31) * 3));
      const ship = Math.max(2.0, camera.zoom * 2.1);
      path(ctx, [[vessel[0] - ship, vessel[1] - ship * 0.44], [vessel[0] + ship, vessel[1] - ship * 0.44], [vessel[0] + ship * 1.5, vessel[1]], [vessel[0] + ship, vessel[1] + ship * 0.44], [vessel[0] - ship, vessel[1] + ship * 0.44]], '#f1e4bd');
      if (mode === 'plain' && experiments.has('plain')) {
        const [sx, sy] = transform(...project(-24, 29));
        const [ex, ey] = transform(...project(22, 48));
        for (let i = 0; i < 130; i++) {
          const dx = sx + ((i * 127) % 233) / 233 * (ex - sx);
          const dy = sy + ((time * (47 + (i % 17)) + (i * 89) % 148) % Math.max(10, ey - sy + 50)) - 30;
          path(ctx, [[dx, dy], [dx - 1, dy + 6]], null, '#c7f4f48a', 0.8);
        }
      }
    }
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY, traveled: 0, moving: false });
    canvas.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event) {
    const pointer = touches.get(event.pointerId);
    if (!pointer) return;
    const priorX = pointer.x, priorY = pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const dx = pointer.x - priorX, dy = pointer.y - priorY;
    pointer.traveled += Math.abs(dx) + Math.abs(dy);
    if (mode === 'river' || mode === 'building') return;
    if (touches.size === 2) {
      const other = [...touches].find(([id]) => id !== event.pointerId)[1];
      const old = Math.hypot(priorX - other.x, priorY - other.y);
      const next = Math.hypot(pointer.x - other.x, pointer.y - other.y);
      if (!pointer.moving) onInteract();
      pointer.moving = other.moving = true;
      pointer.traveled = other.traveled = 7;
      if (old > 3 && next > 3) zoom(next / old);
    } else if (touches.size === 1 && pointer.traveled > 4) {
      if (!pointer.moving) { pointer.moving = true; onInteract(); }
      target.x = clamp(target.x - dx / camera.zoom, -205, 245);
      target.y = clamp(target.y - dy / camera.zoom, -138, 126);
      canvas.style.cursor = 'grabbing';
    }
  }
  function onPointerEnd(event) {
    const previous = touches.get(event.pointerId);
    if (!previous) return;
    touches.delete(event.pointerId);
    canvas.style.cursor = 'grab';
    if (event.type !== 'pointerup' || previous.traveled > 6 || previous.moving) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    let hit;
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      if (x >= h.x && x <= h.x + h.width && y >= h.y && y <= h.y + h.height) { hit = h; break; }
    }
    if (hit?.feature) onFeature(hit.id);
    else if (hit) onNavigate(hit.id);
  }
  function zoom(factor) {
    if (mode === 'river' || mode === 'building') return;
    target.zoom = clamp(target.zoom * factor, width / 760, width / 35);
  }
  function onWheel(event) {
    if (mode === 'river' || mode === 'building') return;
    event.preventDefault();
    onInteract();
    zoom(Math.exp(-clamp(event.deltaY, -160, 160) * 0.002));
  }
  function onKey(event) {
    const key = event.key;
    if (!['Home', '+', '=', '-', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return;
    event.preventDefault();
    onInteract();
    if (key === 'Home') resetView();
    else if (key === '+' || key === '=') zoom(1.28);
    else if (key === '-') zoom(0.8);
    else if (mode !== 'river' && mode !== 'building') {
      const nudge = 14 / camera.zoom;
      target.x = clamp(target.x + (key === 'ArrowRight' ? nudge : key === 'ArrowLeft' ? -nudge : 0), -205, 245);
      target.y = clamp(target.y + (key === 'ArrowDown' ? nudge : key === 'ArrowUp' ? -nudge : 0), -138, 126);
    }
  }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('lostpointercapture', onPointerEnd);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  const intersection = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(([entry]) => { shown = entry.isIntersecting; }) : null;
  resizeObserver?.observe(container);
  intersection?.observe(container);
  resize();
  resetView(true);
  frameId = requestAnimationFrame(draw);
  function restart() { rainStart = null; }
  return {
    setMode(id, immediate = false) {
      if (id !== mode || immediate) {
        if (id !== mode) selectedPart = undefined;
        mode = id;
        resetView(immediate);
      }
    },
    setDepth(value) { depth = clamp(Number(value) || 0, 0, 30); },
    setExpansion(value) { expansion = clamp(Number(value) || 0, 0, 100); },
    setNight(value) { if (night !== Boolean(value)) { night = Boolean(value); atlas = null; } },
    setExperiment(id, active) {
      const changed = experiments.has(id) !== Boolean(active);
      if (active) experiments.add(id);
      else experiments.delete(id);
      if (changed && id === 'plain') rainStart = null;
    },
    setGarden(value) { garden = Boolean(value); },
    restart,
    replay: restart,
    progress() { return rainStart === null ? 0 : clamp((renderedTime - rainStart) / 8.5, 0, 1); },
    setDiscover(id, state) {
      const amount = Number(typeof state === 'object' ? state?.value : state);
      discover = id && state !== null && state !== undefined && Number.isFinite(amount)
        ? { id, amount: clamp(amount / 100, 0, 1) } : null;
    },
    selectPart(id) { selectedPart = id; },
    setFollowing(value) { following = Boolean(value); },
    resetView,
    zoom(factor) { if (factor > 0) zoom(1 / factor); },
    resize,
    destroy() {
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      intersection?.disconnect();
      canvas.remove();
    },
  };
}
