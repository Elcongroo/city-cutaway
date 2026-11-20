import * as THREE from './vendor/three.module.js';
import { createCity } from './scene.js';
import { createMotion } from './motion.js';

const viewport = document.querySelector('#viewport');
const loading = document.querySelector('#loading');
const depthInput = document.querySelector('#depth');
const depthValue = document.querySelector('#depth-value');
const layerName = document.querySelector('#layer-name');
const layerDot = document.querySelector('#layer-status .rail-dot');
const depthButtons = [...document.querySelectorAll('[data-depth]')];
const followButton = document.querySelector('#follow');
const followLabel = document.querySelector('#follow-label');
const resetButton = document.querySelector('#reset-view');
const rainButton = document.querySelector('#rain');
const rainLabel = document.querySelector('#rain-label');
const gardenButton = document.querySelector('#garden');
const replayButton = document.querySelector('#replay');
const rainProgress = document.querySelector('#rain-progress');
const rainStatus = document.querySelector('#rain-status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const { clamp, damp } = THREE.MathUtils;

const layers = [
  { minimum: 0, button: 0, name: '城市街面', color: 'road' },
  { minimum: 1, button: 7, name: '浅层排水', color: 'drain' },
  { minimum: 8, button: 14, name: '地铁隧道', color: 'metro' },
  { minimum: 16, button: 24, name: '地下基岩', color: 'earth' },
];

function start() {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0, 0);
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  viewport.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 160);
  scene.add(new THREE.HemisphereLight(0xd5e9ff, 0xa37d68, 2.1));
  const light = new THREE.DirectionalLight(0xffdeba, 2.4);
  light.position.set(-12, 28, 18);
  scene.add(light);
  const rim = new THREE.DirectionalLight(0x94bcff, 1.45);
  rim.position.set(16, 12, -18);
  scene.add(rim);

  const city = createCity(scene);
  const motion = createMotion(scene);
  const look = new THREE.Vector3(0, 1.35, 0);
  const nextLook = new THREE.Vector3();
  const train = new THREE.Vector3();
  const view = {
    yaw: 0.53,
    pitch: 0.295,
    zoom: 1,
    actualYaw: 0.53,
    actualPitch: 0.295,
    actualZoom: 1,
  };

  let width = 1;
  let height = 1;
  let aspect = 1;
  let depth = Number(depthInput.value);
  let visibleDepth = reducedMotion.matches ? depth : 0;
  let appliedDepth = NaN;
  let following = false;
  let raining = false;
  let garden = false;
  let elapsed = 0;
  let last = 0;
  let activeLayer;
  let activeRainStatus;
  let showing = true;
  let renderFrame = 0;

  function setDepth(nextDepth) {
    depth = clamp(Math.round(nextDepth), 0, 24);
    depthInput.value = depth;
    depthValue.firstChild.data = depth + ' ';
    depthInput.style.setProperty('--fill', (depth / 24) * 100 + '%');
    depthInput.setAttribute('aria-valuetext', depth === 0 ? '地表' : `地下 ${depth} 米`);
    if (depth < 12 && following) setFollowing(false);
    const layer = layers.findLast(item => depth >= item.minimum);
    if (activeLayer === layer) return;
    activeLayer = layer;
    layerName.textContent = layer.name;
    layerDot.className = 'rail-dot ' + layer.color;
    for (const button of depthButtons) {
      if (Number(button.dataset.depth) === layer.button) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
  }

  function setFollowing(active) {
    following = active;
    followButton.setAttribute('aria-pressed', active);
    followLabel.textContent = active ? '退出跟拍' : '跟拍地铁';
    if (active && depth < 14) setDepth(14);
  }

  function resetView() {
    setFollowing(false);
    view.yaw = 0.53;
    view.pitch = 0.295;
    view.zoom = 1;
  }

  function setRain(active) {
    raining = active;
    motion.setRain(active);
    rainButton.setAttribute('aria-pressed', active);
    rainLabel.textContent = active ? '停止下雨' : '开始下雨';
    replayButton.disabled = !active;
    if (active && depth < 8) setDepth(8);
  }

  function updateRainFeedback() {
    const progress = raining ? motion.getPhase() : 0;
    rainProgress.value = progress;
    let status = '观察雨水如何进入排水管';
    if (raining && progress >= 0.8) status = garden ? '雨水花园吸收部分径流' : '径流汇入地下排水管';
    else if (raining && progress >= 0.4) status = garden ? '雨水流向花园' : '雨水流向路边的排水口';
    else if (raining) status = '雨水沿屋顶和路面流动';
    else if (garden) status = '雨水花园已启用';
    if (status !== activeRainStatus) {
      rainStatus.textContent = status;
      activeRainStatus = status;
    }
  }

  function resize() {
    width = Math.max(1, viewport.clientWidth);
    height = Math.max(1, viewport.clientHeight);
    aspect = width / height;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 650 ? 1.4 : 1.7));
    renderer.setSize(width, height, false);
  }
  resize();
  new ResizeObserver(resize).observe(viewport);

  function updateCamera(dt) {
    const easing = reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 5);
    let yaw = view.yaw;
    let pitch = view.pitch;
    let zoom = view.zoom;
    nextLook.set(0, 2.2 - visibleDepth * 0.045, 0);
    if (following) {
      motion.getTrainPosition(train);
      nextLook.set(train.x * 0.7, train.y + 1.4, 2);
      yaw = 0.38;
      pitch = 0.17;
      zoom = 1.85;
    }
    look.lerp(nextLook, easing);
    view.actualYaw = THREE.MathUtils.lerp(view.actualYaw, yaw, easing);
    view.actualPitch = THREE.MathUtils.lerp(view.actualPitch, pitch, easing);
    view.actualZoom = THREE.MathUtils.lerp(view.actualZoom, zoom, easing);
    const horizontal = Math.cos(view.actualPitch) * 58;
    camera.position.copy(look).add(new THREE.Vector3(
      Math.sin(view.actualYaw) * horizontal,
      Math.sin(view.actualPitch) * 58,
      Math.cos(view.actualYaw) * horizontal,
    ));
    const halfHeight = Math.max(28.5, 41 / aspect) / (view.actualZoom * 2);
    const halfWidth = halfHeight * aspect;
    const shift = width > 940 ? halfWidth * 0.095 : 0;
    camera.left = -halfWidth - shift;
    camera.right = halfWidth - shift;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.lookAt(look);
    camera.updateProjectionMatrix();
  }

  const canvas = renderer.domElement;
  const pointers = new Map();
  const orbit = (dx, dy) => {
    if (following) setFollowing(false);
    view.yaw = clamp(view.yaw - dx * 0.009, -0.66, 1.04);
    view.pitch = clamp(view.pitch + dy * 0.006, 0.09, 0.78);
  };
  const zoomBy = multiplier => {
    if (following) setFollowing(false);
    view.zoom = clamp(view.zoom * multiplier, 0.73, 2.3);
  };
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
    zoomBy(Math.exp(-clamp(event.deltaY, -180, 180) * 0.0016));
  }, { passive: false });

  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '城市模型。用方向键旋转，用加减键缩放。');
  canvas.addEventListener('keydown', event => {
    const actions = {
      ArrowLeft: () => orbit(-11, 0),
      ArrowRight: () => orbit(11, 0),
      ArrowUp: () => orbit(0, 11),
      ArrowDown: () => orbit(0, -11),
      '+': () => zoomBy(1.16),
      '=': () => zoomBy(1.16),
      '-': () => zoomBy(0.86),
      Home: resetView,
    };
    const action = actions[event.key];
    if (typeof action !== 'function') return;
    event.preventDefault();
    action();
  });

  depthInput.addEventListener('input', () => setDepth(Number(depthInput.value)));
  for (const button of depthButtons) {
    button.addEventListener('click', () => setDepth(Number(button.dataset.depth)));
  }
  followButton.addEventListener('click', () => setFollowing(!following));
  resetButton.addEventListener('click', resetView);
  rainButton.addEventListener('click', () => setRain(!raining));
  gardenButton.addEventListener('click', () => {
    garden = !garden;
    motion.setGarden(garden);
    gardenButton.setAttribute('aria-pressed', garden);
  });
  replayButton.addEventListener('click', motion.replay);

  function frame(now) {
    renderFrame = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.06, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!showing) return;
    if (!reducedMotion.matches || following) elapsed += dt;
    const easedDepth = damp(visibleDepth, depth, 5.8, dt);
    visibleDepth = reducedMotion.matches || Math.abs(easedDepth - depth) < 0.02 ? depth : easedDepth;
    if (visibleDepth !== appliedDepth) {
      city.setDepth(visibleDepth);
      appliedDepth = visibleDepth;
    }
    motion.update(dt, elapsed, visibleDepth);
    updateCamera(dt);
    updateRainFeedback();
    renderer.render(scene, camera);
    loading.hidden = true;
  }

  new IntersectionObserver(([entry]) => { showing = entry.isIntersecting; }).observe(viewport);
  document.addEventListener('visibilitychange', () => { last = 0; });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    cancelAnimationFrame(renderFrame);
    loading.textContent = '3D 画面已暂停。刷新页面可以重新打开街区。';
    loading.hidden = false;
  });
  setDepth(depth);
  renderFrame = requestAnimationFrame(frame);
}

try {
  start();
} catch (error) {
  console.error(error);
  loading.textContent = '未能打开 3D 场景。请尝试启用浏览器硬件加速后刷新。';
}
