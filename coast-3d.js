import * as THREE from './vendor/three.module.js';
import { createBuilding } from './building.js';
import { createCoastTerrain, groundY, riverZ } from './coast-terrain.js';
import { createCoastCity } from './coast-city.js';
import { createCoastInfrastructure } from './coast-infrastructure.js';
import { createCoastExperiments } from './coast-effects.js';
import { createCoastExpansion } from './coast-expansion.js';
import { createCoastDiscover } from './coast-discover.js';
import { destinations, underground, buildingParts } from './coast-guide.js?v=20261120.5';

const { clamp, damp, lerp, degToRad } = THREE.MathUtils;

function viewError(code, cause) {
  return Object.assign(new Error(code, { cause }), { code });
}

function connectRenderer() {
  const profiles = [
    { antialias: true, powerPreference: 'default' },
    { antialias: false, powerPreference: 'low-power' },
    { antialias: false, powerPreference: 'default' },
  ];
  let contextAvailable = false;
  let lastError;
  for (const settings of profiles) {
    const canvas = document.createElement('canvas');
    const attributes = { ...settings, alpha: true, depth: true, failIfMajorPerformanceCaveat: false };
    let context;
    try {
      context = canvas.getContext('webgl2', attributes);
      if (!context) continue;
      contextAvailable = true;
      const renderer = new THREE.WebGLRenderer({ canvas, context, ...attributes });
      return { renderer, canvas };
    } catch (error) {
      lastError = error;
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }
  throw viewError(contextAvailable ? 'renderer-init' : 'no-webgl2', lastError);
}

export function createCoast3D(container, options) {
  const { onNavigate, onFeature, onInteract, onError, onStatus } = options;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const { renderer, canvas } = connectRenderer();
  renderer.setClearColor(0, 0);
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.19;
  let shaderError = false;
  renderer.debug.onShaderError = () => { shaderError = true; };

  const scene = new THREE.Scene();
  const dayFog = new THREE.Color(0x648193);
  const nightFog = new THREE.Color(0x233552);
  scene.fog = new THREE.FogExp2(dayFog, 0.00078);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 3700);
  const daySky = new THREE.Color(0xe5f2ff);
  const nightSky = new THREE.Color(0x788bbd);
  const ambient = new THREE.HemisphereLight(daySky, 0x8b8277, 2);
  const sun = new THREE.DirectionalLight(0xffe5bf, 2.8);
  sun.position.set(-95, 160, 74);
  const fill = new THREE.DirectionalLight(0x9bcafa, 1.31);
  fill.position.set(98, 53, -94);
  scene.add(ambient, sun, fill);

  let terrain, city, infrastructure, experiment, expansionWorld, discover, building;
  const property = new THREE.Group();
  const propertyGround = groundY(-34, -27);
  property.position.set(-34, propertyGround, -27);
  scene.add(property);
  try {
    terrain = createCoastTerrain(scene);
    city = createCoastCity(scene);
    infrastructure = createCoastInfrastructure(scene);
    experiment = createCoastExperiments(scene);
    expansionWorld = createCoastExpansion(scene);
    discover = createCoastDiscover(scene);
    building = createBuilding(property);
    building.update(0, 0, 0, null);
  } catch (error) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw viewError('scene-init', error);
  }
  for (const material of city.cutMaterials || []) {
    material.clippingPlanes = terrain.cutPlanes;
    material.clipIntersection = true;
  }

  const labels = document.createElement('div');
  labels.className = 'pins';
  labels.setAttribute('aria-label', '三维地图定位点');
  container.append(canvas, labels);
  const placePoints = [
    ['hill', new THREE.Vector3(-93, groundY(-93, -37) + 6.5, -37)],
    ['rural', new THREE.Vector3(-83, groundY(-83, 43) + 4.1, 43)],
    ['lake', city.landmarks.lake.clone().add(new THREE.Vector3(0, 3.9, 0))],
    ['plain', city.landmarks.northSkyline.clone().add(new THREE.Vector3(0, 9, 0))],
    ['river', new THREE.Vector3(8, 4.4, riverZ(8) + 6)],
    ['harbor', city.landmarks.harbor.clone().add(new THREE.Vector3(0, 5, 0))],
    ['skyline', new THREE.Vector3(0, 47, -114)],
    ['offshore', new THREE.Vector3(165, 7, 24)],
    ['building', new THREE.Vector3(-34, propertyGround + 14, -27)],
  ];
  const casesAt = {
    pump: [15.5, -17.5, 8.8, 43, -0.35, 0.74],
    air: [20, -17, 8, 60, -0.33, 0.70],
    load: [-34, propertyGround + 9, -27, 39, 0.41, 0.35],
  };
  const current = { focus: new THREE.Vector3(), span: 485, yaw: 0.34, pitch: 0.54 };
  const desired = { ...current, focus: new THREE.Vector3() };
  const groundOffset = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const anchor = new THREE.Vector3();
  const train = new THREE.Vector3();
  let mode = 'atlas';
  let depth = 0;
  let cut = 0;
  let expansion = 0;
  let opened = 0;
  let night = false;
  let nightLevel = 0;
  let selected;
  let activeCase;
  let following = false;
  let pins = [];
  let flight;
  let elapsed = 0;
  let previousTime = 0;
  let width = 1;
  let height = 1;
  let showing = true;
  let stopped = false;
  let frameId;
  let frameProgress = 0;
  let lowQuality = false;
  let slowFrames = 0;
  let aerial = false;
  let surfaceExperiment = false;
  let viewStatus = '';

  function pose(id) {
    const profile = destinations[id];
    const focus = new THREE.Vector3(...profile.focus);
    if (id === 'atlas') {
      focus.set(0, 9, -14);
      return { focus, span: 500, yaw: 0.34, pitch: 0.60 };
    }
    if (id === 'building') focus.y += propertyGround + 1.2;
    return { focus, span: profile.span, yaw: profile.yaw, pitch: profile.pitch };
  }

  function notify(status) {
    if (viewStatus === status) return;
    viewStatus = status;
    onStatus(status);
  }

  function fly(target, immediate = false) {
    desired.focus.copy(target.focus);
    desired.span = target.span;
    desired.yaw = target.yaw;
    desired.pitch = target.pitch;
    if (immediate || reduced.matches) {
      flight = undefined;
      current.focus.copy(desired.focus);
      current.span = desired.span;
      current.yaw = desired.yaw;
      current.pitch = desired.pitch;
      notify('');
      return;
    }
    const distance = current.focus.distanceTo(target.focus);
    flight = {
      start: { ...current, focus: current.focus.clone() },
      spanLift: clamp(distance * 0.23 + Math.abs(current.span - desired.span) * 0.05, 1.5, 64),
      heightLift: clamp(distance * 0.075, 1.2, 31),
      duration: clamp(0.88 + distance * 0.0068 + Math.abs(current.span - desired.span) * 0.0024, 0.87, 2.85),
      time: 0,
    };
    notify('正在飞往' + destinations[mode].label);
  }

  function track() {
    infrastructure.getTrainPosition(train);
    desired.focus.set(train.x * 0.67 + 3, train.y + 5.2, clamp(train.z, -15, 48));
  }

  function updateCamera(dt) {
    if (following) track();
    if (flight) {
      flight.time = Math.min(flight.duration, flight.time + dt);
      const progress = flight.time / flight.duration;
      const phase = progress * progress * (3 - 2 * progress);
      const arc = Math.sin(Math.PI * phase);
      current.focus.lerpVectors(flight.start.focus, desired.focus, phase);
      current.focus.y += arc * flight.heightLift;
      current.span = lerp(flight.start.span, desired.span, phase) + arc * flight.spanLift;
      current.yaw = lerp(flight.start.yaw, desired.yaw, phase);
      current.pitch = lerp(flight.start.pitch, desired.pitch, phase);
      if (progress >= 1) {
        flight = undefined;
        notify(following ? '正在跟拍过江地铁' : '');
      }
    } else {
      const phase = reduced.matches ? 1 : 1 - Math.exp(-dt * 7);
      current.focus.lerp(desired.focus, phase);
      current.span = lerp(current.span, desired.span, phase);
      current.yaw = lerp(current.yaw, desired.yaw, phase);
      current.pitch = lerp(current.pitch, desired.pitch, phase);
    }
    const extent = Math.max(current.span / camera.aspect, current.span * 0.51);
    const distance = extent / (2 * Math.tan(degToRad(camera.fov / 2)));
    const horizon = Math.cos(current.pitch) * distance;
    groundOffset.set(Math.sin(current.yaw) * horizon, Math.sin(current.pitch) * distance, Math.cos(current.yaw) * horizon);
    camera.position.copy(current.focus).add(groundOffset);
    camera.position.y = Math.max(camera.position.y, groundY(camera.position.x, camera.position.z) + 3.5);
    camera.lookAt(current.focus);
    camera.updateMatrixWorld();
  }

  function preparePins() {
    const next = placePoints
      .filter(([id]) => id !== mode && (id !== 'building' || mode === 'plain' || mode === 'lake'))
      .map(([id, point]) => ({ id, point, label: destinations[id].label, color: destinations[id].accent }));
    if (mode === 'river') {
      for (const [id, point] of Object.entries(infrastructure.features)) {
        const item = underground[id];
        if (item) next.push({ id, point, label: item.label, color: item.color, part: true, minimum: item.depth - 2 });
      }
    }
    if (mode === 'building') {
      for (const { id, position } of building.hotspots) {
        next.push({ id, point: position, label: buildingParts[id].label, part: true, local: true });
      }
    }
    pins = next.map(pin => {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'pin';
      node.textContent = pin.label;
      node.hidden = true;
      if (pin.color) node.style.setProperty('--pin-color', pin.color);
      node.addEventListener('click', () => pin.part ? onFeature(pin.id) : onNavigate(pin.id));
      return { ...pin, node, labelWidth: 0 };
    });
    labels.replaceChildren(...pins.map(pin => pin.node));
  }

  function renderPins() {
    const placed = [];
    for (const pin of pins) {
      if (following || activeCase || ((mode === 'river' || mode === 'building') && !pin.part)
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
        if (Math.abs(other.x - x) < (other.width + labelWidth) / 2 + 5 && Math.abs(other.y - y) < 34) y = other.y - 34;
      }
      y = clamp(y, 43, height - (width < 650 ? 51 : 62));
      placed.push({ x, y, width: labelWidth });
      pin.node.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,calc(-100% - 7px))';
    }
  }

  function renderFailure(error) {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frameId);
    onError(error);
  }

  function resize() {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    for (const pin of pins) pin.labelWidth = 0;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowQuality ? 0.93 : (width < 650 ? 1.25 : 1.45)));
    renderer.setSize(width, height, false);
  }

  function frame(now) {
    if (stopped) return;
    frameId = requestAnimationFrame(frame);
    const raw = previousTime ? (now - previousTime) / 1000 : 1 / 60;
    previousTime = now;
    if (!showing) return;
    const dt = Math.min(raw, 0.070);
    if (!lowQuality && raw > 0.038) {
      if (++slowFrames >= 22) {
        lowQuality = true;
        resize();
      }
    } else if (slowFrames) slowFrames--;
    try {
      if (!reduced.matches || following || activeCase || surfaceExperiment) elapsed += dt;
      const cutTarget = mode === 'river' && (!flight || flight.time > flight.duration * 0.26) ? depth : 0;
      const openTarget = mode === 'building' ? expansion / 100 : 0;
      const nextCut = reduced.matches ? cutTarget : damp(cut, cutTarget, 3.8, dt);
      const nextOpen = reduced.matches ? openTarget : damp(opened, openTarget, 4.5, dt);
      if (Math.abs(nextCut - cut) > 0.0003) terrain.setDepth(nextCut);
      if (mode === 'building' || Math.abs(nextOpen - opened) > 0.0003) {
        property.position.y = propertyGround + nextOpen * 4.3;
        building.update(dt, elapsed, nextOpen, mode === 'building' && nextOpen > 0.1 ? selected : null);
      }
      cut = nextCut;
      opened = nextOpen;
      nightLevel = reduced.matches ? Number(night) : damp(nightLevel, Number(night), 3, dt);
      ambient.color.copy(daySky).lerp(nightSky, nightLevel);
      ambient.intensity = lerp(2, 0.92, nightLevel);
      sun.intensity = lerp(2.8, 0.23, nightLevel);
      fill.intensity = lerp(1.31, 0.88, nightLevel);
      scene.fog.color.copy(dayFog).lerp(nightFog, nightLevel);
      terrain.update(dt, elapsed);
      city.update(dt, elapsed);
      expansionWorld.update(dt, elapsed);
      infrastructure.update(dt, elapsed, cut);
      experiment.update(dt, elapsed);
      discover.setBuilding(opened);
      discover.update(dt, elapsed);
      frameProgress = experiment.progress();
      updateCamera(dt);
      renderPins();
      renderer.render(scene, camera);
      if (shaderError) renderFailure(viewError('shader-init'));
    } catch (error) {
      renderFailure(viewError('render-failed', error));
    }
  }

  function stopFlight() {
    onInteract();
    following = false;
    if (flight) {
      flight = undefined;
      desired.focus.copy(current.focus);
      desired.span = current.span;
      desired.yaw = current.yaw;
      desired.pitch = current.pitch;
    }
    notify('');
  }

  function orbit(dx, dy) {
    stopFlight();
    desired.yaw = clamp(desired.yaw - dx * 0.0074, -1.10, 1.52);
    desired.pitch = clamp(desired.pitch + dy * 0.0048, 0.17, 1.08);
  }

  function zoom(factor) {
    stopFlight();
    desired.span = clamp(desired.span * factor, 20, 790);
  }

  function resetView() {
    following = false;
    aerial = false;
    fly(pose(mode));
  }

  const pointers = new Map();
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '三维城市。方向键旋转，加减键缩放，Home 键重置。');
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
  });
  canvas.addEventListener('pointermove', event => {
    const prior = pointers.get(event.pointerId);
    if (!prior) return;
    const point = [event.clientX, event.clientY];
    if (pointers.size === 2) {
      const other = [...pointers].find(([id]) => id !== event.pointerId)[1];
      const before = Math.hypot(prior[0] - other[0], prior[1] - other[1]);
      const after = Math.hypot(point[0] - other[0], point[1] - other[1]);
      if (before > 4 && after > 4) zoom(before / after);
    } else if (pointers.size === 1) {
      orbit(point[0] - prior[0], point[1] - prior[1]);
    }
    pointers.set(event.pointerId, point);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => pointers.delete(event.pointerId));
  }
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    zoom(Math.exp(clamp(event.deltaY, -170, 170) * 0.0016));
  }, { passive: false });
  canvas.addEventListener('keydown', event => {
    const actions = {
      ArrowLeft: () => orbit(-12, 0), ArrowRight: () => orbit(12, 0),
      ArrowUp: () => orbit(0, 12), ArrowDown: () => orbit(0, -12),
      '+': () => zoom(0.85), '=': () => zoom(0.85), '-': () => zoom(1.16), Home: resetView,
    };
    if (!Object.hasOwn(actions, event.key)) return;
    event.preventDefault();
    actions[event.key]();
  });
  const resizeObserver = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(([entry]) => { showing = entry.isIntersecting; });
  resizeObserver.observe(container);
  intersection.observe(container);
  function contextLost(event) {
    event.preventDefault();
    renderFailure(viewError('context-lost'));
  }
  canvas.addEventListener('webglcontextlost', contextLost);
  resize();

  return {
    setMode(id, immediate = false) {
      mode = id;
      selected = undefined;
      activeCase = undefined;
      following = false;
      discover.setCase(null, 0);
      aerial = false;
      fly(pose(id), immediate);
      preparePins();
    },
    setDepth(value) { depth = value; },
    setExpansion(value) { expansion = value; },
    setNight(value) {
      night = value;
      terrain.setNight(value);
      city.setNight(value);
      expansionWorld.setNight(value);
    },
    setExperiment(id, active) {
      surfaceExperiment = active;
      experiment.set(id, active);
    },
    setGarden(active) { experiment.setGarden(active); },
    replay() { experiment.restart(); },
    progress() { return frameProgress; },
    setDiscover(id, level, changeView = true) {
      const prior = activeCase;
      activeCase = id;
      discover.setCase(id, level);
      if (changeView && id && prior !== id) {
        const [x, y, z, span, yaw, pitch] = casesAt[id];
        fly({ focus: new THREE.Vector3(x, y, z), span, yaw, pitch });
      } else if (changeView && prior && !id) resetView();
    },
    setFollowing(active) {
      if (active) {
        following = true;
        infrastructure.getTrainPosition(train);
        fly({ focus: new THREE.Vector3(train.x * 0.67 + 3, train.y + 5.2, clamp(train.z, -15, 48)), span: 69, yaw: 0.59, pitch: 0.42 });
      } else if (following) {
        following = false;
        resetView();
      }
    },
    selectPart(id, focus = true) {
      selected = id;
      for (const pin of pins) {
        if (pin.part) pin.node.setAttribute('aria-pressed', pin.id === id);
      }
      if (!focus || !id) return;
      if (mode === 'river') {
        const point = infrastructure.features[id];
        if (point) fly({ focus: new THREE.Vector3(point.x * 0.6, point.y + 5, point.z), span: 74, yaw: 0.83, pitch: 0.56 });
      }
    },
    toggleAngle() {
      aerial = !aerial;
      const target = pose(mode);
      target.pitch = aerial ? 0.88 : target.pitch;
      target.yaw = aerial ? 0.13 : target.yaw;
      target.span *= aerial ? 1.05 : 1;
      fly(target);
      return aerial;
    },
    zoom,
    resetView,
    resize,
    start() {
      if (!frameId && !stopped) frameId = requestAnimationFrame(frame);
    },
    destroy() {
      stopped = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersection.disconnect();
      canvas.removeEventListener('webglcontextlost', contextLost);
      const geometries = new Set();
      const materials = new Set();
      scene.traverse(item => {
        if (item.geometry) geometries.add(item.geometry);
        if (item.material) {
          for (const material of [item.material].flat()) materials.add(material);
        }
      });
      for (const material of materials) {
        if (material.map?.isTexture) material.map.dispose();
        material.dispose();
      }
      for (const geometry of geometries) geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      labels.remove();
    },
  };
}
