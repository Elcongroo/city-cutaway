# 切开城市 · City Cutaway

[在线体验](https://elcongroo.github.io/city-cutaway/)

从一张连续的 3D 区域地图出发，进入平原城区、河湾城区、山地城镇和农田村落。点模型标签看街道、建筑、水路和田地怎样适应地形。

- **平原城区**可逐层打开地面，跟拍地铁，并用降雨和雨水花园查看径流变化。
- **河湾城区**可模拟涨水，观察河滩、桥梁、较高街面与地下调蓄空间。
- **山地城镇**可点亮上山步行路线，观察台阶、平台和跨高差电梯。
- **农田村落**可开启灌溉，沿主渠、支渠与田沟追踪水路。
- **建筑拆解**可拖动滑块打开一栋临街混合用途楼，查看屋顶、住宅、楼梯与电梯、商铺和基础。

拖动旋转，滚轮或双指捏合缩放。聚焦模型后，方向键旋转，加减键缩放，Home 重置。深度与拆解滑块可用键盘调整。各场景可以通过 URL 的片段直接分享。

## 本地运行

用静态文件服务器托管项目根目录。例如，已安装 Python 时，运行 `python -m http.server 8080` 后访问 `http://localhost:8080`。页面需要支持 WebGL 2 的浏览器。Three.js 随源码提供，许可证见 [vendor/THREE-LICENSE.txt](vendor/THREE-LICENSE.txt)。

## 模型与案例

场景、尺寸与水流均为简化示意。河湾、山城与村落的原理介绍参考公开资料：

- [美国环保署 · 洪泛区与绿色基础设施](https://www.epa.gov/system/files/documents/2023-09/wpd-land-use-and-green-infrastructure-scorecard_508_0.pdf)
- [香港路政署 · 上坡地区自动扶梯及升降机系统](https://www.hyd.gov.hk/en/our_projects/walkability_projects/HEL/)
- [联合国粮农组织 · 灌溉水源与重力输水](https://www.fao.org/4/U5835E/u5835e03.htm)
