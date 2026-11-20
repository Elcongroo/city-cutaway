import { destinations, underground, buildingParts, experiments, tourStops } from './coast-guide.js?v=20261120.8';
import { cases } from './coast-cases.js?v=20261120.7';
import { createPumpRun, pumpDefaults } from './pump-model.js';
import { GEO, geoSites, geoFilters, geoSources } from './geo-data.js';
import { streetParts } from './street-guide.js?v=20261120.8';

const ui = Object.fromEntries([
  'app', 'viewport', 'loading', 'places', 'scene-title', 'scene-intro', 'night', 'sunset', 'reset-view', 'fullscreen',
  'tour', 'cut-cta', 'view-status', 'zoom-in', 'zoom-out', 'angle', 'use-3d', 'use-map', 'render-note',
  'controls', 'slider-panel', 'range-label', 'range-value', 'depth', 'scale', 'follow', 'experiment-panel',
  'experiment-note', 'experiment', 'garden', 'replay', 'rain-progress', 'guide-heading', 'guide-copy',
  'features', 'case-buttons', 'case-panel', 'case-label', 'case-level', 'case-value', 'case-feedback',
  'case-source', 'share', 'share-result', 'share-field', 'share-location', 'study-steps',
  'pump-meter', 'pump-water', 'pump-height', 'pump-indicators', 'pump-storm', 'pump-primary', 'pump-auto',
  'pump-lab', 'pump-inflow', 'pump-inflow-value', 'pump-stages', 'pump-reset',
  'geo-home', 'geo-key', 'geo-toolbar', 'geo-sites', 'geo-filters', 'geo-measures', 'geo-layers', 'geo-model-note',
  'street-controls', 'street-toggle', 'street-parts', 'street-note', 'retry-3d',
].map(id => [id, document.getElementById(id)]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const maximumDepth = 30;
const nav = [...ui.places.querySelectorAll('[data-route]')];
const choices = [...ui['case-buttons'].querySelectorAll('[data-case]')];
const activeExperiments = new Map();
const pumpSettings = { ...pumpDefaults };
const pumpRun = createPumpRun();
const ground = { site: null, depth: GEO.limit, filter: 'all' };
const sitesById = new Map(geoSites.map(site => [site.id, site]));
const groundFilters = new Set(geoFilters.map(([id]) => id));
const pumpParts = {
  inlet: { label: '进水沟', title: '水是怎么找到集水井的？', intro: '沟道利用高差，把坡道和路面的来水引到低处。进水变大时，井里开始存水。' },
  well: { label: '集水井', title: '泵启动之前，水先存在哪？', intro: '集水井提供一段蓄水空间。水位传感器可以触发泵的控制。这个模型里，备用泵在高水位接管。' },
  pumps: { label: '主泵 / 备用泵', title: '主泵停了，排水为什么还能继续？', intro: '还有一台备用泵可以排水。试试把主泵停掉，对比备用自动开启和关闭时的水位。' },
  outlet: { label: '止回阀 / 出水管', title: '水抽上去以后，会自己流回井里吗？', intro: '止回阀用来阻止倒流。泵停止后，排水管里的水就有了一道单向关口。' },
};
const practice = {
  lock: [[16, '船入闸'], [31, '关下闸'], [63, '升水位'], [100, '驶出']],
  tide: [[0, '低潮'], [50, '中潮'], [100, '高潮']],
};
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
let streetNight = true;
let streetOpen = false;
let streetFocus = null;
let sunset = true;
let garden = false;
let tourIndex = -1;
let tourTimer;
let playbackId;
let playbackTime = 0;
let features = [];
let pumpStage = null;
let stepCase;

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
  ui.depth.max = mode === 'geo' ? GEO.limit : mode === 'building' ? 100 : maximumDepth;
  if (mode === 'geo') inputValue(ui.depth, ui['range-value'], ground.depth, ' m', '向下显露 ' + ground.depth + ' 米');
  else if (mode === 'building') inputValue(ui.depth, ui['range-value'], expansion, '%', '展开 ' + expansion + '%');
  else inputValue(ui.depth, ui['range-value'], depth, ' m', depth ? '地下 ' + depth + ' 米' : '江面');
  ui['cut-cta'].textContent = mode === 'river' && depth ? '合上剖面' : '切开江底';
}

function renderGuide() {
  const profile = destinations[mode];
  if (mode === 'geo') {
    renderGroundGuide();
    return;
  }
  const discovery = cases[caseId];
  const pumpDetail = caseId === 'pump' ? pumpParts[pumpStage] : undefined;
  const item = detailSet()[selected];
  ui['guide-heading'].textContent = pumpDetail?.title || discovery?.title || item?.question || profile.question;
  ui['guide-copy'].textContent = pumpDetail?.intro || discovery?.intro || item?.detail || profile.detail;
  const source = discovery?.source || profile.source;
  ui['case-source'].hidden = !source;
  if (source) [ui['case-source'].textContent, ui['case-source'].href] = source;
  for (const [id, node] of features) node.setAttribute('aria-pressed', id === selected && !caseId);
}

function renderCase() {
  const discovery = cases[caseId];
  const profile = destinations[mode];
  ui.app.style.setProperty('--accent', discovery?.accent || profile.accent);
  if (caseId) ui.app.dataset.case = caseId;
  else delete ui.app.dataset.case;
  ui['case-panel'].hidden = !discovery;
  ui['pump-meter'].hidden = ui['pump-lab'].hidden = caseId !== 'pump';
  ui['study-steps'].hidden = !practice[caseId];
  for (const node of choices) node.setAttribute('aria-pressed', node.dataset.case === caseId);
  if (discovery) {
    ui['case-label'].textContent = discovery.control;
    inputValue(ui['case-level'], ui['case-value'], level, '%', discovery.control + ' ' + level + '%');
    let message = level < 50 ? discovery.low : discovery.high;
    if (caseId === 'pump') message = pumpSettings.primary ? '主泵功率可调，进水强度在下方' : '主泵已停，看看备用泵会怎样';
    if (caseId === 'lock') message = level < 22 ? '下游闸门打开，船进入闸室' : level < 35 ? '下游闸门正在关闭'
      : level < 73 ? '闸室注水，船随水位上升' : level < 87 ? '水位齐平，上游闸门开启' : '小船驶向上游';
    if (ui['case-feedback'].textContent !== message) ui['case-feedback'].textContent = message;
  }
  if (caseId === 'pump') updatePumpControls();
  if (stepCase !== caseId) {
    stepCase = caseId;
    ui['study-steps'].replaceChildren(...(practice[caseId] || []).map(([value, label]) => makeButton(label, () => changeCaseLevel(value))));
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

const streetButtons = Object.entries(streetParts).map(([id, part]) => {
  const node = makeButton(part.label, () => selectStreetPart(id));
  node.style.setProperty('--part-color', part.color);
  return [id, node];
});
ui['street-parts'].replaceChildren(...streetButtons.map(([, node]) => node));

function renderStreet() {
  const visible = mode === 'street';
  ui['street-controls'].hidden = !visible;
  ui.app.dataset.streetOpen = String(visible && streetOpen);
  ui.app.dataset.streetFocus = visible && streetFocus ? streetFocus : '';
  if (!visible) return;
  ui['street-toggle'].textContent = streetOpen ? '合上地面' : '打开地面';
  ui['street-toggle'].setAttribute('aria-pressed', streetOpen);
  ui['street-parts'].hidden = !streetOpen;
  ui['street-note'].hidden = !streetOpen || !streetFocus;
  ui['street-note'].textContent = streetFocus ? streetParts[streetFocus].note : '';
  for (const [id, node] of streetButtons) node.setAttribute('aria-pressed', id === streetFocus);
}

function selectStreetPart(id) {
  if (mode !== 'street') return;
  if (id) {
    streetOpen = true;
    streetFocus = streetFocus === id ? null : id;
  } else {
    streetOpen = !streetOpen;
    streetFocus = null;
  }
  throughView('setStreet', streetOpen, streetFocus);
  renderStreet();
  writeLocation(true);
}

function renderControls() {
  const profile = destinations[mode];
  ui.app.dataset.mode = mode;
  ui['scene-title'].textContent = mode === 'street' ? '街底下，\n还在运转' : profile.title;
  ui['scene-intro'].textContent = profile.intro;
  renderStreet();
  const geology = mode === 'geo';
  const usesSlider = geology || mode === 'river' || mode === 'building';
  ui['slider-panel'].hidden = !usesSlider;
  ui.controls.hidden = !usesSlider && !experiments[mode];
  ui.follow.hidden = mode !== 'river';
  ui['geo-toolbar'].hidden = ui['geo-key'].hidden = ui['geo-model-note'].hidden = !geology;
  ui['geo-measures'].hidden = ui['geo-layers'].hidden = !geology;
  ui['geo-home'].hidden = !geology;
  updateZoomButtons();
  ui['range-label'].textContent = geology ? '显露深度' : mode === 'building' ? '建筑展开度' : '剖面深度';
  const marks = geology ? ['地表', '约 15 m', '约 31 m', '约 47 m', '62 m'] :
    mode === 'building' ? ['合拢', '25%', '50%', '75%', '完全展开'] : ['江面', '10 m', '20 m', '30 m'];
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

const siteButtons = geoSites.map(site => [site.id, makeButton(site.label, () => selectGround(site.id))]);
const filterButtons = geoFilters.map(([id, label]) => [id, makeButton(label, () => selectFilter(id))]);
ui['geo-sites'].replaceChildren(...siteButtons.map(([, node]) => node));
ui['geo-filters'].replaceChildren(...filterButtons.map(([, node]) => node));

function renderGroundGuide() {
  const site = sitesById.get(ground.site);
  const entry = destinations.geo;
  ui['scene-title'].textContent = site?.label || entry.title;
  ui['scene-intro'].textContent = site ? site.question : entry.intro;
  ui['guide-heading'].textContent = site?.question || entry.question;
  ui['guide-copy'].textContent = site?.explanation
    || '沿线有六种地段。浅基础、深桩、浅埋给水和较低处的重力排水，在同一把深度尺上可以直接比较。';
  const measurements = site ? [
    [site.foundation.label, site.foundation.depth], ['给水管中心', site.pipes.supply],
    ['排水管中心', site.pipes.sewer], ['地下水位', site.water],
  ] : [['山脚浅基础', 2.6], ['港区码头桩', 48]];
  ui['geo-measures'].replaceChildren(...measurements.map(([label, value]) => {
    const measurement = document.createElement('div');
    const title = document.createElement('span');
    const depth = document.createElement('strong');
    title.textContent = label;
    depth.textContent = value + ' m';
    measurement.append(title, depth);
    return measurement;
  }));
  let top = 0;
  ui['geo-layers'].hidden = !site || ground.filter === 'pipes' || ground.filter === 'foundation';
  ui['geo-layers'].replaceChildren(...(site?.layers || []).map(layer => {
    const node = document.createElement('li');
    node.style.setProperty('--rock', layer.color);
    node.textContent = layer.label + ' · ' + top + '–' + layer.bottom + ' m';
    top = layer.bottom;
    return node;
  }));
  const source = geoSources[ground.filter] || geoSources.earth;
  ui['case-source'].hidden = false;
  [ui['case-source'].textContent, ui['case-source'].href] = source;
  ui['geo-home'].textContent = ground.site || ground.filter !== 'all' ? '回到全线' : '看地表总览';
  for (const [id, node] of siteButtons) node.setAttribute('aria-pressed', id === ground.site);
  for (const [id, node] of filterButtons) node.setAttribute('aria-pressed', id === ground.filter);
}

function changeGround(move = true) {
  throughView('setGeo', { ...ground }, move);
  refreshRange();
  renderGroundGuide();
  writeLocation(true);
}

function selectGround(id) {
  if (!sitesById.has(id)) return;
  stopTour();
  if (mode !== 'geo') enter('geo');
  ground.site = id;
  if (ground.depth < 8) ground.depth = GEO.limit;
  changeGround();
}

function selectFilter(id) {
  if (mode !== 'geo' || !groundFilters.has(id)) return;
  ground.filter = id;
  if (id === 'pipes' && !ground.site) ground.site = 'oldcity';
  if (id === 'foundation' && !ground.site) ground.site = 'harborfill';
  if (id === 'pipes') ground.depth = Math.max(ground.depth, 7);
  if (id === 'foundation') ground.depth = Math.max(ground.depth, Math.ceil(sitesById.get(ground.site).foundation.depth));
  changeGround();
}

const pumpStageButtons = Object.entries(pumpParts).map(([id, item]) => {
  const node = makeButton(item.label, () => {
    pumpStage = pumpStage === id ? null : id;
    throughView('setPumpStage', pumpStage);
    renderCase();
    writeLocation(true);
  });
  return [id, node];
});
ui['pump-stages'].replaceChildren(...pumpStageButtons.map(([, node]) => node));

function updatePumpControls() {
  inputValue(ui['pump-inflow'], ui['pump-inflow-value'], pumpSettings.inflow, '%', '进水强度 ' + pumpSettings.inflow + '%');
  ui['pump-primary'].setAttribute('aria-pressed', pumpSettings.primary);
  ui['pump-primary'].textContent = pumpSettings.primary ? '主泵运行' : '主泵已停';
  ui['pump-auto'].setAttribute('aria-pressed', pumpSettings.automatic);
  ui['pump-auto'].textContent = pumpSettings.automatic ? '备用自动' : '备用关闭';
  for (const [id, node] of pumpStageButtons) node.setAttribute('aria-pressed', id === pumpStage);
}

function pumpFrame(dt) {
  pumpSettings.power = level;
  const results = pumpRun.step(dt, pumpSettings, pumpStage);
  throughView('setPump', results);
  const percentage = Math.round(results.level * 100);
  if (Number(ui['pump-water'].value) !== percentage) {
    ui['pump-water'].value = percentage;
    ui['pump-height'].value = percentage + '%';
  }
  const alarm = String(results.alarm);
  if (ui['pump-meter'].dataset.alarm !== alarm) ui['pump-meter'].dataset.alarm = alarm;
  const states = results.alarm ? '高水位警报' : '水位正常';
  const status = (results.main ? '主泵运行' : '主泵停转') + ' · '
    + (results.backup ? '备用泵已接管' : pumpSettings.automatic ? '备用待命' : '备用关闭') + ' · ' + states;
  if (ui['pump-indicators'].textContent !== status) ui['pump-indicators'].textContent = status;
}

function resetAngle() {
  ui.angle.setAttribute('aria-pressed', 'false');
  ui.angle.textContent = '俯瞰';
}

function updateZoomButtons() {
  const usable = typeof activeView?.adapter.zoom === 'function' && !(mode === 'geo' && activeView.kind === 'map');
  ui['zoom-in'].hidden = ui['zoom-out'].hidden = !usable;
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
  const rawInflow = url.searchParams.get('inflow');
  const inflow = rawInflow === null ? pumpDefaults.inflow : Number(rawInflow);
  const stage = url.searchParams.get('pump');
  const requestedSite = url.searchParams.get('site');
  const requestedFilter = url.searchParams.get('layer');
  const rawGround = url.searchParams.get('ground');
  const requestedPart = url.searchParams.get('part');
  const isMap = url.searchParams.get('view') === 'map';
  const route = discovery?.mode || (Object.hasOwn(destinations, request) ? request : isMap ? 'geo' : 'street');
  return {
    mode: route,
    caseId: discovery ? found : undefined,
    level: Number.isFinite(numeric) ? clamp(numeric, 0, 100) : discovery?.initial,
    format: isMap && route !== 'street' ? 'map' : undefined,
    streetOpen: url.searchParams.get('open') === '1',
    streetFocus: Object.hasOwn(streetParts, requestedPart) ? requestedPart : null,
    pump: {
      inflow: Number.isFinite(inflow) ? clamp(inflow, 0, 100) : pumpDefaults.inflow,
      primary: url.searchParams.get('main') !== 'off',
      automatic: url.searchParams.get('backup') !== 'off',
    },
    stage: Object.hasOwn(pumpParts, stage) ? stage : null,
    ground: {
      site: sitesById.has(requestedSite) ? requestedSite : null,
      filter: groundFilters.has(requestedFilter) ? requestedFilter : 'all',
      depth: rawGround !== null && Number.isFinite(Number(rawGround)) ? clamp(Number(rawGround), 0, GEO.limit) : GEO.limit,
    },
  };
}

function link() {
  const url = new URL(location.pathname, location.origin);
  url.hash = mode;
  if (caseId) {
    url.searchParams.set('case', caseId);
    url.searchParams.set('level', String(level));
  }
  if (caseId === 'pump') {
    if (pumpSettings.inflow !== pumpDefaults.inflow) url.searchParams.set('inflow', String(pumpSettings.inflow));
    if (!pumpSettings.primary) url.searchParams.set('main', 'off');
    if (!pumpSettings.automatic) url.searchParams.set('backup', 'off');
    if (pumpStage) url.searchParams.set('pump', pumpStage);
  }
  if (mode === 'geo') {
    if (ground.site) url.searchParams.set('site', ground.site);
    if (ground.filter !== 'all') url.searchParams.set('layer', ground.filter);
    if (ground.depth !== GEO.limit) url.searchParams.set('ground', String(ground.depth));
  }
  if (mode === 'street' && streetOpen) {
    url.searchParams.set('open', '1');
    if (streetFocus) url.searchParams.set('part', streetFocus);
  }
  if (mode !== 'street' && pinnedFormat === 'map') url.searchParams.set('view', 'map');
  return url;
}

function writeLocation(replace = false) {
  const url = link();
  if (url.href !== location.href) history[replace ? 'replaceState' : 'pushState'](null, '', url);
}

function closeCase() {
  caseId = undefined;
  pumpStage = null;
  throughView('setDiscover', null, 0);
  renderCase();
  writeLocation(true);
}

function applyStateToView(adapter, immediate) {
  if (mode === 'street') {
    adapter.setStreet(streetOpen, streetFocus, immediate);
    adapter.setNight(streetNight);
    return;
  }
  adapter.setMode(mode, immediate);
  adapter.setDepth(depth);
  adapter.setExpansion(expansion);
  adapter.setNight(night);
  adapter.setSunset?.(sunset && !night);
  if (mode === 'geo') adapter.setGeo?.({ ...ground }, true, immediate);
  adapter.setExperiment(mode, Boolean(activeExperiments.get(mode)));
  adapter.setGarden?.(garden);
  adapter.selectPart?.(selected, false);
  adapter.setDiscover(caseId || null, level, Boolean(caseId));
  if (caseId === 'pump' && pumpStage) adapter.setPumpStage?.(pumpStage);
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
  const variant = mode === 'street' ? 'street' : 'coast';
  if (activeView?.variant === variant) applyStateToView(activeView.adapter, immediate);
  renderControls();
  renderLight(false);
  if (!immediate && (sceneChanged || !activeView) && activeView?.variant !== variant) mount(pinnedFormat || '3d');
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
  if (id === 'pump') {
    Object.assign(pumpSettings, pumpDefaults);
    pumpRun.reset();
    pumpStage = null;
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
  ui.sunset.hidden = typeof activeView?.adapter.setSunset !== 'function';
  resetAngle();
  updateZoomButtons();
  ui['render-note'].hidden = !reason;
  ui['render-note'].textContent = reason;
  refreshExperiment();
}

async function mount(kind, note = '') {
  const edition = ++pendingVersion;
  const variant = mode === 'street' ? 'street' : 'coast';
  if (variant === 'street') kind = '3d';
  if (activeView?.variant !== variant) {
    activeView?.adapter.destroy();
    activeView?.layer.remove();
    activeView = undefined;
  }
  ui['retry-3d'].hidden = true;
  if (activeView?.kind === kind) {
    setFormatUI(kind, note);
    return;
  }
  const layer = document.createElement('div');
  layer.className = 'renderer-layer';
  layer.style.visibility = 'hidden';
  ui.viewport.append(layer);
  ui.loading.hidden = Boolean(activeView);
  ui.loading.textContent = variant === 'street' ? '正在打开 3D 街景…' :
    kind === '3d' ? '正在搭建海湾城市…' : '正在绘制互动地图…';
  if (variant === 'street') ui['street-controls'].hidden = true;
  let adapter;
  try {
    const options = {
      onNavigate: navigate,
      onFeature: selectPart,
      onGeoSite: selectGround,
      onGeoFilter: selectFilter,
      onStreetPart: selectStreetPart,
      onInteract,
      onStatus(text) { if (activeView?.layer === layer) ui['view-status'].textContent = text; },
      onError(error) {
        if (activeView?.layer !== layer) return;
        console.error(error);
        if (variant === 'street') {
          activeView = undefined;
          adapter.destroy();
          layer.remove();
          showStreetFailure();
          return;
        }
        mount('map', failureCopy[error.code] || failureCopy['render-failed']);
      },
    };
    if (variant === 'street') {
      const { createStreet3D } = await import('./street-3d.js?v=20261120.8');
      if (edition !== pendingVersion) { layer.remove(); return; }
      adapter = createStreet3D(layer, options);
    } else if (kind === '3d') {
      const { createCoast3D } = await import('./coast-3d.js?v=20261120.8');
      if (edition !== pendingVersion) { layer.remove(); return; }
      adapter = createCoast3D(layer, options);
    } else {
      const { createCoastMap } = await import('./coast-map.js?v=20261120.7');
      if (edition !== pendingVersion) { layer.remove(); return; }
      adapter = createCoastMap(layer, options);
    }
    applyStateToView(adapter, true);
    const previous = activeView;
    activeView = { adapter, layer, kind, variant };
    layer.style.visibility = '';
    previous?.adapter.destroy();
    previous?.layer.remove();
    ui['view-status'].textContent = '';
    setFormatUI(kind, note);
    adapter.start?.();
    ui.loading.hidden = true;
    if (variant === 'street') renderStreet();
  } catch (error) {
    adapter?.destroy();
    layer.remove();
    if (edition !== pendingVersion) return;
    console.error(error);
    if (variant === 'street') {
      if (activeView?.layer === layer) activeView = undefined;
      showStreetFailure();
      return;
    }
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

function showStreetFailure() {
  ui.loading.textContent = '这个浏览器暂时没能打开 3D 街景。';
  ui.loading.hidden = false;
  ui['retry-3d'].hidden = false;
  ui['street-controls'].hidden = true;
  ui.angle.hidden = true;
  updateZoomButtons();
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
  const oldMode = mode;
  pinnedFormat = state.format;
  Object.assign(pumpSettings, pumpDefaults, state.pump);
  pumpStage = state.stage;
  pumpRun.reset();
  Object.assign(ground, state.ground);
  streetOpen = state.streetOpen;
  streetFocus = streetOpen ? state.streetFocus : null;
  enter(state.mode, state.caseId, state.level);
  if (oldMode !== 'street' && state.mode !== 'street' &&
      state.format !== oldFormat && activeView?.kind !== (state.format || '3d')) mount(state.format || '3d');
}
window.addEventListener('hashchange', refreshLocation);
window.addEventListener('popstate', refreshLocation);

for (const node of nav) node.addEventListener('click', () => navigate(node.dataset.route));
for (const node of choices) node.addEventListener('click', () => chooseCase(node.dataset.case));
function changeCaseLevel(value) {
  if (!caseId) return;
  level = clamp(Number(value), 0, 100);
  throughView('setDiscover', caseId, level, false);
  renderCase();
  writeLocation(true);
}
ui['case-level'].addEventListener('input', () => changeCaseLevel(ui['case-level'].value));
function revisePump(settings) {
  if (caseId !== 'pump') return;
  Object.assign(pumpSettings, settings);
  renderCase();
  writeLocation(true);
}
ui['pump-inflow'].addEventListener('input', () => revisePump({ inflow: clamp(Number(ui['pump-inflow'].value), 0, 100) }));
ui['pump-storm'].addEventListener('click', () => revisePump({ inflow: pumpSettings.inflow === 95 ? 55 : 95 }));
ui['pump-primary'].addEventListener('click', () => revisePump({ primary: !pumpSettings.primary }));
ui['pump-auto'].addEventListener('click', () => revisePump({ automatic: !pumpSettings.automatic }));
ui['pump-reset'].addEventListener('click', () => {
  pumpRun.reset();
  pumpStage = null;
  throughView('setPumpStage', null);
  revisePump(pumpDefaults);
  changeCaseLevel(pumpDefaults.power);
});
ui.depth.addEventListener('input', () => {
  stopTour();
  const value = Number(ui.depth.value);
  if (mode === 'geo') {
    ground.depth = clamp(value, 0, GEO.limit);
    changeGround(false);
  } else if (mode === 'building') setExpansion(value);
  else setDepth(value);
});
ui['geo-home'].addEventListener('click', () => {
  if (!ground.site && ground.filter === 'all') return navigate('atlas');
  Object.assign(ground, { site: null, depth: GEO.limit, filter: 'all' });
  changeGround();
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
function renderLight(updateView = true) {
  const street = mode === 'street';
  const isNight = street ? streetNight : night;
  ui.app.dataset.night = String(isNight);
  ui.app.dataset.sunset = String(sunset && !night);
  ui.night.textContent = isNight ? (street ? '日景' : '结束夜景') : '夜景';
  ui.sunset.textContent = sunset && !night ? '日景' : '夕照';
  ui.night.setAttribute('aria-pressed', isNight);
  ui.sunset.setAttribute('aria-pressed', sunset && !night);
  if (updateView) {
    throughView('setNight', isNight);
    throughView('setSunset', sunset && !night);
  }
}
ui.night.addEventListener('click', () => {
  if (mode === 'street') streetNight = !streetNight;
  else night = !night;
  renderLight();
});
ui['street-toggle'].addEventListener('click', () => selectStreetPart(null));
ui['retry-3d'].addEventListener('click', () => mount('3d'));
ui.sunset.addEventListener('click', () => {
  sunset = night || !sunset;
  night = false;
  renderLight();
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
ui['reset-view'].addEventListener('click', () => {
  onInteract();
  resetAngle();
  if (mode === 'geo' && activeView?.kind === 'map' && ground.site) ui['geo-home'].click();
  else throughView('resetView');
});
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

function playback(now) {
  playbackId = requestAnimationFrame(playback);
  const dt = playbackTime && !document.hidden ? (now - playbackTime) / 1000 : 0;
  playbackTime = now;
  if (caseId === 'pump') pumpFrame(dt);
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
Object.assign(ground, initial.ground);
Object.assign(pumpSettings, initial.pump);
pumpStage = initial.stage;
streetOpen = initial.streetOpen;
streetFocus = streetOpen ? initial.streetFocus : null;
enter(initial.mode, initial.caseId, initial.level, { immediate: true });
mount(pinnedFormat || '3d');
playbackId = requestAnimationFrame(playback);
