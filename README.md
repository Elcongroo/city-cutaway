# 切开城市 · City Cutaway

[在线体验](https://elcongroo.github.io/city-cutaway/) · [互动地图模式](https://elcongroo.github.io/city-cutaway/?view=map)

从西侧山谷沿河飞过农田、城中湖、两岸城区和北岸新城，再到入海港和外海航道。所有地点共用一片连续地形。剖切都在原来的位置发生。

- [江底剖面](https://elcongroo.github.io/city-cutaway/#river)包含管线、双层车库、跨江双线地铁和道路隧道。
- [建筑拆解](https://elcongroo.github.io/city-cutaway/#building)可以原地展开一栋临街楼。
- 「看不见的城市」有[隧道排水](https://elcongroo.github.io/city-cutaway/?case=pump&level=25#river)、[隧道通风](https://elcongroo.github.io/city-cutaway/?case=air&level=35#river)和[结构传力](https://elcongroo.github.io/city-cutaway/?case=load&level=45#building)三项实验。复制实验链接会保存当前参数。
- 支持沿江巡游、夜景、视角切换、双指或滚轮缩放、跟拍和降雨。浏览器无法启动或维持 WebGL 2 时自动使用 Canvas 互动地图，可用画面上的按钮重新尝试 3D。

## 本地运行

用静态文件服务器托管项目根目录。例如运行 `python -m http.server 8080` 后打开 `http://localhost:8080`。3D 模式需要 WebGL 2，地图模式只需 Canvas 2D。Three.js 随源码提供，许可证见 [vendor/THREE-LICENSE.txt](vendor/THREE-LICENSE.txt)。

场景、设施尺寸、效果和实验数值均为简化示意。参考资料包括[美国联邦公路管理局道路隧道手册](https://www.fhwa.dot.gov/bridge/tunnel/pubs/nhi09010/tunnel_manual.pdf)、[加州大学伯克利分校结构工程讲义](https://www.ocf.berkeley.edu/~chiep/wp-content/uploads/2024/01/CE-120-Structural-Engineering-Reader.pdf)及[上海杨浦滨江的公开介绍](https://english.shanghai.gov.cn/en-CityTour/20250325/100ec92cb0ba4c36b24c5af1d2564715.html)。
