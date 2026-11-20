function line(ctx, color, width, ...points) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function box(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function words(ctx, value, x, y, color, size) {
  ctx.fillStyle = color;
  ctx.font = '650 ' + size + 'px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

function circle(ctx, x, y, r, color, edge) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function panel(ctx, w, h, compact) {
  const width = Math.min(w * (compact ? 0.91 : 0.74), 900);
  const height = h * (compact ? 0.33 : 0.40);
  const x = (w - width) / 2;
  const y = h * (compact ? 0.30 : 0.29);
  box(ctx, '#112839f5', x, y, width, height);
  ctx.strokeStyle = '#8bb5c5';
  ctx.lineWidth = 1.1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  return { x, y, w: width, h: height };
}

export function drawPumpStudy(ctx, w, h, telemetry, time) {
  const compact = w < 600;
  const p = panel(ctx, w, h, compact);
  const typeSize = compact ? 10 : 15;
  const plotY = p.y + p.h * 0.49;
  const inlet = p.x + p.w * 0.09;
  const well = p.x + p.w * 0.27;
  const pump = p.x + p.w * 0.58;
  const outlet = p.x + p.w * 0.89;
  const tankW = p.w * 0.18, tankH = p.h * 0.42;
  const blue = '#80dcef', green = '#a7ecd1', amber = '#ffd180';
  const alarm = telemetry.alarm ? '#ff9e7a' : blue;
  const tankTop = plotY - tankH * 0.30;
  const tankBottom = tankTop + tankH;
  const cross = p.h * 0.125;
  const channel = tankBottom - tankH * telemetry.level;
  words(ctx, '来水', inlet, p.y + p.h * 0.122, blue, typeSize);
  words(ctx, '集水井', well + tankW / 2, p.y + p.h * 0.122, alarm, typeSize);
  words(ctx, '泵与止回阀', pump, p.y + p.h * 0.122, green, typeSize);
  words(ctx, '出水', outlet, p.y + p.h * 0.122, blue, typeSize);
  line(ctx, '#426072', 4, [inlet, plotY], [well, plotY]);
  line(ctx, '#567886', 6, [inlet, plotY], [well, plotY]);
  line(ctx, blue, 1.15, [inlet, plotY], [well, plotY]);
  box(ctx, '#183749', well, tankTop, tankW, tankH);
  box(ctx, telemetry.alarm ? '#b66761' : '#388caf', well + 2, channel, tankW - 4, Math.max(0, tankBottom - channel - 1.5));
  ctx.strokeStyle = alarm;
  ctx.strokeRect(well, tankTop, tankW, tankH);
  for (const rate of [0.2, 0.4, 0.6, 0.8]) {
    const mark = tankBottom - tankH * rate;
    line(ctx, rate > 0.75 ? '#ffc2a4' : '#cee8e4', 0.8, [well + tankW - 6, mark], [well + tankW, mark]);
  }
  const radius = Math.max(5, Math.min(11, p.w * 0.024));
  for (const [dy, flow, color, label] of [
    [-cross, telemetry.main, green, '主泵'],
    [cross, telemetry.backup, amber, '备用泵'],
  ]) {
    const y = plotY + dy;
    line(ctx, flow ? color : '#57717e', 2.5, [well + tankW, plotY], [pump - radius * 2, plotY], [pump - radius * 2, y], [outlet - radius, y], [outlet, plotY]);
    circle(ctx, pump, y, radius, flow ? '#31566a' : '#233948', flow ? color : '#63818a');
    const rotation = flow ? time * flow * 12 : 0;
    line(ctx, color, 1.1, [pump - Math.cos(rotation) * radius * 0.6, y - Math.sin(rotation) * radius * 0.6],
      [pump + Math.cos(rotation) * radius * 0.6, y + Math.sin(rotation) * radius * 0.6]);
    const valveX = pump + radius * 2.2;
    line(ctx, color, 1.3, [valveX - 2, y - 4], [valveX + (flow ? 4 : -2), y + 4]);
    if (flow) {
      const offset = (time * Math.max(flow, 0.15) * 29) % 19;
      for (let q = valveX + 7 + offset; q < outlet - radius; q += 19) circle(ctx, q, y, 1.6, color, color);
    }
    if (!compact) words(ctx, label, pump, y + (dy < 0 ? -radius - 8 : radius + 7), color, 10);
  }
  if (telemetry.inflow) {
    const offset = (time * (13 + 26 * telemetry.inflow)) % 13;
    for (let q = inlet + offset; q < well; q += 13) circle(ctx, q, plotY, 1.7, blue, blue);
  }
  const target = {
    inlet: [(inlet + well) / 2, plotY],
    well: [well + tankW / 2, plotY],
    pumps: [pump, plotY],
    outlet: [outlet, plotY],
  }[telemetry.stage];
  if (target) {
    ctx.beginPath();
    ctx.arc(...target, p.h * 0.17, 0, Math.PI * 2);
    ctx.strokeStyle = '#f7e2a5';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  words(ctx, telemetry.alarm ? '高水位警报' : '集水井 ' + Math.round(telemetry.level * 100) + '%',
    well + tankW / 2, p.y + p.h * 0.9, alarm, typeSize);
}

export function drawWaterStudy(ctx, w, h, id, progress, time) {
  const compact = w < 600;
  const p = panel(ctx, w, h, compact);
  const size = compact ? 10 : 15;
  if (id === 'lock') {
    const left = p.x + p.w * 0.08, right = p.x + p.w * 0.92;
    const a = p.x + p.w * 0.30, b = p.x + p.w * 0.70;
    const upper = p.y + p.h * 0.33, lower = p.y + p.h * 0.59, floor = p.y + p.h * 0.84;
    const raise = Math.max(0, Math.min(1, (progress - 0.35) / 0.38));
    const waterY = lower - (lower - upper) * raise;
    box(ctx, '#364953', left, floor, right - left, p.h * 0.055);
    box(ctx, '#3689a8', left, upper, a - left, floor - upper);
    box(ctx, '#419cba', a, waterY, b - a, floor - waterY);
    box(ctx, '#337e9d', b, lower, right - b, floor - lower);
    const lowGate = progress < 0.22 ? 1 : Math.max(0, Math.min(1, (0.35 - progress) / 0.13));
    const highGate = Math.max(0, Math.min(1, (progress - 0.73) / 0.14));
    for (const [x, gap] of [[a, highGate], [b, lowGate]]) {
      box(ctx, '#a68154', x - 2.5, upper - p.h * 0.18, 5, (floor - upper + p.h * 0.18) * (1 - gap));
    }
    const boatX = progress < 0.22 ? right - (right - p.x - p.w / 2) * (progress / 0.22) :
      progress < 0.87 ? p.x + p.w / 2 : p.x + p.w / 2 - (p.x + p.w / 2 - left - 10) * (progress - 0.87) / 0.13;
    const boatY = boatX > b ? lower : boatX < a ? upper : waterY;
    const boatW = p.w * 0.074;
    ctx.beginPath();
    ctx.moveTo(boatX - boatW / 2, boatY - 5);
    ctx.lineTo(boatX + boatW / 2, boatY - 5);
    ctx.lineTo(boatX + boatW * 0.38, boatY + 2);
    ctx.lineTo(boatX - boatW * 0.28, boatY + 2);
    ctx.closePath();
    ctx.fillStyle = '#ffda8b';
    ctx.fill();
    words(ctx, '上游', (left + a) / 2, p.y + p.h * 0.13, '#ffc990', size);
    words(ctx, '闸室', p.x + p.w / 2, p.y + p.h * 0.13, '#e7f3ed', size);
    words(ctx, '下游', (b + right) / 2, p.y + p.h * 0.13, '#a2def1', size);
  } else {
    for (let i = 0; i < 8; i++) {
      const band = i / 8;
      const flooded = band < progress;
      const left = p.x + p.w * 0.10, right = p.x + p.w * 0.90;
      const y = p.y + p.h * (0.23 + band * 0.56);
      line(ctx, flooded ? '#4d9fb0' : ['#b3ad76','#859d70','#a1a174'][i % 3], p.h * 0.076,
        [left, y + p.h * 0.08], [p.x + p.w * 0.38, y], [p.x + p.w * 0.58, y + p.h * 0.05], [right, y]);
    }
    for (let i = 0; i < 3; i++) {
      line(ctx, '#7bd7dc', i ? 2 : 4, [p.x + p.w * 0.14, p.y + p.h * 0.8],
        [p.x + p.w * (0.36 + i * 0.06), p.y + p.h * (0.64 - i * 0.04)],
        [p.x + p.w * (0.59 + i * 0.08), p.y + p.h * (0.47 - i * 0.05)]);
    }
    words(ctx, progress < 0.5 ? '退潮时露出泥滩' : '海水沿潮沟漫上来', p.x + p.w / 2, p.y + p.h * 0.10, '#caecb2', size);
    const ripple = (time * 0.2) % 1;
    if (progress > 0) circle(ctx, p.x + p.w * (0.22 + ripple * 0.50), p.y + p.h * (0.25 + progress * 0.24), 2, '#d4f5e6', '#d4f5e6');
  }
}
