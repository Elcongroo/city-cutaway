import { destinations, underground, buildingParts, experiments, tourStops } from './coast-guide.js?v=20261120.5';
import { cases } from './coast-cases.js';

const ui = Object.fromEntries([
  'app', 'viewport', 'loading', 'places', 'scene-title', 'scene-intro', 'night', 'reset-view', 'fullscreen',
  'tour', 'cut-cta', 'view-status', 'zoom-in', 'zoom-out', 'angle', 'use-3d', 'use-map', 'render-note',
  'controls', 'slider-panel', 'range-label', 'range-value', 'depth', 'scale', 'follow', 'experiment-panel',
  'experiment-note', 'experiment', 'garden', 'replay', 'rain-progress', 'guide-heading', 'guide-copy',
  'features', 'case-buttons', 'case-panel', 'case-label', 'case-level', 'case-value', 'case-feedback',
  'case-source', 'share', 'share-result', 'share-field', 'share-location',
].map(id => [id, document.getElementById(id)]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const maximumDepth = 30;
const nav = [...ui.places.querySelectorAll('[data-route]')];
const choices = [...ui['case-buttons'].querySelectorAll('[data-case]')];
const activeExperiments = new Map();
const failureCopy = {
  'no-webgl2': '这个浏览器未能提供 WebGL 2，已切换到互动地图。',
  'context-lost': '浏览器的 3D 环境中断，已切换到互动地图。',
  'renderer-init': '这个浏览器未能初始化 3D 渲染器，已切换到互动地图。',
  'scene-init': '3D 场景初始化失败，已切换到互动地图。',
  'shader-init': '浏览器无法编译部分 3D 材质，已切换到互动地图。',
  'render-failed': '3D 画面运行中断，已切换到互动地图。',
  'module-load': '3D 资源未能加载，已切换到互动地图。',
};

let activeView;
let pendingVersion = 0;
let pinnedFormat;
let mode;
let caseId;
let level = 0;
let depth = 0;
let expansion = 0;
let selected;
let following = false;
let night = false;
let garden = false;
let tourIndex = -1;
let tourTimer;
let playbackId;
let features = [];

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function throughView(method, ...args) {
  return activeView?.adapter?.[method]?.(...args);
}

function detailSet() {
  if (mode === 'river') return underground;
  if (mode === 'building') return buildingParts;
  return {};
}

function inputValue(input, output, value, suffix, ariaText) {
  input.value = value;
  output.value = value + suffix;
  input.style.setProperty('--fill', (value / Number(input.max)) * 100 + '%');
  input.setAttribute('aria-valuetext', ariaText);
}

function refreshRange() {
  ui.depth.max = mode === 'building' ? 100 : maximumDepth;
  if (mode === 'building') inputValue(ui.depth, ui['range-value'], expansion, '%', '展开 ' + expansion + '%');
  else inputValue(ui.depth, ui['range-value'], depth, ' m', depth ? '地下 ' + depth + ' 米' : '江面');
  ui['cut-cta'].textContent = mode === 'river' && depth ? '合上剖面' : '切开江底';
}

function renderGuide() {
  const profile = destinations[mode];
  const discovery = cases[caseId];
  const item = detailSet()[selected];
  ui['guide-heading'].textContent = discovery?.title || item?.question || profile.question;
  ui['guide-copy'].textContent = discovery?.intro || item?.detail || profile.detail;
  ui['case-source'].hidden = !discovery;
  if (discovery) [ui['case-source'].textContent, ui['case-source'].href] = discovery.source;
  for (const [id, node] of features) node.setAttribute('aria-pressed', id === selected && !caseId);
}

function renderCase() {
  const discovery = cases[caseId];
  const profile = destinations[mode];
  ui.app.style.setProperty('--accent', discovery?.accent || profile.accent);
  if (caseId) ui.app.dataset.case = caseId;
  else delete ui.app.dataset.case;
  ui['case-panel'].hidden = !discovery;
  for (const node of choices) node.setAttribute('aria-pressed', node.dataset.case === caseId);
  if (discovery) {
    ui['case-label'].textContent = discovery.control;
    inputValue(ui['case-level'], ui['case-value'], level, '%', discovery.control + ' ' + level + '%');
    const neutral = caseId === 'pump' && level >= 49 && level <= 51;
    const message = neutral ? '排水泵以中等速度工作' : (level < 50 ? discovery.low : discovery.high);
    if (ui['case-feedback'].textContent !== message) ui['case-feedback'].textContent = message;
  }
  renderGuide();
}

function makeButton(label, action) {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = label;
  node.addEventListener('click', action);
  return node;
}

function renderControls() {
  const profile = destinations[mode];
  ui.app.dataset.mode = mode;
  ui['scene-title'].textContent = profile.title;
  ui['scene-intro'].textContent = profile.intro;
  const usesSlider = mode === 'river' || mode === 'building';
  ui['slider-panel'].hidden = !usesSlider;
  ui.controls.hidden = !usesSlider && !experiments[mode];
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
  features = Object.entries(detailSet()).map(([id, item]) => {
    const node = makeButton(item.label, () => selectPart(id));
    if (item.color) node.style.setProperty('--pin-color', item.color);
    return [id, node];
  });
  ui.features.replaceChildren(...features.map(([, node]) => node));
  ui['share-result'].textContent = '';
  ui['share-field'].hidden = true;
  resetAngle();
  refreshRange();
  refreshExperiment();
  renderCase();
}

function resetAngle() {
  ui.angle.setAttribute('aria-pressed', 'false');
  ui.angle.textContent = '俯瞰';
}

function refreshExperiment() {
  const configuration = experiments[mode];
  const active = Boolean(activeExperiments.get(mode));
  ui['experiment-panel'].hidden = !configuration;
  ui.garden.hidden = mode !== 'plain';
  ui.replay.hidden = mode !== 'plain';
  ui.replay.disabled = !active;
  ui['rain-progress'].hidden = mode !== 'plain' || typeof activeView?.adapter.progress !== 'function';
  if (configuration) {
    ui.experiment.textContent = active ? configuration.stop : configuration.play;
    ui.experiment.setAttribute('aria-pressed', active);
    ui['experiment-note'].textContent = active ? configuration.note : '';
  }
}

function setFollowing(value, notifyView = true) {
  if (following === value) return;
  if (value) {
    stopTour();
    if (caseId) closeCase();
    if (depth < 16) setDepth(20);
    selected = 'metro';
    throughView('selectPart', selected, false);
  }
  following = value;
  if (notifyView) throughView('setFollowing', value);
  ui.follow.textContent = value ? '退出跟拍' : '跟拍地铁';
  ui.follow.setAttribute('aria-pressed', value);
  renderGuide();
}

function setDepth(value) {
  depth = clamp(value, 0, maximumDepth);
  if (following && depth < 16) setFollowing(false);
  if (caseId && mode === 'river' && depth < 26) closeCase();
  throughView('setDepth', depth);
  refreshRange();
}

function setExpansion(value) {
  expansion = clamp(value, 0, 100);
  if (caseId === 'load' && expansion < 30) closeCase();
  throughView('setExpansion', expansion);
  refreshRange();
}

function selectPart(id) {
  const detail = detailSet()[id];
  if (!detail) return;
  stopTour();
  setFollowing(false);
  if (caseId) closeCase();
  selected = id;
  if (mode === 'river' && depth < detail.depth) setDepth(detail.depth);
  if (mode === 'building' && expansion < 68) setExpansion(82);
  throughView('selectPart', id);
  renderGuide();
}

function parseLocation() {
  const url = new URL(location.href);
  const request = url.hash.slice(1);
  const found = url.searchParams.get('case');
  const discovery = Object.hasOwn(cases, found) ? cases[found] : null;
  const rawLevel = url.searchParams.get('level');
  const numeric = rawLevel !== null ? Number(rawLevel) : NaN;
  return {
    mode: discovery?.mode || (Object.hasOwn(destinations, request) ? request : 'atlas'),
    caseId: discovery ? found : undefined,
    level: Number.isFinite(numeric) ? clamp(numeric, 0, 100) : discovery?.initial,
    format: url.searchParams.get('view') === 'map' ? 'map' : undefined,
  };
}

function link() {
  const url = new URL(location.pathname, location.origin);
  url.hash = mode;
  if (caseId) {
    url.searchParams.set('case', caseId);
    url.searchParams.set('level', String(level));
  }
  if (pinnedFormat === 'map') url.searchParams.set('view', 'map');
  return url;
}

function writeLocation(replace = false) {
  const url = link();
  if (url.href !== location.href) history[replace ? 'replaceState' : 'pushState'](null, '', url);
}

function closeCase() {
  caseId = undefined;
  throughView('setDiscover', null, 0);
  renderCase();
  writeLocation(true);
}

function applyStateToView(adapter, immediate) {
  adapter.setMode(mode, immediate);
  adapter.setDepth(depth);
  adapter.setExpansion(expansion);
  adapter.setNight(night);
  adapter.setExperiment(mode, Boolean(activeExperiments.get(mode)));
  adapter.setGarden?.(garden);
  adapter.selectPart?.(selected, false);
  adapter.setDiscover(caseId || null, level, Boolean(caseId));
  adapter.setFollowing?.(following);
}

function enter(id, discoveryId, value, { immediate = false, preserve = false } = {}) {
  if (!Object.hasOwn(destinations, id)) return;
  const sceneChanged = mode !== id;
  mode = id;
  caseId = discoveryId;
  if (caseId) level = clamp(value ?? cases[caseId].initial, 0, 100);
  selected = undefined;
  if (following) {
    following = false;
    ui.follow.textContent = '跟拍地铁';
    ui.follow.setAttribute('aria-pressed', 'false');
  }
  if (sceneChanged || !preserve) {
    depth = mode === 'river' ? maximumDepth : 0;
    if (mode === 'building') expansion = caseId === 'load' ? 82 : 58;
  }
  if (caseId && mode === 'river') depth = Math.max(depth, 28);
  if (caseId === 'load') expansion = Math.max(expansion, 82);
  if (activeView) applyStateToView(activeView.adapter, immediate);
  renderControls();
}

function navigate(id, automatic = false) {
  if (!automatic) stopTour();
  if (id === mode && !caseId) return;
  enter(id);
  writeLocation(automatic);
}

function chooseCase(id) {
  if (!Object.hasOwn(cases, id)) return;
  stopTour();
  if (caseId === id) {
    closeCase();
    return;
  }
  enter(cases[id].mode, id, cases[id].initial);
  writeLocation();
  ui.viewport.parentElement?.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'instant' : 'smooth' });
}

function stopTour() {
  if (tourIndex < 0) return;
  clearTimeout(tourTimer);
  tourIndex = -1;
  ui.tour.textContent = '沿江巡游';
  ui.tour.setAttribute('aria-pressed', 'false');
}

function nextTourStop() {
  const id = tourStops[tourIndex++];
  if (!id) return stopTour();
  navigate(id, true);
  tourTimer = setTimeout(nextTourStop, id === 'river' ? 9600 : 6900);
}

function onInteract() {
  stopTour();
  if (following) setFollowing(false, false);
}

function setFormatUI(kind, reason = '') {
  ui.app.dataset.render = kind;
  const is3D = kind === '3d';
  ui['use-3d'].setAttribute('aria-pressed', is3D);
  ui['use-map'].setAttribute('aria-pressed', !is3D);
  ui.angle.hidden = typeof activeView?.adapter.toggleAngle !== 'function';
  resetAngle();
  ui['zoom-in'].hidden = ui['zoom-out'].hidden = typeof activeView?.adapter.zoom !== 'function';
  ui['render-note'].hidden = !reason;
  ui['render-note'].textContent = reason;
  refreshExperiment();
}

async function mount(kind, note = '') {
  const edition = ++pendingVersion;
  if (activeView?.kind === kind) {
    setFormatUI(kind, note);
    return;
  }
  const layer = document.createElement('div');
  layer.className = 'renderer-layer';
  layer.style.visibility = 'hidden';
  ui.viewport.append(layer);
  ui.loading.hidden = Boolean(activeView);
  ui.loading.textContent = kind === '3d' ? '正在搭建海湾城市…' : '正在绘制互动地图…';
  let adapter;
  try {
    const options = {
      onNavigate: navigate,
      onFeature: selectPart,
      onInteract,
      onStatus(text) { if (activeView?.layer === layer) ui['view-status'].textContent = text; },
      onError(error) {
        if (activeView?.layer !== layer) return;
        console.error(error);
        mount('map', failureCopy[error.code] || failureCopy['render-failed']);
      },
    };
    if (kind === '3d') {
      const { createCoast3D } = await import('./coast-3d.js?v=20261120.5.1');
      if (edition !== pendingVersion) { layer.remove(); return; }
      adapter = createCoast3D(layer, options);
    } else {
      const { createCoastMap } = await import('./coast-map.js');
      if (edition !== pendingVersion) { layer.remove(); return; }
      adapter = createCoastMap(layer, options);
    }
    applyStateToView(adapter, true);
    const previous = activeView;
    activeView = { adapter, layer, kind };
    layer.style.visibility = '';
    previous?.adapter.destroy();
    previous?.layer.remove();
    ui['view-status'].textContent = '';
    setFormatUI(kind, note);
    adapter.start?.();
    ui.loading.hidden = true;
  } catch (error) {
    adapter?.destroy();
    layer.remove();
    if (edition !== pendingVersion) return;
    console.error(error);
    const reason = failureCopy[error.code] || failureCopy['module-load'];
    if (kind === '3d' && activeView?.kind === 'map') {
      setFormatUI('map', reason);
      ui.loading.hidden = true;
      return;
    }
    if (kind === '3d') return mount('map', reason);
    ui.loading.hidden = false;
    ui.loading.textContent = '互动地图也未能加载。可以刷新页面或再试 3D。';
  }
}

function chooseFormat(kind) {
  stopTour();
  pinnedFormat = kind === 'map' ? 'map' : undefined;
  writeLocation(true);
  mount(kind);
}

async function share() {
  const value = link().href;
  ui['share-result'].textContent = '';
  ui['share-field'].hidden = true;
  try {
    await navigator.clipboard.writeText(value);
    ui['share-result'].textContent = caseId ? '已复制实验链接' : '已复制场景链接';
  } catch {
    ui['share-field'].hidden = false;
    ui['share-location'].value = value;
    ui['share-location'].focus();
    ui['share-location'].select();
  }
}

function refreshLocation() {
  stopTour();
  const state = parseLocation();
  const oldFormat = pinnedFormat;
  pinnedFormat = state.format;
  enter(state.mode, state.caseId, state.level);
  if (state.format !== oldFormat && activeView?.kind !== (state.format || '3d')) mount(state.format || '3d');
}
window.addEventListener('hashchange', refreshLocation);
window.addEventListener('popstate', refreshLocation);

for (const node of nav) node.addEventListener('click', () => navigate(node.dataset.route));
for (const node of choices) node.addEventListener('click', () => chooseCase(node.dataset.case));
ui['case-level'].addEventListener('input', () => {
  if (!caseId) return;
  level = clamp(Number(ui['case-level'].value), 0, 100);
  throughView('setDiscover', caseId, level, false);
  renderCase();
  writeLocation(true);
});
ui.depth.addEventListener('input', () => {
  stopTour();
  const value = Number(ui.depth.value);
  if (mode === 'building') setExpansion(value);
  else setDepth(value);
});
ui['cut-cta'].addEventListener('click', () => {
  stopTour();
  if (mode === 'river') setDepth(depth ? 0 : maximumDepth);
  else navigate('river');
});
ui.tour.addEventListener('click', () => {
  if (tourIndex >= 0) return stopTour();
  tourIndex = 0;
  ui.tour.textContent = '结束巡游';
  ui.tour.setAttribute('aria-pressed', 'true');
  nextTourStop();
});
ui.follow.addEventListener('click', () => setFollowing(!following));
ui.night.addEventListener('click', () => {
  night = !night;
  ui.app.dataset.night = String(night);
  ui.night.textContent = night ? '日景' : '夜景';
  ui.night.setAttribute('aria-pressed', night);
  throughView('setNight', night);
});
ui.experiment.addEventListener('click', () => {
  stopTour();
  const active = !activeExperiments.get(mode);
  activeExperiments.set(mode, active);
  throughView('setExperiment', mode, active);
  refreshExperiment();
});
ui.garden.addEventListener('click', () => {
  garden = !garden;
  ui.garden.setAttribute('aria-pressed', garden);
  throughView('setGarden', garden);
});
ui.replay.addEventListener('click', () => throughView('replay'));
ui['use-3d'].addEventListener('click', () => chooseFormat('3d'));
ui['use-map'].addEventListener('click', () => chooseFormat('map'));
ui['zoom-in'].addEventListener('click', () => { onInteract(); throughView('zoom', 0.82); });
ui['zoom-out'].addEventListener('click', () => { onInteract(); throughView('zoom', 1.22); });
ui['reset-view'].addEventListener('click', () => { onInteract(); resetAngle(); throughView('resetView'); });
ui.angle.addEventListener('click', () => {
  onInteract();
  const aerial = throughView('toggleAngle');
  ui.angle.textContent = aerial ? '斜视' : '俯瞰';
  ui.angle.setAttribute('aria-pressed', Boolean(aerial));
});
ui.share.addEventListener('click', share);
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
  const name = document.fullscreenElement ? '退出全屏' : '全屏';
  ui.fullscreen.setAttribute('aria-label', name);
  ui.fullscreen.title = name;
});

function playback() {
  playbackId = requestAnimationFrame(playback);
  if (mode === 'plain') ui['rain-progress'].value = throughView('progress') || 0;
}

window.addEventListener('pagehide', event => {
  if (!event.persisted) {
    cancelAnimationFrame(playbackId);
    pendingVersion++;
    activeView?.adapter.destroy();
  }
});

const initial = parseLocation();
pinnedFormat = initial.format;
enter(initial.mode, initial.caseId, initial.level, { immediate: true });
mount(pinnedFormat || '3d');
playbackId = requestAnimationFrame(playback);
