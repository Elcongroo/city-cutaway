import * as THREE from './vendor/three.module.js';
import { createBuilding } from './building.js';
import { createCoastTerrain, groundY, riverZ } from './coast-terrain.js';
import { createCoastCity } from './coast-city.js';
import { createCoastInfrastructure } from './coast-infrastructure.js';
import { createCoastExperiments } from './coast-effects.js';
import { destinations, underground, buildingParts, experiments, tourStops } from './coast-guide.js';

const ui = Object.fromEntries([
  'app', 'viewport', 'loading', 'places', 'pins', 'scene-title', 'scene-intro', 'night', 'reset-view', 'fullscreen',
  'tour', 'cut-cta', 'view-status', 'controls', 'slider-panel', 'range-label', 'range-value', 'depth', 'scale',
  'follow', 'experiment-panel', 'experiment-note', 'experiment', 'garden', 'replay', 'rain-progress',
  'guide-heading', 'guide-copy', 'features',
].map(id => [id, document.getElementById(id)]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const { clamp, damp, lerp, degToRad } = THREE.MathUtils;
const maximumDepth = 30;

function start() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0, 0);
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.17;
  const canvas = renderer.domElement;
  ui.viewport.append(canvas);

  const scene = new THREE.Scene();
  const dayFog = new THREE.Color(0x5b788a);
  const nightFog = new THREE.Color(0x263551);
  scene.fog = new THREE.FogExp2(dayFog, 0.00091);
  const camera = new THREE.PerspectiveCamera(41, 1, 0.3, 2300);
  const daySky = new THREE.Color(0xe3f4ff);
  const nightSky = new THREE.Color(0x788ac4);
  const ambient = new THREE.HemisphereLight(daySky, 0x8b8277, 2.1);
  const sun = new THREE.DirectionalLight(0xffe3b8, 2.65);
  sun.position.set(-95, 160, 74);
  const fill = new THREE.DirectionalLight(0x9bc8fa, 1.35);
  fill.position.set(98, 53, -94);
  scene.add(ambient, sun, fill);

  const terrain = createCoastTerrain(scene);
  const city = createCoastCity(scene);
  const infrastructure = createCoastInfrastructure(scene);
  const experiment = createCoastExperiments(scene);
  for (const material of city.cutMaterials || []) {
    material.clippingPlanes = terrain.cutPlanes;
    material.clipIntersection = true;
  }

  const property = new THREE.Group();
  const propertyGround = groundY(-34, -27);
  property.position.set(-34, propertyGround, -27);
  scene.add(property);
  const building = createBuilding(property);
  building.update(0, 0, 0, null);

  const places = [
    ['hill', new THREE.Vector3(-93, groundY(-93, -37) + 3.7, -37)],
    ['rural', new THREE.Vector3(-83, groundY(-83, 43) + 3.3, 43)],
    ['lake', city.landmarks.lake.clone().add(new THREE.Vector3(0, 2.2, 0))],
    ['plain', city.landmarks.northSkyline.clone().add(new THREE.Vector3(0, 3, 0))],
    ['river', new THREE.Vector3(8, 2.4, riverZ(8) + 5)],
    ['harbor', city.landmarks.harbor.clone()],
    ['building', new THREE.Vector3(-34, propertyGround + 14.0, -27)],
  ];

  const current = {
    focus: new THREE.Vector3(),
    span: destinations.atlas.span,
    yaw: destinations.atlas.yaw,
    pitch: destinations.atlas.pitch,
  };
  const desired = { ...current, focus: new THREE.Vector3() };
  const offset = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  const train = new THREE.Vector3();
  const nav = [...ui.places.querySelectorAll('[data-route]')];
  const activeExperiments = new Map();

  let mode;
  let selected;
  let depth = 0;
  let cut = 0;
  let expansion = 0;
  let opened = 0;
  let night = false;
  let nightLevel = 0;
  let following = false;
  let garden = false;
  let pins = [];
  let featureButtons = [];
  let flight;
  let tour;
  let time = 0;
  let last = 0;
  let showing = true;
  let rendering = true;
  let renderFrame = 0;
  let width = 1;
  let height = 1;

  function poseFor(id) {
    const profile = destinations[id];
    const focus = new THREE.Vector3(...profile.focus);
    if (id === 'building') focus.y += propertyGround;
    return { focus, span: profile.span, yaw: profile.yaw, pitch: profile.pitch };
  }

  function blendPose(target, amount) {
    current.focus.lerp(target.focus, amount);
    current.span = lerp(current.span, target.span, amount);
    current.yaw = lerp(current.yaw, target.yaw, amount);
    current.pitch = lerp(current.pitch, target.pitch, amount);
  }

  function flyTo(target, immediate = false) {
    desired.focus.copy(target.focus);
    desired.span = target.span;
    desired.yaw = target.yaw;
    desired.pitch = target.pitch;
    if (immediate || reduceMotion.matches) {
      flight = undefined;
      blendPose(desired, 1);
      return;
    }
    const distance = current.focus.distanceTo(target.focus);
    flight = {
      from: { ...current, focus: current.focus.clone() },
      spanLift: clamp(distance * 0.27, 3, 44),
      heightLift: clamp(distance * 0.098, 1.2, 19),
      duration: clamp(0.88 + distance * 0.0084 + Math.abs(current.span - target.span) * 0.003, 0.92, 2.5),
      time: 0,
    };
  }

  function updateCamera(dt) {
    if (following) {
      infrastructure.getTrainPosition(train);
      desired.focus.set(train.x * 0.67 + 3, train.y + 5.2, clamp(train.z, -15, 48));
    }
    if (flight) {
      flight.time = Math.min(flight.duration, flight.time + dt);
      const fraction = flight.time / flight.duration;
      const ease = fraction * fraction * (3 - 2 * fraction);
      const arc = Math.sin(Math.PI * ease);
      current.focus.lerpVectors(flight.from.focus, desired.focus, ease);
      current.focus.y += arc * flight.heightLift;
      current.span = lerp(flight.from.span, desired.span, ease) + arc * flight.spanLift;
      current.yaw = lerp(flight.from.yaw, desired.yaw, ease);
      current.pitch = lerp(flight.from.pitch, desired.pitch, ease);
      if (fraction >= 1) {
        flight = undefined;
        updateStatus();
      }
    } else {
      const easing = reduceMotion.matches ? 1 : 1 - Math.exp(-dt * 7);
      blendPose(desired, easing);
    }

    const halfVertical = Math.tan(degToRad(camera.fov / 2));
    const distance = Math.max(current.span / camera.aspect, current.span * 0.55) / (2 * halfVertical);
    const horizontal = Math.cos(current.pitch) * distance;
    offset.set(Math.sin(current.yaw) * horizontal, Math.sin(current.pitch) * distance, Math.cos(current.yaw) * horizontal);
    camera.position.copy(current.focus).add(offset);
    const increase = Math.max(0, groundY(camera.position.x, camera.position.z) + 4 - camera.position.y);
    camera.position.y += increase;
    camera.lookAt(current.focus);
    camera.updateMatrixWorld();
  }

  function button(label, action) {
    const node = document.createElement('button');
    node.type = 'button';
    node.textContent = label;
    node.addEventListener('click', action);
    return node;
  }

  function detailSet() {
    if (mode === 'river') return underground;
    if (mode === 'building') return buildingParts;
    return {};
  }

  function updateGuide() {
    const item = detailSet()[selected] || destinations[mode];
    ui['guide-heading'].textContent = item.question;
    ui['guide-copy'].textContent = item.detail;
    for (const [id, node] of featureButtons) node.setAttribute('aria-pressed', selected === id);
    for (const pin of pins) if (pin.part) pin.node.setAttribute('aria-pressed', selected === pin.id);
  }

  function selectPart(id) {
    const item = detailSet()[id];
    if (!item) return;
    stopTour();
    setFollowing(false);
    selected = id;
    if (mode === 'river' && depth < item.depth) setDepth(item.depth);
    if (mode === 'building' && expansion < 72) setExpansion(82);
    updateGuide();
  }

  function updateStatus() {
    let message = '';
    if (following) message = '正在跟拍过江地铁';
    else if (flight) message = '正在飞往' + destinations[mode].label;
    else if (mode === 'river' && depth) message = '剖面深度 ' + depth + ' m';
    else if (tour) message = '沿江巡游 ' + (tour.index + 1) + ' / ' + tourStops.length;
    if (ui['view-status'].textContent !== message) ui['view-status'].textContent = message;
  }

  function setupPins() {
    pins = places
      .filter(([id]) => id !== mode && (id !== 'building' || mode === 'plain' || mode === 'lake'))
      .map(([id, point]) => ({ id, point, label: destinations[id].label, color: destinations[id].accent }));
    if (mode === 'river') {
      for (const [id, point] of Object.entries(infrastructure.features)) {
        const item = underground[id];
        if (item) pins.push({ id, point, label: item.label, color: item.color, part: true, minimum: item.depth - 2 });
      }
    }
    if (mode === 'building') {
      for (const { id, position } of building.hotspots) {
        pins.push({ id, point: position, label: buildingParts[id].label, part: true, local: true });
      }
    }
    pins = pins.map(pin => {
      const node = button(pin.label, () => pin.part ? selectPart(pin.id) : navigate(pin.id));
      node.className = 'pin';
      node.hidden = true;
      if (pin.color) node.style.setProperty('--pin-color', pin.color);
      return { ...pin, node, labelWidth: 0 };
    });
    ui.pins.replaceChildren(...pins.map(pin => pin.node));
    featureButtons = Object.entries(detailSet()).map(([id, item]) => {
      const node = button(item.label, () => selectPart(id));
      if (item.color) node.style.setProperty('--pin-color', item.color);
      return [id, node];
    });
    ui.features.replaceChildren(...featureButtons.map(([, node]) => node));
  }

  function renderPins() {
    const placed = [];
    for (const pin of pins) {
      if (following || ((mode === 'river' || mode === 'building') && !pin.part)
          || (pin.minimum ?? 0) > cut || (pin.local && opened < 0.2 && pin.id !== 'roof')) {
        pin.node.hidden = true;
        continue;
      }
      anchor.copy(pin.point);
      if (pin.local) anchor.add(property.position);
      projected.copy(anchor).project(camera);
      const outside = Math.abs(projected.x) > 0.98 || Math.abs(projected.y) > 0.91 || Math.abs(projected.z) > 1;
      pin.node.hidden = outside;
      if (outside) continue;
      const labelWidth = pin.labelWidth || (pin.labelWidth = pin.node.offsetWidth);
      const x = clamp((projected.x + 1) * width / 2, labelWidth / 2 + 5, width - labelWidth / 2 - 5);
      let y = (1 - projected.y) * height / 2;
      for (const other of placed) {
        if (Math.abs(other.x - x) < (other.width + labelWidth) / 2 + 5 && Math.abs(other.y - y) < 33) {
          y = other.y - 33;
        }
      }
      y = clamp(y, 42, height - (width < 650 ? 52 : 61));
      placed.push({ x, y, width: labelWidth });
      pin.node.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,calc(-100% - 7px))';
    }
  }

  function refreshRange() {
    const type = mode === 'building' ? 'building' : 'cut';
    ui.depth.max = type === 'building' ? 100 : maximumDepth;
    const value = type === 'building' ? expansion : depth;
    ui.depth.value = value;
    ui.depth.style.setProperty('--fill', (value / Number(ui.depth.max)) * 100 + '%');
    ui['range-value'].value = value + (type === 'building' ? '%' : ' m');
    ui.depth.setAttribute('aria-valuetext', type === 'building' ? '展开 ' + value + '%' : (value ? '地下 ' + value + ' 米' : '地表'));
    ui['cut-cta'].textContent = mode === 'river' && depth > 0 ? '合上剖面' : '切开江底';
    updateStatus();
  }

  function setDepth(next) {
    depth = clamp(Math.round(next), 0, maximumDepth);
    if (following && depth < 16) setFollowing(false);
    refreshRange();
  }

  function setExpansion(next) {
    expansion = clamp(Math.round(next), 0, 100);
    refreshRange();
  }

  function refreshExperiment() {
    const config = experiments[mode];
    const enabled = Boolean(activeExperiments.get(mode));
    const isRain = mode === 'plain';
    experiment.set(mode, enabled);
    ui['experiment-panel'].hidden = !config;
    ui.garden.hidden = !isRain;
    ui.replay.hidden = !isRain;
    ui.replay.disabled = !enabled;
    ui['rain-progress'].hidden = !isRain;
    ui.experiment.setAttribute('aria-pressed', enabled);
    if (config) {
      ui.experiment.textContent = enabled ? config.stop : config.play;
      ui['experiment-note'].textContent = enabled ? config.note : '';
    }
  }

  function refreshMode() {
    const profile = destinations[mode];
    ui.app.dataset.mode = mode;
    ui.app.style.setProperty('--accent', profile.accent);
    ui['scene-title'].textContent = profile.title;
    ui['scene-intro'].textContent = profile.intro;
    const slider = mode === 'river' || mode === 'building';
    ui['slider-panel'].hidden = !slider;
    ui.controls.hidden = !slider && !experiments[mode];
    ui.follow.hidden = mode !== 'river';
    ui['range-label'].textContent = mode === 'building' ? '建筑展开度' : '剖面深度';
    const marks = mode === 'building' ? ['合拢', '25%', '50%', '75%', '完全展开'] : ['江面', '10 m', '20 m', '30 m'];
    ui.scale.replaceChildren(...marks.map(label => {
      const mark = document.createElement('span');
      mark.textContent = label;
      return mark;
    }));
    for (const node of nav) {
      if (mode === node.dataset.route) node.setAttribute('aria-current', 'page');
      else node.removeAttribute('aria-current');
    }
    setupPins();
    refreshExperiment();
    refreshRange();
    updateGuide();
  }

  function setMode(id, immediate = false) {
    if (id === mode && !immediate) return;
    mode = id;
    following = false;
    ui.follow.setAttribute('aria-pressed', 'false');
    ui.follow.textContent = '跟拍地铁';
    selected = undefined;
    depth = id === 'river' ? maximumDepth : 0;
    if (id === 'building') expansion = 58;
    flyTo(poseFor(id), immediate);
    refreshMode();
    updateStatus();
  }

  function navigate(id, automatic = false) {
    if (!automatic) stopTour();
    if (mode === id) return;
    if (automatic) history.replaceState(null, '', '#' + id);
    else history.pushState(null, '', '#' + id);
    setMode(id);
  }

  function routeFromHash() {
    const id = window.location.hash.slice(1);
    return Object.hasOwn(destinations, id) ? id : 'atlas';
  }

  function stopTour() {
    if (!tour) return;
    tour = undefined;
    ui.tour.textContent = '沿江巡游';
    ui.tour.setAttribute('aria-pressed', 'false');
    updateStatus();
  }

  function updateTour(dt) {
    if (!tour || flight || following) return;
    tour.wait += dt;
    if (tour.wait < (mode === 'river' ? 7 : 4.3)) return;
    if (++tour.index >= tourStops.length) {
      stopTour();
      return;
    }
    tour.wait = 0;
    navigate(tourStops[tour.index], true);
  }

  function setFollowing(active) {
    if (active) {
      stopTour();
      if (depth < 16) setDepth(20);
      selected = 'metro';
      infrastructure.getTrainPosition(train);
      const focus = new THREE.Vector3(train.x * 0.67 + 3, train.y + 5.2, clamp(train.z, -15, 48));
      flyTo({ focus, span: 70, yaw: 0.59, pitch: 0.42 });
    } else if (following) {
      flyTo(poseFor(mode));
    }
    following = active;
    ui.follow.textContent = active ? '退出跟拍' : '跟拍地铁';
    ui.follow.setAttribute('aria-pressed', active);
    updateGuide();
    updateStatus();
  }

  function resetView() {
    stopTour();
    if (following) setFollowing(false);
    flyTo(poseFor(mode));
    updateStatus();
  }

  function stopCameraFlight() {
    stopTour();
    if (following) {
      following = false;
      ui.follow.textContent = '跟拍地铁';
      ui.follow.setAttribute('aria-pressed', 'false');
    }
    if (flight) {
      flight = undefined;
      desired.focus.copy(current.focus);
      desired.span = current.span;
      desired.yaw = current.yaw;
      desired.pitch = current.pitch;
    }
    updateStatus();
  }

  const fingers = new Map();
  function orbit(dx, dy) {
    stopCameraFlight();
    desired.yaw = clamp(desired.yaw - dx * 0.0075, -1.08, 1.39);
    desired.pitch = clamp(desired.pitch + dy * 0.0049, 0.21, 0.95);
  }
  function zoom(factor) {
    stopCameraFlight();
    desired.span = clamp(desired.span * factor, 18, 425);
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    fingers.set(event.pointerId, [event.clientX, event.clientY]);
  });
  canvas.addEventListener('pointermove', event => {
    const prior = fingers.get(event.pointerId);
    if (!prior) return;
    const point = [event.clientX, event.clientY];
    if (fingers.size === 2) {
      const other = [...fingers].find(([id]) => id !== event.pointerId)[1];
      const old = Math.hypot(prior[0] - other[0], prior[1] - other[1]);
      const next = Math.hypot(point[0] - other[0], point[1] - other[1]);
      if (old > 4 && next > 4) zoom(old / next);
    } else if (fingers.size === 1) {
      orbit(point[0] - prior[0], point[1] - prior[1]);
    }
    fingers.set(event.pointerId, point);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => fingers.delete(event.pointerId));
  }
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    zoom(Math.exp(clamp(event.deltaY, -170, 170) * 0.0016));
  }, { passive: false });
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '三维城市。方向键旋转，加减键缩放，Home 键重置。');
  canvas.addEventListener('keydown', event => {
    const actions = {
      ArrowLeft: () => orbit(-12, 0), ArrowRight: () => orbit(12, 0),
      ArrowUp: () => orbit(0, 12), ArrowDown: () => orbit(0, -12),
      '+': () => zoom(0.86), '=': () => zoom(0.86), '-': () => zoom(1.15), Home: resetView,
    };
    if (!Object.hasOwn(actions, event.key)) return;
    event.preventDefault();
    actions[event.key]();
  });

  for (const node of nav) node.addEventListener('click', () => navigate(node.dataset.route));
  function onHistoryChange() { stopTour(); setMode(routeFromHash()); }
  window.addEventListener('popstate', onHistoryChange);
  window.addEventListener('hashchange', onHistoryChange);
  ui['cut-cta'].addEventListener('click', () => {
    stopTour();
    if (mode === 'river') setDepth(depth ? 0 : maximumDepth);
    else navigate('river');
  });
  ui.tour.addEventListener('click', () => {
    if (tour) return stopTour();
    tour = { index: 0, wait: 0 };
    ui.tour.textContent = '结束巡游';
    ui.tour.setAttribute('aria-pressed', 'true');
    navigate(tourStops[0], true);
    updateStatus();
  });
  ui.night.addEventListener('click', () => {
    night = !night;
    ui.app.dataset.night = String(night);
    ui.night.textContent = night ? '日景' : '夜景';
    ui.night.setAttribute('aria-pressed', night);
    city.setNight?.(night);
    terrain.setNight?.(night);
  });
  ui['reset-view'].addEventListener('click', resetView);
  ui.fullscreen.hidden = !ui.app.requestFullscreen;
  ui.fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await ui.app.requestFullscreen();
    } catch {
      ui.fullscreen.hidden = true;
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const label = document.fullscreenElement ? '退出全屏' : '全屏';
    ui.fullscreen.setAttribute('aria-label', label);
    ui.fullscreen.title = label;
  });
  ui.depth.addEventListener('input', () => {
    stopTour();
    if (mode === 'building') setExpansion(Number(ui.depth.value));
    else setDepth(Number(ui.depth.value));
  });
  ui.follow.addEventListener('click', () => setFollowing(!following));
  ui.experiment.addEventListener('click', () => {
    stopTour();
    activeExperiments.set(mode, !activeExperiments.get(mode));
    refreshExperiment();
  });
  ui.garden.addEventListener('click', () => {
    garden = !garden;
    experiment.setGarden(garden);
    ui.garden.setAttribute('aria-pressed', garden);
  });
  ui.replay.addEventListener('click', () => experiment.restart());

  function resize() {
    width = Math.max(1, ui.viewport.clientWidth);
    height = Math.max(1, ui.viewport.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    for (const pin of pins) pin.labelWidth = 0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 650 ? 1.25 : 1.55));
    renderer.setSize(width, height, false);
  }

  function frame(now) {
    if (!rendering) return;
    renderFrame = requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / 1000, 0.065) : 1 / 60;
    last = now;
    if (!showing) return;
    if (!reduceMotion.matches || following || activeExperiments.get(mode)) time += dt;
    const expandTo = mode === 'building' ? expansion / 100 : 0;
    const depthTo = mode === 'river' && (!flight || flight.time > flight.duration * 0.35) ? depth : 0;
    const easedCut = damp(cut, depthTo, 3.25, dt);
    const easedOpen = damp(opened, expandTo, 4, dt);
    const newCut = reduceMotion.matches || Math.abs(easedCut - depthTo) < 0.035 ? depthTo : easedCut;
    const newOpen = reduceMotion.matches || Math.abs(easedOpen - expandTo) < 0.002 ? expandTo : easedOpen;
    if (newCut !== cut) terrain.setDepth(newCut);
    if (mode === 'building' || newOpen !== opened) {
      property.position.y = propertyGround + newOpen * 4.3;
      building.update(dt, time, newOpen, mode === 'building' && newOpen > 0.1 ? selected : null);
    }
    cut = newCut;
    opened = newOpen;
    nightLevel = reduceMotion.matches ? Number(night) : damp(nightLevel, Number(night), 3, dt);
    ambient.color.copy(daySky).lerp(nightSky, nightLevel);
    ambient.intensity = lerp(2.1, 0.95, nightLevel);
    sun.intensity = lerp(2.65, 0.20, nightLevel);
    fill.intensity = lerp(1.35, 0.83, nightLevel);
    scene.fog.color.copy(dayFog).lerp(nightFog, nightLevel);
    city.update(dt, time);
    terrain.update(dt, time);
    infrastructure.update(dt, time, cut);
    experiment.update(dt, time);
    if (mode === 'plain') ui['rain-progress'].value = experiment.progress();
    updateCamera(dt);
    renderPins();
    renderer.render(scene, camera);
    ui.loading.hidden = true;
    updateTour(dt);
  }

  new ResizeObserver(resize).observe(ui.viewport);
  new IntersectionObserver(([entry]) => { showing = entry.isIntersecting; }).observe(ui.viewport);
  document.addEventListener('visibilitychange', () => { last = 0; });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    rendering = false;
    cancelAnimationFrame(renderFrame);
    ui.loading.hidden = false;
    ui.loading.textContent = '3D 画面已暂停，刷新页面可以重新打开。';
  });
  resize();
  setMode(routeFromHash(), true);
  renderFrame = requestAnimationFrame(frame);
}

try {
  start();
} catch (error) {
  console.error(error);
  ui.loading.textContent = '未能打开 3D 城市。请尝试启用浏览器硬件加速，再刷新页面。';
}
