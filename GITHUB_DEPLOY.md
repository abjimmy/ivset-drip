# GitHub Pages 部署与双设备测试

目标仓库：[`abjimmy/ivset-drip`](https://github.com/abjimmy/ivset-drip)  
Pages 根地址：`https://abjimmy.github.io/ivset-drip/`

## 正式访问地址

- 电脑滴液演示：<https://abjimmy.github.io/ivset-drip/>
- 手机摄像头检测（短链接）：<https://abjimmy.github.io/ivset-drip/camera.html>
- 手机摄像头检测（完整链接）：<https://abjimmy.github.io/ivset-drip/drip-monitor-app/?source=camera&autostart=1>
- 内置视频检测：<https://abjimmy.github.io/ivset-drip/drip-monitor-app/?source=test>
- 安装与使用手册：<https://abjimmy.github.io/ivset-drip/drip-monitor-app/guide.html>

## 手机检测真实滴管

1. 用手机 Safari、Chrome 或华为浏览器打开“手机摄像头检测”地址。
2. 允许网页使用后置摄像头。
3. 授权后页面会自动开始监测。
4. 将滴嘴到液面之间的液滴路径放进识别框。
5. 固定手机，等待校准并观察 3–5 滴后读取滴/分。

## 手机检测电脑网页

1. 电脑打开“电脑滴液演示”地址并播放滴液画面。
2. 手机打开“手机摄像头检测”地址。
3. 将手机摄像头对准电脑屏幕中的滴管。
4. 缩小识别框，让虚线横穿液滴路径，避开文字、边框和液面。

显示器刷新、屏幕摩尔纹和反光会影响运动信号，因此这种方式只用于功能联调，不用于精度标定。

## 更新发布

仓库当前使用 `main` 分支的 GitHub Pages 自动发布。更新文件并推送到 `main` 后，等待 `pages-build-deployment` 工作流完成即可。GitHub Pages 提供 HTTPS，满足浏览器摄像头 API 的安全上下文要求。

浏览器不会允许网页绕过摄像头隐私授权。自动直达链接会立即发起权限请求，但首次访问仍必须由用户点击“允许”。

