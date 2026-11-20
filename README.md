# 切开城市 · City Cutaway

[在线体验](https://elcongroo.github.io/city-cutaway/)

同一个连续的 3D 海湾城市。从西侧山谷沿河飞过农田、城中湖和两岸城区，直到东侧入海港。所有地点都由同一台镜头进入或离开，地形、楼宇、道路、车辆和船只留在它们原来的位置。

- [江底剖面](https://elcongroo.github.io/city-cutaway/#river)可以逐层打开综合管线、双层地下停车场、跨江双线地铁和道路隧道。用深度滑块观察这些设施各自的高度，或跟拍一列地铁。
- [建筑拆解](https://elcongroo.github.io/city-cutaway/#building)可以在原地展开一栋临街楼，查看屋顶、沿街商铺、住宅、楼梯电梯与基础。
- 沿江巡游依次飞往不同区域。夜景可观察街道、楼宇和港区灯光。各地区还提供山路、灌溉、河湖连接、降雨花园及港区运输演示。

松开视角后可用滚轮或双指捏合缩放，拖动可旋转。聚焦画面后可按方向键旋转，加减键缩放，Home 重置。深度和建筑展开度支持键盘操作。

## 本地运行

使用静态文件服务器托管项目根目录。例如，已安装 Python 时，运行 `python -m http.server 8080` 后打开 `http://localhost:8080`。页面需要支持 WebGL 2 的浏览器。Three.js 随源码提供，许可证见 [vendor/THREE-LICENSE.txt](vendor/THREE-LICENSE.txt)。

这是虚构海湾地区，地形、建筑、路径与深度均为示意。大场景参考不同滨水地区里可步行的岸线、码头与城市设施如何交织。[上海市政府 · 杨浦滨江的工业遗存与步道](https://english.shanghai.gov.cn/en-CityTour/20250325/100ec92cb0ba4c36b24c5af1d2564715.html)
