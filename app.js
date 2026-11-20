import * as THREE from './vendor/three.module.js';
import { createCity } from './scene.js';
import { createMotion } from './motion.js';
import { createAtlas } from './atlas.js';
import { createDistrict } from './districts.js';
import { createBuilding } from './building.js';
import { guide } from './guide.js';

const elements = Object.fromEntries([
  'app', 'viewport', 'loading', 'places', 'pins', 'controls', 'depth', 'depth-label', 'depth-value', 'scale',
  'scene-title', 'scene-intro', 'scene-state', 'follow', 'reset-view', 'rain-control', 'rain',
  'garden', 'replay', 'rain-progress', 'rain-status', 'guide-heading', 'guide-label',
  'guide-copy', 'features', 'story', 'reference', 'building-cta',
].map(id => [id, document.getElementById(id)]));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const { clamp, damp } = THREE.MathUtils;

function start() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0, 0);
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.24;
  const canvas = renderer.domElement;
  elements.viewport.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 245);
  scene.add(new THREE.HemisphereLight(0xdbedff, 0xa27e66, 2.05));
  const light = new THREE.DirectionalLight(0xffe1bd, 2.55);
  light.position.set(-20, 38, 28);
  scene.add(light);
  const rim = new THREE.DirectionalLight(0x99c5ff, 1.48);
  rim.position.set(23, 18, -29);
  scene.add(rim);

  const worlds = new Map();
  const states = new Map(Object.entries(guide).map(([id, profile]) => [
    id,
    {
      value: id === 'building' ? 0 : 14,
      visibleValue: id === 'building' ? 0 : 14,
      selected: Object.keys(profile.features || {})[0],
      story: false,
    },
  ]));
  const routeButtons = [...elements.places.querySelectorAll('[data-route]')];
  const look = new THREE.Vector3();
  const nextLook = new THREE.Vector3();
  const cameraOffset = new THREE.Vector3();
  const train = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const view = { yaw: 0.37, pitch: 0.60, zoom: 1, actualYaw: 0.37, actualPitch: 0.60, actualZoom: 1 };
  let mode = 'atlas';
  let activeWorld;
  let activePins = [];
  let featureButtons = new Map();
  let focusedFeature;
  let width = 1;
  let height = 1;
  let aspect = 1;
  let following = false;
  let raining = false;
  let garden = false;
  let elapsed = 0;
  let last = 0;
  let renderFrame = 0;
  let showing = true;
  let rendered = false;

  function ensureWorld(id) {
    if (worlds.has(id)) return worlds.get(id);
    const layer = new THREE.Group();
    layer.visible = false;
    let model;
    let motion;
    if (id === 'atlas') {
      model = createAtlas(layer);
    } else if (id === 'plain') {
      const city = createCity(layer);
      motion = createMotion(layer);
      model = {
        setDepth: city.setDepth,
        hotspots: [
          { id: 'street', position: new THREE.Vector3(-7.1, 0.85, 3.5) },
          { id: 'pipes', position: new THREE.Vector3(7.5, -1.18, 8.3), minimumDepth: 6 },
          { id: 'metro', position: new THREE.Vector3(-7.7, -4.5, 8.5), minimumDepth: 12 },
          { id: 'building', position: new THREE.Vector3(0.8, 6.2, -0.3) },
        ],
      };
    } else if (id === 'building') {
      model = createBuilding(layer);
    } else {
      model = createDistrict(layer, id);
    }
    const result = { layer, model, motion };
    worlds.set(id, result);
    scene.add(layer);
    return result;
  }

  function placeButton(label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', action);
    return button;
  }

  function updateGuide() {
    const profile = guide[mode];
    const state = states.get(mode);
    if (mode === 'atlas') {
      elements['guide-label'].textContent = '看懂一座城';
      elements['guide-heading'].textContent = '出门以后，路是怎么接起来的？';
      elements['guide-copy'].textContent = '从山坡出发，沿着河流经过桥梁、街区和村道，看看同一片区域里，地形如何改变人走的路、水流的方向和房子的位置。';
    } else {
      const feature = profile.features[state.selected];
      elements['guide-label'].textContent = feature.name;
      elements['guide-heading'].textContent = feature.question;
      elements['guide-copy'].textContent = feature.answer;
    }
    for (const [id, button] of featureButtons) button.setAttribute('aria-pressed', id === state.selected);
    for (const { hotspot, button } of activePins) {
      if (profile.features?.[hotspot.id]) button.setAttribute('aria-pressed', hotspot.id === state.selected);
    }
    elements.story.hidden = !profile.story;
    if (profile.story) {
      elements.story.textContent = state.story ? profile.story.off : profile.story.on;
      elements.story.setAttribute('aria-pressed', state.story);
    }
    const reference = elements.reference;
    reference.hidden = !profile.source;
    if (profile.source) {
      [reference.textContent, reference.href] = profile.source;
    }
  }

  function updateRange(value) {
    const state = states.get(mode);
    const isBuilding = mode === 'building';
    const cap = isBuilding ? 100 : 24;
    state.value = clamp(Math.round(value), 0, cap);
    elements.depth.value = state.value;
    elements.depth.style.setProperty('--fill', (state.value / cap) * 100 + '%');
    elements['depth-value'].value = state.value + (isBuilding ? '%' : ' m');
    const label = isBuilding ? '拆解 ' + state.value + '%' : state.value ? '地下 ' + state.value + ' 米' : '地表';
    elements.depth.setAttribute('aria-valuetext', label);
    if (mode === 'plain' && state.value < 12 && following) setFollowing(false);
    updateStateBadge();
  }

  function updateStateBadge() {
    const state = states.get(mode);
    const badge = elements['scene-state'];
    const profile = guide[mode];
    let text = '';
    if (profile.story && state.story) text = profile.story.status;
    else if (mode === 'building') text = state.value === 0 ? '建筑外观' : state.value < 60 ? '楼层正在展开' : '建筑剖面';
    else if (mode !== 'atlas') text = state.value ? '地下 ' + state.value + ' m' : '地表';
    badge.hidden = !text;
    if (badge.textContent !== text) badge.textContent = text;
  }

  function selectFeature(id, focus = true) {
    const profile = guide[mode];
    const state = states.get(mode);
    if (!profile.features?.[id]) return;
    state.selected = id;
    if (focus) {
      setFollowing(false);
      focusedFeature = id;
      view.zoom = mode === 'building' ? 1.16 : 1.27;
      if (mode === 'building' && state.value < 66) updateRange(76);
      if (profile.features[id].depth > state.value) updateRange(profile.features[id].depth);
    }
    updateGuide();
  }

  function renderFeatureControls() {
    const profile = guide[mode];
    featureButtons = new Map(Object.entries(profile.features || {}).map(([id, detail]) => [
      id, placeButton(detail.name, () => selectFeature(id)),
    ]));
    elements.features.replaceChildren(...featureButtons.values());
    activePins = activeWorld.model.hotspots.map(hotspot => {
      const jumpsToScene = mode === 'atlas' || hotspot.id === 'building';
      const label = jumpsToScene ? guide[hotspot.id].name : profile.features[hotspot.id].name;
      const button = placeButton(label, () => {
        if (jumpsToScene) navigate(hotspot.id);
        else selectFeature(hotspot.id);
      });
      button.className = 'pin';
      button.hidden = true;
      if (jumpsToScene) button.style.setProperty('--accent', guide[hotspot.id].accent);
      return { hotspot, button };
    });
    elements.pins.replaceChildren(...activePins.map(({ button }) => button));
  }

  function navigate(id) {
    if (mode === id && activeWorld) return;
    window.location.hash = id;
  }

  function readRoute() {
    const requested = window.location.hash.slice(1);
    return Object.hasOwn(guide, requested) ? requested : 'atlas';
  }

  function setMode(id) {
    if (activeWorld && id === mode) return;
    const world = ensureWorld(id);
    if (activeWorld) activeWorld.layer.visible = false;
    activeWorld = world;
    world.layer.visible = true;
    mode = id;
    elements.app.dataset.mode = id;
    const profile = guide[id];
    const state = states.get(id);
    elements.app.style.setProperty('--accent', profile.accent);
    elements['scene-title'].textContent = profile.title;
    elements['scene-intro'].textContent = profile.intro;
    elements.follow.hidden = id !== 'plain';
    elements.controls.hidden = id === 'atlas';
    elements['rain-control'].hidden = id !== 'plain';
    elements['building-cta'].hidden = id !== 'atlas' && id !== 'plain';
    elements['depth-label'].textContent = id === 'building' ? '建筑展开度' : '剖面深度';
    elements.depth.max = id === 'building' ? 100 : 24;
    const scale = id === 'building' ? ['合拢', '25%', '50%', '75%', '完全展开'] : ['地表', '6 m', '12 m', '18 m', '24 m'];
    elements.scale.replaceChildren(...scale.map(label => {
      const mark = document.createElement('span');
      mark.textContent = label;
      return mark;
    }));
    for (const button of routeButtons) {
      if (id === button.dataset.route) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    updateRange(state.value);
    resetView();
    renderFeatureControls();
    updateGuide();
    if (profile.story) activeWorld.model.setStory(state.story);
    if (rendered && !reducedMotion.matches) {
      elements.viewport.getAnimations().forEach(animation => animation.cancel());
      elements.viewport.animate([{ opacity: 0.28 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' });
    }
  }

  function setFollowing(active) {
    following = active;
    elements.follow.setAttribute('aria-pressed', active);
    elements.follow.textContent = active ? '退出跟拍' : '跟拍地铁';
    if (active && mode === 'plain') {
      if (states.get('plain').value < 14) updateRange(14);
      focusedFeature = undefined;
      selectFeature('metro', false);
    }
  }

  function resetView() {
    setFollowing(false);
    focusedFeature = undefined;
    const { yaw, pitch } = guide[mode];
    view.yaw = view.actualYaw = yaw;
    view.pitch = view.actualPitch = pitch;
    view.zoom = view.actualZoom = 1;
    look.set(0, guide[mode].y, 0);
  }

  function setRain(active) {
    raining = active;
    activeWorld.motion.setRain(active);
    elements.rain.setAttribute('aria-pressed', active);
    elements.rain.textContent = active ? '停止下雨' : '开始下雨';
    elements.replay.disabled = !active;
    if (active && states.get('plain').value < 8) updateRange(8);
  }

  function updateRainFeedback() {
    const progress = raining ? activeWorld.motion.getPhase() : 0;
    elements['rain-progress'].value = progress;
    let status = '观察雨水如何进入排水管';
    if (raining && progress >= 0.8) status = garden ? '花园截留部分径流' : '径流汇入排水管';
    else if (raining && progress >= 0.4) status = garden ? '雨水流向花园' : '雨水流向雨水口';
    else if (raining) status = '雨水沿屋顶和路面流动';
    else if (garden) status = '雨水花园已启用';
    if (status !== elements['rain-status'].textContent) elements['rain-status'].textContent = status;
  }

  function resize() {
    width = Math.max(1, elements.viewport.clientWidth);
    height = Math.max(1, elements.viewport.clientHeight);
    aspect = width / height;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 650 ? 1.4 : 1.65));
    renderer.setSize(width, height, false);
  }

  function updateCamera(dt) {
    const profile = guide[mode];
    const state = states.get(mode);
    const easing = reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 6);
    let { yaw, pitch, zoom } = view;
    const mobile = width < 650;
    let baseY = profile.y;
    if (mode === 'building') baseY = (activeWorld.model.focus?.y ?? baseY) + state.visibleValue * 0.016;
    if (mode === 'atlas') baseY += mobile ? 4.2 : 2.5;
    if (mobile && mode !== 'atlas') baseY += 2.25;
    nextLook.set(0, baseY, 0);
    if (focusedFeature) {
      const spot = activeWorld.model.hotspots.find(hotspot => hotspot.id === focusedFeature);
      if (spot) {
        nextLook.x = spot.position.x * 0.60;
        nextLook.y = THREE.MathUtils.lerp(baseY, spot.position.y, 0.42);
        nextLook.z = spot.position.z * 0.36;
      }
    }
    if (following && mode === 'plain') {
      activeWorld.motion.getTrainPosition(train);
      nextLook.set(train.x * 0.70, train.y + 1.35, 2);
      yaw = 0.38;
      pitch = 0.17;
      zoom = 1.70;
    }
    look.lerp(nextLook, easing);
    view.actualYaw = THREE.MathUtils.lerp(view.actualYaw, yaw, easing);
    view.actualPitch = THREE.MathUtils.lerp(view.actualPitch, pitch, easing);
    view.actualZoom = THREE.MathUtils.lerp(view.actualZoom, zoom, easing);
    const radius = 92;
    const horizontal = Math.cos(view.actualPitch) * radius;
    cameraOffset.set(Math.sin(view.actualYaw) * horizontal, Math.sin(view.actualPitch) * radius, Math.cos(view.actualYaw) * horizontal);
    camera.position.copy(look).add(cameraOffset);
    const halfHeight = Math.max(profile.height, profile.width / aspect) / (view.actualZoom * 2);
    const halfWidth = halfHeight * aspect;
    const shift = !mobile && mode !== 'building' ? halfWidth * 0.055 : 0;
    camera.left = -halfWidth - shift;
    camera.right = halfWidth - shift;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.lookAt(look);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function updatePins() {
    const { visibleValue } = states.get(mode);
    const occupied = [];
    for (const { hotspot, button } of activePins) {
      if (following || (hotspot.minimumDepth ?? 0) > visibleValue) {
        button.hidden = true;
        continue;
      }
      projected.copy(hotspot.position).project(camera);
      const offscreen = Math.abs(projected.x) > 0.94 || Math.abs(projected.y) > 0.94 || Math.abs(projected.z) > 1;
      button.hidden = offscreen;
      if (offscreen) continue;
      const x = (projected.x + 1) * width / 2;
      let y = (1 - projected.y) * height / 2;
      const labelWidth = button.offsetWidth;
      const left = clamp(x, labelWidth / 2 + 5, width - labelWidth / 2 - 5);
      for (const pin of occupied) {
        if (Math.abs(pin.x - left) < (pin.width + labelWidth) / 2 + 5 && Math.abs(pin.y - y) < 33) y = pin.y - 33;
      }
      occupied.push({ x: left, y, width: labelWidth });
      button.style.transform = 'translate3d(' + left + 'px,' + Math.max(41, y) + 'px,0) translate(-50%, calc(-100% - 6px))';
    }
  }

  const pointers = new Map();
  function orbit(dx, dy) {
    if (following) setFollowing(false);
    view.yaw = clamp(view.yaw - dx * 0.009, -1.04, 1.20);
    view.pitch = clamp(view.pitch + dy * 0.006, 0.10, 0.88);
  }
  function zoomBy(multiplier) {
    if (following) setFollowing(false);
    view.zoom = clamp(view.zoom * multiplier, 0.68, 2.5);
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
  });
  canvas.addEventListener('pointermove', event => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const next = [event.clientX, event.clientY];
    if (pointers.size === 2) {
      const other = [...pointers].find(([id]) => id !== event.pointerId)[1];
      const before = Math.hypot(previous[0] - other[0], previous[1] - other[1]);
      const after = Math.hypot(next[0] - other[0], next[1] - other[1]);
      if (before > 3 && after > 3) zoomBy(after / before);
    } else if (pointers.size === 1) {
      orbit(next[0] - previous[0], next[1] - previous[1]);
    }
    pointers.set(event.pointerId, next);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => pointers.delete(event.pointerId));
  }
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    zoomBy(Math.exp(-clamp(event.deltaY, -160, 160) * 0.0017));
  }, { passive: false });
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '三维模型。方向键旋转，加减键缩放，Home 键重置。');
  canvas.addEventListener('keydown', event => {
    const actions = {
      ArrowLeft: () => orbit(-11, 0), ArrowRight: () => orbit(11, 0),
      ArrowUp: () => orbit(0, 11), ArrowDown: () => orbit(0, -11),
      '+': () => zoomBy(1.16), '=': () => zoomBy(1.16), '-': () => zoomBy(0.86), Home: resetView,
    };
    if (!Object.hasOwn(actions, event.key)) return;
    event.preventDefault();
    actions[event.key]();
  });

  for (const button of routeButtons) button.addEventListener('click', () => navigate(button.dataset.route));
  window.addEventListener('hashchange', () => setMode(readRoute()));
  elements['building-cta'].addEventListener('click', () => navigate('building'));
  elements.depth.addEventListener('input', () => updateRange(Number(elements.depth.value)));
  elements.follow.addEventListener('click', () => setFollowing(!following));
  elements['reset-view'].addEventListener('click', resetView);
  elements.rain.addEventListener('click', () => setRain(!raining));
  elements.garden.addEventListener('click', () => {
    garden = !garden;
    activeWorld.motion.setGarden(garden);
    elements.garden.setAttribute('aria-pressed', garden);
  });
  elements.replay.addEventListener('click', () => activeWorld.motion.replay());
  elements.story.addEventListener('click', () => {
    const state = states.get(mode);
    state.story = !state.story;
    activeWorld.model.setStory(state.story);
    if (state.story) {
      resetView();
      const storySpot = { river: 'bank', hill: 'steps', rural: 'canal' }[mode];
      selectFeature(storySpot, false);
    } else {
      updateGuide();
    }
    updateStateBadge();
  });

  function frame(now) {
    renderFrame = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.067, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!showing) return;
    if (!reducedMotion.matches || following || states.get(mode).story) elapsed += dt;
    const state = states.get(mode);
    const eased = damp(state.visibleValue, state.value, 6.2, dt);
    state.visibleValue = reducedMotion.matches || Math.abs(eased - state.value) < 0.025 ? state.value : eased;
    const { model, motion } = activeWorld;
    if (mode === 'building') {
      model.update(dt, elapsed, state.visibleValue / 100, state.visibleValue > 3 ? state.selected : null);
    } else if (mode === 'atlas') {
      model.update(dt, elapsed);
    } else {
      if (activeWorld.appliedDepth !== state.visibleValue) {
        model.setDepth(state.visibleValue);
        activeWorld.appliedDepth = state.visibleValue;
      }
      model.update?.(dt, elapsed, state.visibleValue);
      motion?.update(dt, elapsed, state.visibleValue);
      if (mode === 'plain') updateRainFeedback();
    }
    updateCamera(dt);
    updatePins();
    renderer.render(scene, camera);
    if (!rendered) {
      elements.loading.hidden = true;
      rendered = true;
    }
  }

  resize();
  new ResizeObserver(resize).observe(elements.viewport);
  new IntersectionObserver(([entry]) => { showing = entry.isIntersecting; }).observe(elements.viewport);
  document.addEventListener('visibilitychange', () => { last = 0; });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    cancelAnimationFrame(renderFrame);
    elements.loading.textContent = '3D 画面已暂停。刷新页面可以重新打开。';
    elements.loading.hidden = false;
  });
  setMode(readRoute());
  renderFrame = requestAnimationFrame(frame);
}

try {
  start();
} catch (error) {
  console.error(error);
  elements.loading.textContent = '未能打开 3D 场景。请尝试启用浏览器硬件加速后刷新。';
}
