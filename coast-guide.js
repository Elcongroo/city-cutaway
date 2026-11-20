export const destinations = {
  atlas: {
    label: '全域总览',
    title: '从山谷到海港',
    intro: '沿着一条河飞过农田、湖泊和两岸城区，再从江面潜入城市的地下。',
    focus: [0, 5, 2], span: 274, yaw: 0.34, pitch: 0.53, accent: '#d0edce',
    question: '一条河能串起什么？',
    detail: '山谷来水穿过农田和两岸城区，接上城中湖，最后汇入海湾。点画面上的地点，镜头会沿着这片地形飞过去。',
  },
  hill: {
    label: '山谷',
    title: '山坡就是街道的骨架',
    intro: '顺着坡面看不同高度的街道，找出从山脚到聚落的路。',
    focus: [-84, 11, -34], span: 99, yaw: 0.27, pitch: 0.57, accent: '#f4d79d',
    question: '山坡上怎么给房子找平地？',
    detail: '道路顺坡迂回，街坊落在地势较平的平台。沿同一条路往低处走，山地聚落就接上了谷地和河流。',
  },
  rural: {
    label: '河谷农田',
    title: '村道尽头就是田',
    intro: '家门、村道、水渠和田块在谷地里各有位置。',
    focus: [-78, 1, 42], span: 91, yaw: 0.33, pitch: 0.62, accent: '#d7eca6',
    question: '一条水渠怎么把田连起来？',
    detail: '干渠顺着谷地送水，小沟再分到不同田块。房屋靠村道集中，田埂把耕地和步行路线分开。',
  },
  lake: {
    label: '城中湖',
    title: '在楼群里留下一片水面',
    intro: '湖、绿岸和连接主河的水路，嵌在两旁街区之间。',
    focus: [27, 2, -41], span: 92, yaw: 0.20, pitch: 0.60, accent: '#9ae1e5',
    question: '湖岸为什么既有绿地也有街道？',
    detail: '水边的缓坡给湖面留出过渡，也让人能沿岸步行。河湖连接处的水路从楼群之间穿过。',
  },
  plain: {
    label: '两岸城区',
    title: '两岸，一座城',
    intro: '看街道通向桥头、地铁口和临街建筑。江的两边其实是一座城。',
    focus: [-11, 7, 5], span: 137, yaw: 0.42, pitch: 0.49, accent: '#fad09a',
    question: '两岸的街区怎么接起来？',
    detail: '桥把车和人带到对岸，桥头又接入城市路网。往下一层，地铁和道路隧道也从这片江面下穿过。',
  },
  river: {
    label: '江底剖面',
    title: '从江面向下，看三层交通',
    intro: '剖开两岸地层，跟着车和列车，看它们如何共享同一个过江走廊。',
    focus: [2, -3.8, 20], span: 118, yaw: 0.80, pitch: 0.55, accent: '#a9e4ff',
    question: '为什么不把所有交通都放在一层？',
    detail: '停车场靠近街面，方便从坡道进出。地铁和道路隧道各走一层，江面仍给船只通行。',
  },
  harbor: {
    label: '入海港湾',
    title: '城市的路在这里接上海',
    intro: '河口打开，水面变宽。看集装箱、起重机、码头公路和船怎样接力。',
    focus: [77, 2, 39], span: 106, yaw: 0.38, pitch: 0.57, accent: '#a6dff5',
    question: '港口为什么需要长长的岸线？',
    detail: '船靠岸以后，吊机在码头卸货，箱子先进入堆场，再从港区道路进入城市交通网。港池给船留出掉头和靠泊的空间。',
  },
  building: {
    label: '建筑拆解',
    title: '就在这条街上，拆开一栋楼',
    intro: '拖动展开度，屋顶、楼层、地基拉开，旁边的街道仍在原位。',
    focus: [-34, 7.2, -27], span: 33, yaw: 0.39, pitch: 0.33, accent: '#ffce94',
    question: '我们每天进出的一栋楼，怎么叠起来？',
    detail: '楼下是沿街商铺，楼上是住宅。电梯、楼梯和立管把这些空间竖向串在一起。',
  },
};

export const underground = {
  utilities: { label: '管线', depth: 5, color: '#79ccff', question: '地面下第一层藏着什么？', detail: '靠近街道的空间常留给排水等市政管线。让它们有检修入口，维护时就能尽量少影响地面交通。' },
  parking: { label: '地下车库', depth: 12, color: '#b6a2ff', question: '车怎么从街面开进地下？', detail: '坡道把街面与车库相连，车位顺着行车通道布置。车库在岸侧，车辆通过坡道回到原来的路网。' },
  metro: { label: '过江地铁', depth: 16, color: '#46e6c9', question: '从哪儿上车，又怎么过江？', detail: '人在两岸的站点下到站台，列车进入封闭隧道从江底穿过。站台需要更宽的空间，区间隧道主要留给列车。' },
  tunnel: { label: '道路隧道', depth: 26, color: '#ffc77b', question: '汽车是在哪儿钻进江底的？', detail: '道路从岸侧坡道下沉，过江以后再升回街面。剖面保留了车流方向，让它和上方的轨道、车库能同时被看见。' },
};

export const buildingParts = {
  roof: { label: '屋顶', question: '雨落到屋顶之后去哪？', detail: '小坡度把屋顶雨水引向排水点，立管接到下方。在同一个屋面还能布置通风设备和太阳能板。' },
  homes: { label: '住宅楼层', question: '上下几层为什么常有竖直对齐的房间？', detail: '厨房和卫生间靠近竖向管道，有利于集中布置给排水。户型本身还有按居住需求分隔的空间。' },
  core: { label: '楼梯与电梯', question: '每天回家时，怎么从街道走到楼上？', detail: '楼梯和电梯组成一条竖直的公共通道。无论在哪一层，都从同一处进入走廊。' },
  shops: { label: '街面商铺', question: '为什么商铺大多开在一楼？', detail: '行人能直接从人行道进店。一层留出连续的临街面和较开敞的店内空间。' },
  foundation: { label: '基础', question: '整栋楼的重量最后落在哪？', detail: '梁、柱和承重墙把重量逐层向下传，基础把力传给更大的地面范围。' },
};

export const tourStops = ['hill', 'rural', 'lake', 'plain', 'river', 'harbor'];

export const experiments = {
  hill: { play: '点亮山路', stop: '隐藏山路', note: '沿亮线看山路如何转弯爬坡' },
  rural: { play: '追踪灌溉水路', stop: '停止追踪', note: '水从干渠转入田间支沟' },
  lake: { play: '追踪河湖水路', stop: '停止追踪', note: '亮线沿水路汇入城中湖' },
  plain: { play: '开始下雨', stop: '停止下雨', note: '雨水沿南岸街面流向低处' },
  harbor: { play: '追踪港区运输', stop: '停止追踪', note: '从港区道路一直看到货物上船' },
};
