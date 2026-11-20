import { GEO, geoSites } from './geo-data.js';

const cache = new WeakMap();
const ink = '#dce8ed';
const water = '#70aefa';
const pipe = '#61dcf8';
const sewer = '#f0ae67';
const concrete = '#e2d3b7';
const tau = Math.PI * 2;

function text(ctx, value, x, y, { size = 12, color = ink, weight = 600, align = 'left' } = {}) {
  ctx.font = weight + ' ' + size + 'px "Microsoft YaHei UI", "PingFang SC", system-ui, sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function line(ctx, points, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function polygon(ctx, points, fill, edge = null) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function dot(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, tau);
  ctx.fillStyle = color;
  ctx.fill();
}

function box(ctx, fill, x, y, width, height) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width, height);
}

function mixColor(hex, target, strength) {
  const base = Number.parseInt(hex.slice(1), 16);
  const channels = [base >> 16, (base >> 8) & 255, base & 255];
  return 'rgb(' + channels.map(channel => Math.round(channel + (target - channel) * strength)).join(',') + ')';
}

function random(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function labelBox(ctx, value, x, y, color, size, align = 'left') {
  ctx.font = '650 ' + size + 'px "Microsoft YaHei UI", "PingFang SC", system-ui, sans-serif';
  const width = Math.ceil(ctx.measureText(value).width) + 14;
  const origin = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
  box(ctx, '#122331f3', origin, y - size * 0.74, width, size * 1.48);
  line(ctx, [[origin, y - size * 0.74], [origin, y + size * 0.74]], color, 1.4);
  text(ctx, value, origin + 7, y, { size, color, weight: 650 });
}

function contour(chunk, depth, yAt) {
  return Array.from({ length: 21 }, (_, index) => {
    const t = index / 20;
    const drift = Math.min(depth * 0.061, 2.1) *
      (Math.sin(t * 5.9 + depth * 0.045 + chunk.index * 1.73) * 0.54 + Math.sin(t * 12.8 + chunk.index) * 0.24);
    return [chunk.left + t * chunk.width, yAt(depth + (depth === GEO.limit ? 0 : drift))];
  });
}

function grain(ctx, layer, chunk, topY, bottomY, muted) {
  const sample = random((chunk.index + 7) * 1736 + Math.round(layer.bottom * 13));
  const amplitude = muted ? 0.48 : 1;
  const clay = ['mud', 'silt', 'sand'].includes(layer.key);
  const rock = ['weathered', 'granite', 'bedrock', 'reef'].includes(layer.key);
  const count = Math.min(135, Math.round(chunk.width * Math.max(1, bottomY - topY) / (rock ? 105 : 65)));
  if (clay || rock) {
    ctx.globalAlpha = amplitude * (rock ? 0.46 : 0.33);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = chunk.left + sample() * chunk.width;
      const y = topY + sample() * (bottomY - topY);
      const length = 2 + sample() * (rock ? 18 : 12);
      ctx.moveTo(x, y);
      if (rock) {
        const slope = chunk.index % 2 ? 0.53 : -0.45;
        ctx.lineTo(x + length * 0.48, y + length * slope + 1.5);
        ctx.lineTo(x + length, y + length * slope * 0.62);
      } else {
        ctx.lineTo(x + length, y + (sample() - 0.5) * 1.2);
      }
    }
    ctx.lineWidth = rock ? 0.76 : 0.62;
    ctx.strokeStyle = rock ? '#d6bdc4' : '#e5d5a9';
    ctx.stroke();
  }
  ctx.globalAlpha = amplitude * 0.33;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const x = chunk.left + sample() * chunk.width;
    const y = topY + sample() * (bottomY - topY);
    const radius = 0.33 + sample() * (layer.key === 'cobble' || layer.key === 'gravel' ? 1.78 : 0.77);
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, tau);
  }
  ctx.fillStyle = '#f2d2a5';
  ctx.fill();
  ctx.globalAlpha = 1;
}

function layers(ctx, chunk, chart) {
  let top = 0;
  const labels = [];
  for (const layer of chunk.site.layers) {
    if (top >= chart.reveal) break;
    const bottom = layer.bottom;
    const areaTop = contour(chunk, top, chart.yAt);
    const areaBottom = contour(chunk, bottom, chart.yAt);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...areaTop[0]);
    for (const point of [...areaTop.slice(1), ...areaBottom.slice().reverse()]) ctx.lineTo(...point);
    ctx.closePath();
    ctx.clip();
    const bandStart = chart.yAt(top);
    const bandEnd = chart.yAt(Math.min(bottom, chart.reveal));
    const muted = chart.filter === 'pipes' || chart.filter === 'foundation';
    const shade = ctx.createLinearGradient(0, bandStart, 0, Math.max(bandStart + 1, bandEnd));
    shade.addColorStop(0, mixColor(layer.color, muted ? 45 : 255, muted ? 0.50 : 0.18));
    shade.addColorStop(1, mixColor(layer.color, 22, muted ? 0.63 : 0.32));
    box(ctx, shade, chunk.left - 1, bandStart - 11, chunk.width + 2, bandEnd - bandStart + 23);
    grain(ctx, layer, chunk, bandStart - 5, bandEnd + 5, muted);
    ctx.restore();
    line(ctx, areaTop, chart.filter === 'earth' ? '#ecd2a78a' : '#dbc6ae5e', 0.8);
    if (bandEnd - bandStart >= (chart.compact ? 28 : 31)) {
      labels.push({ label: layer.label, y: (bandStart + bandEnd) / 2 });
    }
    top = bottom;
  }
  return labels;
}

function skylineBuilding(ctx, x, base, w, rawHeight, fill) {
  const h = Math.max(2, rawHeight);
  box(ctx, fill, x, base - h, w, h);
  box(ctx, '#284554', x + w * 0.75, base - h, w * 0.25, h);
  line(ctx, [[x, base - h], [x + w, base - h]], '#9ab7bf', 0.9);
  if (w < 8 || h < 11) return;
  for (let y = base - h + 4; y < base - 2; y += 5) {
    for (let dx = 2; dx < w - 4; dx += 4) {
      if (Math.round(x + y + dx) % 4 !== 0) box(ctx, '#efd69cbb', x + dx, y, 1.7, 1.4);
    }
  }
}

function towerCrane(ctx, x, base, height, arm) {
  line(ctx, [[x, base], [x, base - height], [x + arm, base - height]], '#dda77a', 1.5);
  line(ctx, [[x - arm * 0.18, base - height * 0.92], [x + arm, base - height * 0.92], [x, base - height * 0.6]], '#bb8d71', 0.8);
  line(ctx, [[x + arm * 0.65, base - height], [x + arm * 0.65, base - height * 0.31]], '#e8c48c', 0.8);
}

function surface(ctx, chunk, chart) {
  const { left, width, site } = chunk;
  const y = chart.grade;
  const h = Math.min(chart.tall ? 95 : 79, width * (chart.compact ? 0.86 : 0.65));
  const xx = fraction => left + width * fraction;
  const yy = fraction => y - h * fraction;
  if (site.id === 'mountain') {
    polygon(ctx, [[xx(0.02), y], [xx(0.12), yy(0.44)], [xx(0.33), yy(1)], [xx(0.44), yy(0.62)],
      [xx(0.61), yy(0.73)], [xx(0.76), yy(0.24)], [xx(0.98), y]], '#47646d', '#8aadb0');
    polygon(ctx, [[xx(0.13), y], [xx(0.33), yy(1)], [xx(0.28), yy(0.4)], [xx(0.52), yy(0.27)], [xx(0.62), y]], '#658181');
    polygon(ctx, [[xx(0.26), yy(0.81)], [xx(0.33), yy(1)], [xx(0.38), yy(0.80)], [xx(0.34), yy(0.84)], [xx(0.32), yy(0.79)]], '#c4d7d3');
  } else if (site.id === 'valley') {
    for (let row = 3; row >= 0; row--) {
      const base = y - row * h * 0.09;
      polygon(ctx, [[xx(0.03 + row * 0.07), base], [xx(0.93 - row * 0.03), base],
        [xx(0.97 - row * 0.035), base + h * 0.08], [xx(0.02), base + h * 0.08]], row % 2 ? '#879c74' : '#aca76e', '#cad69c');
    }
    const houseW = width * 0.13;
    const houseX = xx(0.57);
    box(ctx, '#79a1a7', houseX, yy(0.57), houseW, h * 0.31);
    polygon(ctx, [[houseX - 2, yy(0.56)], [houseX + houseW * 0.5, yy(0.80)], [houseX + houseW + 2, yy(0.56)]], '#ba8966');
  } else if (site.id === 'oldcity' || site.id === 'riverbank') {
    const sizes = site.id === 'oldcity' ? [0.26, 0.50, 0.41, 0.61, 0.38] : [0.52, 0.82, 0.61, 0.99, 0.69];
    for (const [i, height] of sizes.entries()) {
      skylineBuilding(ctx, xx(0.10 + i * 0.17), y, width * (i % 2 ? 0.115 : 0.14), h * height,
        i % 2 ? '#537c88' : '#638e96');
    }
    if (site.id === 'riverbank') {
      box(ctx, '#5abed585', xx(0.61), y - 2.8, width * 0.39, 3.3);
      line(ctx, [[xx(0.48), yy(0.14)], [xx(0.68), yy(0.21)], [xx(0.96), yy(0.14)]], '#bdc5a0', 1.2);
    }
  } else if (site.id === 'harborfill') {
    for (let i = 0; i < 3; i++) towerCrane(ctx, xx(0.15 + i * 0.24), y, h * (0.65 + i * 0.06), width * 0.18);
    for (let i = 0; i < 8; i++) {
      box(ctx, ['#ba825f', '#6b9194', '#b9a276'][i % 3], xx(0.09 + i * 0.095), y - 3 - (i % 3 === 2 ? h * 0.11 : 0),
        width * 0.080, Math.max(2.3, h * 0.08));
    }
  } else {
    polygon(ctx, [[xx(0.02), y], [xx(0.21), yy(0.76)], [xx(0.50), yy(0.71)], [xx(0.68), yy(0.53)], [xx(0.71), y]],
      '#877476', '#cfb39e');
    polygon(ctx, [[xx(0.74), y], [xx(0.80), yy(0.38)], [xx(0.89), yy(0.41)], [xx(0.95), y]], '#9e826d', '#c7aa88');
    const lighthouse = xx(0.33);
    box(ctx, '#efe3bc', lighthouse, yy(1.02), Math.max(2, width * 0.046), h * 0.26);
    box(ctx, '#dc9c70', lighthouse - 1, yy(1.04), Math.max(3, width * 0.056), h * 0.07);
  }
  line(ctx, [[left, y], [left + width, y]], '#c7dcb4', chart.compact ? 1.6 : 2.0);
}

function groundWater(ctx, chunk, chart) {
  const { left, width, site } = chunk;
  if (site.water > chart.reveal) return;
  const height = chart.yAt(site.water);
  const bottom = chart.yAt(chart.reveal);
  box(ctx, '#4c8dda2d', left, height, width, bottom - height);
  const segments = Math.max(4, Math.floor(width / 6));
  for (let i = 0; i < segments; i++) {
    const x = left + (i + 0.27) * width / segments;
    line(ctx, [[x, height + Math.sin(i * 0.78) * 1.02], [x + width / segments * 0.57, height + Math.sin((i + 0.4) * 0.78) * 1.02]], water, 1.05);
  }
}

function foundation(ctx, chunk, chart) {
  const { left, width, site } = chunk;
  const shallow = site.foundation.type === 'pad' || site.foundation.type === 'strip';
  const axis = left + width * (chart.selected ? 0.34 : 0.46);
  const capWidth = Math.max(11, width * (chart.selected ? 0.23 : 0.45));
  const feet = chart.yAt(site.foundation.depth);
  const top = chart.grade;
  ctx.strokeStyle = concrete;
  ctx.lineWidth = 1.4;
  if (shallow) {
    const platformWidth = site.foundation.type === 'strip' ? capWidth : capWidth * 0.83;
    for (const offset of [-0.28, 0.25]) {
      const x = axis + capWidth * offset;
      line(ctx, [[x, top], [x, Math.max(top + 1, feet - 1)]], concrete, chart.selected ? 3.1 : 1.65);
    }
    box(ctx, '#d0a076', axis - platformWidth / 2, feet - Math.max(2, (feet - top) * 0.22), platformWidth, Math.max(2.0, (feet - top) * 0.22));
    line(ctx, [[axis - platformWidth / 2, feet], [axis + platformWidth / 2, feet]], '#ffe9bc', 1);
  } else {
    const pileCount = chart.selected ? 6 : 4;
    const capHeight = Math.max(3, Math.min(10, (feet - top) * 0.10));
    box(ctx, '#a7826a', axis - capWidth / 2, top, capWidth, capHeight);
    line(ctx, [[axis - capWidth / 2, top + capHeight], [axis + capWidth / 2, top + capHeight]], '#ebc492', 1.1);
    for (let i = 0; i < pileCount; i++) {
      const x = axis - capWidth * 0.39 + i * capWidth * 0.78 / (pileCount - 1);
      line(ctx, [[x, top + capHeight], [x, feet]], '#eec194a0', chart.selected ? 4.5 : 2.35);
      line(ctx, [[x - 0.55, top + capHeight], [x - 0.55, feet]], '#ffe8bc', chart.selected ? 1.05 : 0.8);
      line(ctx, [[x - 3, feet], [x + 3, feet]], '#f6d6a0', 1.25);
    }
  }
}

function utilityLines(ctx, chunk, chart) {
  const { left, width, site } = chunk;
  const point = fraction => left + width * fraction;
  const supplyY = chart.yAt(site.pipes.supply);
  const sewerY = chart.yAt(site.pipes.sewer);
  const begin = point(0.075);
  const end = point(0.93);
  const sewerDrop = Math.max(1.35, Math.min(8, (sewerY - chart.grade) * 0.11));
  const wide = chart.selected && chart.filter === 'pipes';
  if (wide) {
    polygon(ctx, [[point(0.09), chart.grade], [point(0.35), chart.grade], [point(0.40), supplyY + 9],
      [point(0.06), supplyY + 9]], '#9f795e', '#e8ba8c');
    polygon(ctx, [[point(0.52), chart.grade], [point(0.80), chart.grade], [point(0.89), sewerY + 10],
      [point(0.45), sewerY + 10]], '#9f795e', '#e8ba8c');
    box(ctx, '#e9b67b', point(0.06), supplyY + 4, width * 0.34, 4);
    box(ctx, '#e9b67b', point(0.45), sewerY + 5, width * 0.44, 4);
  }
  line(ctx, [[begin, supplyY], [end, supplyY]], '#153b52', wide ? 9 : chart.selected ? 5 : 3.3);
  line(ctx, [[begin, supplyY], [end, supplyY]], pipe, wide ? 4.6 : chart.selected ? 2.3 : 1.55);
  line(ctx, [[begin, sewerY - sewerDrop * 0.38], [end, sewerY + sewerDrop]], '#272c50', wide ? 10 : chart.selected ? 5 : 3.4);
  line(ctx, [[begin, sewerY - sewerDrop * 0.38], [end, sewerY + sewerDrop]], sewer, wide ? 4.6 : chart.selected ? 2.45 : 1.65);
  for (const position of [0.26, 0.61]) {
    const x = point(position);
    const top = position < 0.5 ? supplyY : sewerY + sewerDrop * position;
    const color = position < 0.5 ? pipe : sewer;
    line(ctx, [[x, chart.grade], [x, top]], '#344e58', wide ? 9 : 4.8);
    line(ctx, [[x, chart.grade + 1], [x, top]], color, wide ? 1.05 : 0.72);
    line(ctx, [[x - (wide ? 5 : 2.2), chart.grade], [x + (wide ? 5 : 2.2), chart.grade]], '#e5edf1', wide ? 2 : 1.2);
    dot(ctx, x, top, wide ? 4.2 : 2.1, color);
  }
  if (wide) {
    const scale = chart.compact ? 10 : 13;
    if (site.pipes.supply <= chart.reveal) {
      labelBox(ctx, '给水 ' + site.pipes.supply + ' m', point(0.11), supplyY + scale * 1.9, pipe, scale);
      if (!chart.compact) text(ctx, '回填', point(0.19), chart.grade + (supplyY - chart.grade) * 0.49, { color: '#f2ddc8', size: 11 });
    }
    if (site.pipes.sewer + 0.3 <= chart.reveal) {
      labelBox(ctx, '重力排水 ' + site.pipes.sewer + ' m', point(0.55), sewerY + scale * 2.1, sewer, scale);
      if (!chart.compact) text(ctx, '管底垫层', point(0.68), sewerY + 10, { color: '#ffe2a8', size: 11 });
    }
  }
}

function ruler(ctx, chart) {
  const step = chart.limit <= 14 ? 2 : chart.limit <= 32 ? 5 : 10;
  const ticks = [0];
  for (let meter = step; meter < chart.limit - step * 0.42; meter += step) ticks.push(meter);
  ticks.push(chart.limit);
  const scale = chart.compact ? 10 : 12;
  const rulerX = chart.left - 8;
  line(ctx, [[rulerX, chart.grade], [rulerX, chart.yAt(chart.limit)]], '#a3c2ca82');
  for (const tick of ticks) {
    const y = chart.yAt(tick);
    const active = tick <= chart.reveal;
    line(ctx, [[rulerX - 6, y], [rulerX, y]], active ? '#f1ddb3' : '#738f96');
    text(ctx, tick === 0 ? '0 m' : String(tick), rulerX - 9, y,
      { size: scale, color: active ? '#f0dcad' : '#9db1ba', align: 'right' });
    if (tick && tick < chart.limit) {
      line(ctx, [[chart.left, y], [chart.right, y]], active ? '#bddbe021' : '#8299a419', 0.8);
    }
  }
}

function detailLabels(ctx, chunk, chart, bands) {
  const { left, width, site } = chunk;
  const scale = chart.compact ? 10 : 12;
  const labelX = left + width - 9;
  if (chart.filter === 'pipes') return;
  if (chart.filter !== 'foundation') {
    for (const entry of bands) {
      labelBox(ctx, entry.label, labelX, entry.y, '#ebd5b6', scale, 'right');
    }
    if (chart.reveal >= site.water + 0.65) {
      labelBox(ctx, '地下水位 ' + site.water + ' m', left + 8, chart.yAt(site.water) + 6, water, scale);
    }
  }
  if (chart.filter !== 'earth' && site.foundation.depth <= chart.reveal) {
    const x = left + width * 0.34;
    const end = chart.yAt(site.foundation.depth);
    const y = Math.min(chart.yAt(chart.reveal) - 10, end + 17);
    line(ctx, [[x, end], [x, y], [x + width * 0.10, y]], concrete, 0.9);
    labelBox(ctx, site.foundation.label + ' ' + site.foundation.depth + ' m', x + width * 0.10, y, concrete, scale);
  }
}

function createChart(width, height, { site, depth, filter }) {
  const compact = width < 620;
  const selected = geoSites.find(item => item.id === site);
  const left = compact ? 44 : Math.max(64, width * 0.072);
  const right = width - (compact ? 13 : Math.max(33, width * 0.048));
  const grade = height * (compact ? 0.40 : 0.37);
  const floor = Math.max(grade + 26, Math.min(height * 0.86, height - (compact ? 107 : 110)));
  let limit = GEO.limit;
  if (selected && filter === 'pipes') limit = 12;
  if (selected && filter === 'foundation') limit = Math.min(GEO.limit, Math.max(10, Math.ceil((selected.foundation.depth + 6) / 5) * 5));
  const yAt = value => grade + value / limit * (floor - grade);
  const reveal = Math.min(limit, depth);
  const charts = selected ? [selected] : geoSites;
  const stripWidth = right - left;
  const total = charts.at(-1).max - charts[0].min;
  const chunks = charts.map(item => ({
    site: item,
    index: geoSites.indexOf(item),
    left: left + (item.min - charts[0].min) / total * stripWidth,
    width: (item.max - item.min) / total * stripWidth,
  }));
  return { compact, selected, tall: height > 620, left, right, grade, floor, limit, reveal, yAt, filter, chunks };
}

function render(ctx, width, height, options) {
  const chart = createChart(width, height, options);
  const { left, right, grade, floor, chunks, yAt, filter } = chart;
  const exposed = yAt(chart.reveal);
  const wallWidth = right - left;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const groundShadow = ctx.createLinearGradient(0, grade - 18, 0, floor + 12);
  groundShadow.addColorStop(0, '#132a34b8');
  groundShadow.addColorStop(1, '#10192236');
  box(ctx, groundShadow, left, grade, wallWidth, floor - grade);
  if (chart.reveal > 0) {
    const lean = chart.compact ? 8 : 23;
    polygon(ctx, [[right, grade], [right + lean, grade - 9], [right + lean, exposed - 9], [right, exposed]], '#263743', '#68727b');
    polygon(ctx, [[left, exposed], [right, exposed], [right + lean, exposed - 9], [left + lean, exposed - 9]], '#172632');
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, grade, wallWidth + 0.5, Math.max(0, exposed - grade));
    ctx.clip();
    const detail = new Map();
    for (const chunk of chunks) detail.set(chunk, layers(ctx, chunk, chart));
    for (const chunk of chunks) {
      if (filter === 'all' || filter === 'earth') groundWater(ctx, chunk, chart);
      if (filter === 'all' || filter === 'pipes') utilityLines(ctx, chunk, chart);
      if (filter === 'all' || filter === 'foundation') foundation(ctx, chunk, chart);
      if (chart.selected) detailLabels(ctx, chunk, chart, detail.get(chunk));
    }
    ctx.restore();
    line(ctx, [[left, exposed], [right, exposed]], '#cbd2acbc', 1.25);
  }
  ruler(ctx, chart);
  const hits = [];
  for (const [index, chunk] of chunks.entries()) {
    if (index > 0) line(ctx, [[chunk.left, grade], [chunk.left, exposed]], '#e3d5b549', 0.75);
    surface(ctx, chunk, chart);
    const center = chunk.left + chunk.width / 2;
    const scale = chart.compact ? 10 : 13;
    if (chart.compact && !chart.selected) {
      text(ctx, chunk.site.label.slice(0, 2), center, floor + 12, { size: scale, color: '#f3e4c5', align: 'center' });
      text(ctx, chunk.site.label.slice(2), center, floor + 25, { size: scale, color: '#f3e4c5', align: 'center' });
    } else {
      text(ctx, chunk.site.label, center, floor + 16, { size: scale, color: '#f3e4c5', align: 'center' });
    }
    hits.push({ id: chunk.site.id, x: chunk.left, y: grade - 21, width: chunk.width, height: floor - grade + 49 });
  }
  ctx.restore();
  return hits;
}

/** Paint the six-site section and return canvas-space hit regions in display coordinates. */
export function drawGeoMap(ctx, width, height, { site = null, depth = GEO.limit, filter = 'all' } = {}) {
  if (width < 80 || height < 100) return [];
  const amount = Number(depth);
  const safeDepth = Number.isFinite(amount) ? Math.max(0, Math.min(GEO.limit, amount)) : GEO.limit;
  const options = { site, depth: safeDepth, filter };
  const density = Math.max(1, Math.min(1.6, globalThis.devicePixelRatio || 1));
  const key = [width, height, density, site, safeDepth, filter].join('/');
  let entry = cache.get(ctx);
  if (entry?.key !== key) {
    const canvas = entry?.canvas ?? globalThis.document?.createElement('canvas');
    const backing = canvas?.getContext('2d');
    if (!backing || backing === ctx) return render(ctx, width, height, options);
    canvas.width = Math.ceil(width * density);
    canvas.height = Math.ceil(height * density);
    backing.setTransform(density, 0, 0, density, 0, 0);
    entry = { key, canvas, hits: render(backing, width, height, options) };
    cache.set(ctx, entry);
  }
  ctx.drawImage(entry.canvas, 0, 0, width, height);
  return entry.hits;
}
