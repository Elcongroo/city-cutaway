# 切开城市 · City Cutaway

[地底全景](https://elcongroo.github.io/city-cutaway/#geo) · [地图模式](https://elcongroo.github.io/city-cutaway/?view=map#geo) · [地表总览](https://elcongroo.github.io/city-cutaway/#atlas)

首屏是一条沿虚构海湾展开的地底长剖面。山脚基岩、河谷农田、老城街区、临江软土、港区回填与外海断崖共用一把深度尺。可向下显露到 62 米，再分别查看岩土与地下水、基础、给水与重力排水。

- [老城管沟](https://elcongroo.github.io/city-cutaway/?site=oldcity&layer=pipes#geo)展示给水管、颗粒垫层、回填土、阀井和较低处的重力排水。
- [港区基础](https://elcongroo.github.io/city-cutaway/?site=harborfill&layer=foundation#geo)可对照回填、软黏土与长桩，再切回山脚对比浅基础。
- 地表可继续巡游峡谷水库、城中湖、潮滩和外海海蚀拱。[泵站](https://elcongroo.github.io/city-cutaway/?case=pump&level=25#river)、[船闸](https://elcongroo.github.io/city-cutaway/?case=lock&level=16#lock)与[潮滩](https://elcongroo.github.io/city-cutaway/?case=tide&level=15#tide)可在地图或 3D 中操作。

模型纵向放大 1.45 倍。各处尺寸、地层和埋深用于比较。管线深度从模型地表量到管中心，基础量到基底或桩尖。分享链接可保留地段、显示内容与显露深度。

## 本地运行

用静态文件服务器托管项目根目录。例如运行 `python -m http.server 8080` 后打开 `http://localhost:8080`。3D 使用随源码提供的 Three.js，许可证见 [vendor/THREE-LICENSE.txt](vendor/THREE-LICENSE.txt)。WebGL 2 无法运行时会切换到 Canvas 互动地图。

参考：[地下水与沉积层](https://pubs.usgs.gov/circ/2003/circ1262/index.html)、[基础与桩](https://www.fhwa.dot.gov/engineering/geotech/foundations/)、[给水管沟与回填](https://www.seattle.gov/documents/departments/spu/construction-resources/standards-guidelines/dsg/2024/5waterinfrastructurefinalredacted.pdf)。
