export const GEO = { limit: 62, exaggeration: 1.45, front: 132 };

const materials = {
  topsoil: { color: '#8c704b', label: '表土' },
  fill: { color: '#c49558', label: '人工填土' },
  cobble: { color: '#9b854e', label: '砾石层' },
  silt: { color: '#72695c', label: '粉土与细砂' },
  mud: { color: '#585969', label: '软黏土' },
  sand: { color: '#a89069', label: '砂层' },
  gravel: { color: '#8c785f', label: '密实砂砾' },
  weathered: { color: '#9c7059', label: '风化岩' },
  granite: { color: '#726678', label: '花岗岩基岩' },
  bedrock: { color: '#525b73', label: '基岩' },
  reef: { color: '#9a7058', label: '层状砂岩' },
};

const layer = (key, bottom) => ({ ...materials[key], key, bottom });

export const geoSites = [
  {
    id: 'mountain', label: '山脚基岩', x: -279, min: -334, max: -224,
    layers: [layer('topsoil', 2), layer('weathered', 10), layer('granite', GEO.limit)],
    water: 12, foundation: { type: 'pad', label: '岩面浅基础', depth: 2.6 },
    pipes: { supply: 1.2, sewer: 2.8 },
    question: '山脚已经挨着石头了，还要打桩吗？',
    explanation: '在这个模型里，浅基础落在较浅的风化岩上。岩面、裂隙和承载条件还要靠勘察确认，岩石露得近也不能单凭外观决定基础。',
  },
  {
    id: 'valley', label: '河谷农田', x: -170, min: -224, max: -116,
    layers: [layer('topsoil', 1.6), layer('silt', 9), layer('sand', 20), layer('gravel', 34), layer('bedrock', GEO.limit)],
    water: 4.9, foundation: { type: 'strip', label: '村屋条形基础', depth: 1.6 },
    pipes: { supply: 1.05, sewer: 2.2 },
    question: '耕地下面，先是泥还是碎石？',
    explanation: '流水在谷地沉积时，较粗和较细的材料会分开。这里把表土、粉土、砂和砂砾画成不同层，蓝线示意水位，水主要含在孔隙里。',
  },
  {
    id: 'oldcity', label: '老城街区', x: -55, min: -116, max: 0,
    layers: [layer('fill', 3.4), layer('mud', 13), layer('sand', 22), layer('gravel', 32), layer('bedrock', GEO.limit)],
    water: 6.1, foundation: { type: 'pile', label: '街区桩基', depth: 26 },
    pipes: { supply: 1.4, sewer: 3.2 },
    question: '为什么水管上面还有一层被挖过的土？',
    explanation: '打开管线，找管底的垫层、四周和上方的回填，以及通到地面的阀井。给水管承压送水，这条重力排水管则沿坡度向低处走。',
  },
  {
    id: 'riverbank', label: '临江软土', x: 56, min: 0, max: 112,
    layers: [layer('fill', 3.1), layer('mud', 22), layer('sand', 32), layer('gravel', 47), layer('bedrock', GEO.limit)],
    water: 2.8, foundation: { type: 'pile', label: '临江建筑桩基', depth: 40 },
    pipes: { supply: 1.8, sewer: 4.2 },
    question: '临江的楼，下面很厚的一层软土怎么办？',
    explanation: '这个模型把桩画成穿过淤泥质软土，进入更深的密实层。桩可以通过桩侧和桩端传力，长度取决于实际地层、荷载与沉降要求。',
  },
  {
    id: 'harborfill', label: '港区回填', x: 168, min: 112, max: 224,
    layers: [layer('fill', 7), layer('mud', 27), layer('sand', 40), layer('gravel', 53), layer('bedrock', GEO.limit)],
    water: 1.5, foundation: { type: 'pile', label: '码头排架桩', depth: 48 },
    pipes: { supply: 2.0, sewer: 5.4 },
    question: '码头地面很平，脚底下为什么还要一排桩？',
    explanation: '港区示意中，上部整平靠回填，码头通过排架和桩把荷载传下去。图中的人工填土和旧海底软土有明显的分界。',
  },
  {
    id: 'rockcoast', label: '外海断崖', x: 279, min: 224, max: 334,
    layers: [layer('weathered', 4.3), layer('reef', 24), layer('weathered', 31), layer('reef', 48), layer('bedrock', GEO.limit)],
    water: 9.0, foundation: { type: 'socket', label: '示意入岩短桩', depth: 7.4 },
    pipes: { supply: 1.9, sewer: 3.0 },
    question: '同样是海边，崖顶和软泥滩的脚下差在哪？',
    explanation: '这里能看见连续岩层和较薄的风化带，旁边港区则是较厚的回填和软黏土。同一座海湾内，基础和管线也要按地段考虑。',
  },
];

export const geoFilters = [
  ['all', '全部'], ['earth', '岩土与地下水'], ['foundation', '基础'], ['pipes', '给水与排水'],
];

export const geoSources = {
  earth: ['美国地质调查局 · 地下水与沉积层', 'https://pubs.usgs.gov/circ/2003/circ1262/index.html'],
  foundation: ['美国联邦公路管理局 · 基础与桩', 'https://www.fhwa.dot.gov/engineering/geotech/foundations/'],
  pipes: ['西雅图公共事业局 · 给水管沟与回填', 'https://www.seattle.gov/documents/departments/spu/construction-resources/standards-guidelines/dsg/2024/5waterinfrastructurefinalredacted.pdf'],
};
