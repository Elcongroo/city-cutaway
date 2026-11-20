# 切开城市 · City Cutaway

[在线体验](https://elcongroo.github.io/city-cutaway/)

拖动深度滑块，把一段虚构街区剖开。从街面、排水管到地铁隧道和基岩，可以逐层查看。点击「跟拍地铁」沿隧道观察列车；点击「开始下雨」查看雨水流向，再启用「雨水花园」重放同一场演示。

在画面上拖动可旋转，使用滚轮或双指捏合可缩放。键盘可聚焦深度滑块，再用方向键调整深度。

## 本地运行

用任意静态文件服务器托管项目根目录。例如，已安装 Python 时，可在仓库根目录运行 `python -m http.server 8080`，然后访问 `http://localhost:8080`。页面需要支持 WebGL 2 的浏览器。

模型、深度和雨水流向为交互演示。页面使用本地 Three.js 模块。Three.js 许可证位于 [vendor/THREE-LICENSE.txt](vendor/THREE-LICENSE.txt)。
