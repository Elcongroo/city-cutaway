import * as THREE from './vendor/three.module.js';
import { connectRenderer, viewError } from './render-context.js';
import { createStreetScene } from './street-scene.js';
import { createStreetUnderground } from './street-underground.js';
import { createStreetAtmosphere } from './street-atmosphere.js';
import { streetParts } from './street-guide.js';

const { clamp, damp, lerp, degToRad } = THREE.MathUtils;

export function createStreet3D(container, { onStreetPart, onInteract, onError }) {
  const { renderer, canvas } = connectRenderer();
  renderer.setClearColor(0, 0);
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.07;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  let failedShader = false;
  renderer.debug.onShaderError = () => { failedShader = true; };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.2, 240);
  const sky = new THREE.Color(0x90abc9);
  const sunlight = new THREE.Color(0xffcd9d);
  const dusk = new THREE.Color(0x9cb4de);
  const nightSky = new THREE.Color(0x8daacf);
  const nightKey = new THREE.Color(0xffc290);
  const nightRim = new THREE.Color(0x85c7ff);
  const ambient = new THREE.HemisphereLight(nightSky, 0x544c56, 1.3);
  const key = new THREE.DirectionalLight(0xffc290, 2.55);
  key.position.set(-31, 37, 13);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -23, right: 23, top: 20, bottom: -20, near: 15, far: 81 });
  key.shadow.bias = -0.00045;
  key.shadow.normalBias = 0.045;
  key.shadow.radius = 2.7;
  const rim = new THREE.DirectionalLight(0x85c7ff, 2.25);
  rim.position.set(16, 18, -25);
  const bounce = new THREE.DirectionalLight(0xa0bfe4, 0.67);
  bounce.position.set(28, 5, 40);
  scene.add(ambient, key, rim, bounce);

  let street;
  let underground;
  let atmosphere;
  try {
    street = createStreetScene(scene);
    underground = createStreetUnderground(scene);
    atmosphere = createStreetAtmosphere(scene);
  } catch (error) {
    renderer.dispose();
    renderer.forceContextLoss();
    throw viewError('scene-init', error);
  }

  const annotations = document.createElement('div');
  annotations.className = 'pins';
  annotations.setAttribute('aria-label', '选择街道下面的设施');
  container.append(canvas, annotations);
  const markers = Object.entries(streetParts).flatMap(([id, part]) => {
    if (!underground.features[id]) return [];
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'pin street-pin';
    node.textContent = part.label;
    node.style.setProperty('--pin-color', part.color);
    node.hidden = true;
    node.addEventListener('click', () => onStreetPart(id));
    annotations.append(node);
    return [{ id, node, point: underground.features[id] }];
  });

  const look = new THREE.Vector3();
  const current = { yaw: 0.48, pitch: 0.31, span: 52 };
  const desired = { yaw: 0.48, pitch: 0.31, span: 52, look: new THREE.Vector3() };
  const offset = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let opened = 0;
  let targetOpen = 0;
  let focus = null;
  let night = true;
  let nightMix = 1;
  let width = 1;
  let height = 1;
  let visible = true;
  let stop = false;
  let elapsed = 0;
  let last = 0;
  let handle;

  function defaults(immediate = false) {
    const wide = width > 750;
    const selected = focus && underground.features[focus];
    desired.yaw = selected && focus === 'foundation' ? 0.35 : wide || selected ? 0.49 : 0.62;
    desired.pitch = selected ? 0.12 : targetOpen ? 0.25 : wide ? 0.32 : 0.38;
    desired.span = selected ? (wide ? 43 : 32) : targetOpen ? (wide ? 69 : 45) : (wide ? 56 : 44);
    if (selected) {
      desired.look.copy(selected);
      desired.look.x *= 0.76;
      desired.look.y += 1.25;
      desired.look.z *= 0.79;
    } else {
      const aim = targetOpen ? (wide ? -3.6 : -0.55) : (wide ? 1.35 : 4.5);
      desired.look.set(wide ? -2.0 : 0, aim, targetOpen ? 0.25 : -0.5);
    }
    if (immediate || reduced.matches) {
      Object.assign(current, { yaw: desired.yaw, pitch: desired.pitch, span: desired.span });
      look.copy(desired.look);
    }
  }

  function resize() {
    const wasWide = width > 750;
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width > 650 ? 1.55 : 1.25));
    renderer.setSize(width, height, false);
    if (wasWide !== (width > 750)) defaults();
  }

  function stepCamera(dt) {
    const weight = reduced.matches ? 1 : 1 - Math.exp(-dt * 5.2);
    look.lerp(desired.look, weight);
    current.yaw = lerp(current.yaw, desired.yaw, weight);
    current.pitch = lerp(current.pitch, desired.pitch, weight);
    current.span = lerp(current.span, desired.span, weight);
    const worldHeight = Math.max(current.span / camera.aspect, current.span * 0.55);
    const distance = worldHeight / (2 * Math.tan(degToRad(camera.fov / 2)));
    const along = Math.cos(current.pitch) * distance;
    offset.set(Math.sin(current.yaw) * along, Math.sin(current.pitch) * distance, Math.cos(current.yaw) * along);
    camera.position.copy(look).add(offset);
    camera.lookAt(look);
    camera.updateMatrixWorld();
  }

  function stepLabels() {
    const used = [];
    for (const { id, node, point } of markers) {
      projected.copy(point).project(camera);
      const hidden = opened < 0.67 || (focus && id !== focus) || Math.abs(projected.x) > 0.96
        || Math.abs(projected.y) > 0.89 || Math.abs(projected.z) > 1;
      node.hidden = Boolean(hidden);
      if (hidden) continue;
      const left = clamp((projected.x + 1) * width * 0.5, 45, width - 45);
      let top = (1 - projected.y) * height * 0.5;
      const labelHeight = width > 740 ? 38 : 30;
      for (let attempt = 0; attempt < markers.length; attempt++) {
        const overlap = used.find(item => Math.abs(item.left - left) < 77 && Math.abs(item.top - top) < labelHeight);
        if (!overlap) break;
        top = overlap.top - labelHeight;
      }
      used.push({ left, top });
      node.style.transform = 'translate3d(' + left + 'px,' + top + 'px,0) translate(-50%,calc(-100% - 6px))';
    }
  }

  function fail(error) {
    if (stop) return;
    stop = true;
    cancelAnimationFrame(handle);
    onError(error);
  }

  function frame(now) {
    if (stop) return;
    handle = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.067, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!visible) return;
    try {
      if (!reduced.matches) elapsed += dt;
      const opening = damp(opened, targetOpen, 3.45, dt);
      const next = reduced.matches || Math.abs(opening - targetOpen) < 0.004 ? targetOpen : opening;
      if (next !== opened) underground.setOpen(next);
      opened = next;
      nightMix = reduced.matches ? Number(night) : damp(nightMix, Number(night), 4.6, dt);
      ambient.color.copy(sky).lerp(nightSky, nightMix);
      ambient.intensity = lerp(2.05, 1.06, nightMix);
      key.color.copy(sunlight).lerp(nightKey, nightMix);
      key.intensity = lerp(3.0, 2.55, nightMix);
      rim.color.copy(dusk).lerp(nightRim, nightMix);
      rim.intensity = lerp(1.08, 2.25, nightMix);
      street.update(dt, elapsed, opened);
      underground.update(dt, elapsed);
      atmosphere.update(dt, elapsed, opened);
      stepCamera(dt);
      stepLabels();
      renderer.render(scene, camera);
      if (failedShader) fail(viewError('shader-init'));
    } catch (error) {
      fail(viewError('render-failed', error));
    }
  }

  function orbit(x, y) {
    onInteract();
    desired.yaw = clamp(desired.yaw - x * 0.007, -0.63, 1.14);
    desired.pitch = clamp(desired.pitch + y * 0.005, 0.14, 0.83);
  }

  function zoom(scale) {
    desired.span = clamp(desired.span * scale, 20, 86);
  }

  const pointers = new Map();
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '可旋转的三维街角。方向键旋转，滚轮或加减键缩放。');
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
  });
  canvas.addEventListener('pointermove', event => {
    const before = pointers.get(event.pointerId);
    if (!before) return;
    const point = [event.clientX, event.clientY];
    if (pointers.size === 2) {
      const other = [...pointers].find(([id]) => id !== event.pointerId)[1];
      const from = Math.hypot(before[0] - other[0], before[1] - other[1]);
      const to = Math.hypot(point[0] - other[0], point[1] - other[1]);
      if (from > 5 && to > 5) zoom(from / to);
    } else if (pointers.size === 1) orbit(point[0] - before[0], point[1] - before[1]);
    pointers.set(event.pointerId, point);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => pointers.delete(event.pointerId));
  }
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    zoom(Math.exp(clamp(event.deltaY, -160, 160) * 0.0017));
  }, { passive: false });
  canvas.addEventListener('keydown', event => {
    const action = {
      ArrowLeft: () => orbit(-17, 0), ArrowRight: () => orbit(17, 0),
      ArrowUp: () => orbit(0, 14), ArrowDown: () => orbit(0, -14),
      '+': () => zoom(0.85), '=': () => zoom(0.85), '-': () => zoom(1.16),
      Home: () => defaults(),
    }[event.key];
    if (typeof action !== 'function') return;
    event.preventDefault();
    action();
  });
  function contextLost(event) { event.preventDefault(); fail(viewError('context-lost')); }
  canvas.addEventListener('webglcontextlost', contextLost);
  const size = new ResizeObserver(resize);
  const presence = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  size.observe(container);
  presence.observe(container);
  resize();
  defaults(true);
  underground.setOpen(0);

  return {
    setStreet(value, selected, immediate = false) {
      targetOpen = Number(value);
      focus = targetOpen && selected && underground.features[selected] ? selected : null;
      underground.setFocus(focus);
      for (const { id, node } of markers) node.setAttribute('aria-pressed', id === focus);
      if (immediate || reduced.matches) {
        opened = targetOpen;
        underground.setOpen(opened);
      }
      defaults(immediate);
    },
    setNight(value) {
      night = value;
      street.setNight?.(value);
      atmosphere.setNight?.(value);
    },
    resetView: () => defaults(),
    zoom,
    start() {
      if (!handle && !stop) handle = requestAnimationFrame(frame);
    },
    destroy() {
      stop = true;
      cancelAnimationFrame(handle);
      size.disconnect();
      presence.disconnect();
      canvas.removeEventListener('webglcontextlost', contextLost);
      const geometries = new Set();
      const materials = new Set();
      scene.traverse(item => {
        if (item.geometry) geometries.add(item.geometry);
        if (item.material) for (const material of [item.material].flat()) materials.add(material);
      });
      for (const material of materials) {
        if (material.map?.isTexture) material.map.dispose();
        material.dispose();
      }
      for (const geometry of geometries) geometry.dispose();
      key.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      annotations.remove();
    },
  };
}
