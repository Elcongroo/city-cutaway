# 切开城市 · City Cutaway

[在线体验](https://elcongroo.github.io/city-cutaway/) · [互动地图模式](https://elcongroo.github.io/city-cutaway/?view=map)

从西侧峡谷水库沿船闸、农田、城中湖和两岸城区飞向入海港、潮滩及外海断崖。地点共用一片连续地形。海蚀拱、跨江地铁和可拆解的住宅都在原地。

- [泵站实验](https://elcongroo.github.io/city-cutaway/?case=pump&level=25#river)可以调节进水和主泵，开关备用自动，观察集水井、警报及单向阀。可按进水沟、集水井、泵和出水管逐个观察。
- [船闸实验](https://elcongroo.github.io/city-cutaway/?case=lock&level=16#lock)可以分步观察小船从较低的水面驶入、关闸、上升并离开。
- [潮滩实验](https://elcongroo.github.io/city-cutaway/?case=tide&level=15#tide)展示潮沟、泥滩、觅食水鸟和上涨的水面。
- [通风](https://elcongroo.github.io/city-cutaway/?case=air&level=35#river)和[结构传力](https://elcongroo.github.io/city-cutaway/?case=load&level=45#building)同样可操作。复制实验链接可保留输入参数。泵站链接会按链接中的设置重新开始一次模拟。

支持连续巡游、日景、夕照、夜景、俯瞰、滚轮或双指缩放、地铁跟拍和降雨。WebGL 2 无法运行时会切换到 Canvas 互动地图。

## 本地运行

用静态文件服务器托管项目根目录。例如运行 `python -m http.server 8080` 后打开 `http://localhost:8080`。3D 使用随源码提供的 Three.js，许可证见 [vendor/THREE-LICENSE.txt](vendor/THREE-LICENSE.txt)。

地形、设施尺寸与实验数值为简化示意。资料入口附在各实验与地貌介绍中：[道路隧道手册](https://www.fhwa.dot.gov/bridge/tunnel/pubs/nhi09010/tunnel_manual.pdf)、[船闸运作](https://www.swt.usace.army.mil/Missions/Navigation/Locking.aspx)、[潮间带](https://oceanservice.noaa.gov/facts/intertidal-zone.html)与[岩质海岸地貌](https://home.nps.gov/articles/rocky-coast-landforms.htm)。
