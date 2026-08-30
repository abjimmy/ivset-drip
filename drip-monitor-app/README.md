# 滴准（Drip Lens）

一个移动优先的滴速视觉监测原型。它使用摄像头或本地视频，在设备本机逐帧分析用户框选的滴嘴—液面区域，并根据运动峰值之间的时间间隔估计滴/分。

面向安装人员和普通用户的完整说明见 [安装与使用手册](./INSTALL_GUIDE.md)，App 内也可从“设置 → 安装与使用手册”打开图文版。

## 当前可运行能力

- 后置摄像头实时预览（`getUserMedia`）
- 可拖动、可缩放的滴液识别区域
- 自适应背景噪声校准与运动峰值检测
- 最近多滴中位间隔、滴/分、稳定度和置信度
- 补光灯控制（仅在设备浏览器暴露 `torch` 能力时启用）
- 内置真实滴管视频与本地视频测试模式
- 0.5×、1×、1.5×、2× 测试视频倍速验证
- PWA manifest、Service Worker 与离线缓存
- 所有画面计算都在本机完成，不上传视频帧

## 本地运行

在仓库根目录启动静态服务器：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

打开：

- App：`http://127.0.0.1:4173/drip-monitor-app/`
- 摄像头直达并自动监测：`http://127.0.0.1:4173/drip-monitor-app/?source=camera&autostart=1`
- 自动载入测试视频：`http://127.0.0.1:4173/drip-monitor-app/?source=test`

摄像头 API 需要 HTTPS 安全上下文；`localhost` / `127.0.0.1` 可用于同机开发，但通过局域网 IP 在手机上访问时应配置 HTTPS。

## GitHub Pages 已部署地址

- 电脑滴液演示：`https://abjimmy.github.io/ivset-drip/`
- 手机摄像头检测（短链接）：`https://abjimmy.github.io/ivset-drip/camera.html`
- 手机摄像头检测（完整链接）：`https://abjimmy.github.io/ivset-drip/drip-monitor-app/?source=camera&autostart=1`
- 内置视频检测：`https://abjimmy.github.io/ivset-drip/drip-monitor-app/?source=test`
- 安装与使用手册：`https://abjimmy.github.io/ivset-drip/drip-monitor-app/guide.html`

手机首次打开摄像头直达链接时仍需确认系统权限。授权后，页面会启用后置摄像头并自动开始监测；若权限被拒绝，欢迎页会保留“开启后置摄像头”按钮供再次尝试。

### 前序网页能否作为测试素材？

可以，但用途应限定为界面、取景、循环播放、不同倍速和算法回归测试。当前内置的 Pexels 视频没有逐帧人工标注的真实滴速，而且其首尾循环、塑料反光与气泡都会形成运动信号，因此不能作为精度测试的“标准答案”。正式精度验证应使用已知流速的输液泵/滴速发生器同步拍摄，并逐帧标注每一滴的通过时刻。

## 平台交付路线

当前版本是三端共用的可安装 PWA：

- iOS：Safari 添加到主屏幕；需要商店包时，可将同一前端通过 Capacitor 放入 WKWebView 容器，并配置相机权限描述。
- Android：Chrome 安装 PWA；需要商店包时，可通过 Capacitor 生成 Android 工程并声明 `CAMERA` 权限。
- HarmonyOS：浏览器/PWA 方式可直接运行；原生上架版建议由 ArkUI + Camera Kit 提供相机帧，并复用本项目的检测状态机，或由 ArkWeb 加载 HTTPS 部署版本并转发权限。

原生商店包需要各平台 SDK、签名证书、应用标识和隐私文案，因此不应在没有这些资料时伪造可发布安装包。

## 检测边界

这是视觉算法原型。透明塑料反光、手机抖动、液面气泡、低照度和滴管遮挡都会影响结果。用于临床前需要使用标注数据验证误差范围，并与医用设备监管要求、风险管理和软件生命周期流程对齐。

