const TEST_VIDEO_URL = "../assets/real-drip-pexels-35429657.mp4";
const TEST_ROI = { x: 0.515, y: 0.49, w: 0.12, h: 0.17 };
const CAMERA_ROI = { x: 0.34, y: 0.3, w: 0.32, h: 0.34 };

const elements = {
  app: document.querySelector("#monitorApp"),
  viewfinder: document.querySelector("#viewfinder"),
  video: document.querySelector("#sourceVideo"),
  analysisCanvas: document.querySelector("#analysisCanvas"),
  signalCanvas: document.querySelector("#signalCanvas"),
  cameraPlaceholder: document.querySelector("#cameraPlaceholder"),
  sourceChip: document.querySelector("#sourceChip"),
  sourceChipLabel: document.querySelector("#sourceChip b"),
  fpsValue: document.querySelector("#fpsValue"),
  roiBox: document.querySelector("#roiBox"),
  roiResize: document.querySelector("#roiResize"),
  alignmentTip: document.querySelector("#alignmentTip"),
  dropFlash: document.querySelector("#dropFlash"),
  rateValue: document.querySelector("#rateValue"),
  qualityOrb: document.querySelector("#qualityOrb"),
  qualityValue: document.querySelector("#qualityValue"),
  signalDot: document.querySelector("#signalDot"),
  signalTitle: document.querySelector("#signalTitle"),
  signalHint: document.querySelector("#signalHint"),
  intervalValue: document.querySelector("#intervalValue"),
  totalValue: document.querySelector("#totalValue"),
  stabilityValue: document.querySelector("#stabilityValue"),
  analyzeButton: document.querySelector("#analyzeButton"),
  analyzeLabel: document.querySelector("#analyzeLabel"),
  analyzeSubLabel: document.querySelector("#analyzeSubLabel"),
  sourceButton: document.querySelector("#sourceButton"),
  torchButton: document.querySelector("#torchButton"),
  settingsButton: document.querySelector("#settingsButton"),
  startCameraButton: document.querySelector("#startCameraButton"),
  testVideoButton: document.querySelector("#testVideoButton"),
  sheetCameraButton: document.querySelector("#sheetCameraButton"),
  sheetTestButton: document.querySelector("#sheetTestButton"),
  videoUpload: document.querySelector("#videoUpload"),
  sheetVideoUpload: document.querySelector("#sheetVideoUpload"),
  welcomeSheet: document.querySelector("#welcomeSheet"),
  welcomeBackdrop: document.querySelector("#welcomeBackdrop"),
  sourceSheet: document.querySelector("#sourceSheet"),
  sourceBackdrop: document.querySelector("#sourceBackdrop"),
  settingsSheet: document.querySelector("#settingsSheet"),
  settingsBackdrop: document.querySelector("#settingsBackdrop"),
  sensitivitySlider: document.querySelector("#sensitivitySlider"),
  sensitivityValue: document.querySelector("#sensitivityValue"),
  testSpeedRow: document.querySelector("#testSpeedRow"),
  testSpeedButton: document.querySelector("#testSpeedButton"),
  resetRoiButton: document.querySelector("#resetRoiButton"),
  resetSessionButton: document.querySelector("#resetSessionButton"),
  installButton: document.querySelector("#installButton"),
  toast: document.querySelector("#toast"),
};

const analysisContext = elements.analysisCanvas.getContext("2d", { willReadFrequently: true });
const signalContext = elements.signalCanvas.getContext("2d");

const state = {
  source: null,
  sourceReady: false,
  stream: null,
  objectUrl: null,
  cameraTrack: null,
  analyzing: false,
  hasAnalyzed: false,
  torchOn: false,
  roi: { ...CAMERA_ROI },
  sensitivity: 0.65,
  previousFrame: null,
  previousMean: 0,
  baseline: 0,
  calibrationFrames: 0,
  candidateActive: false,
  candidatePeak: 0,
  candidateStartedAt: 0,
  lastDropAt: 0,
  dropTimes: [],
  totalDrops: 0,
  displayedRate: null,
  signalHistory: Array(118).fill(0),
  lastAnalysisAt: 0,
  frameCounter: 0,
  fpsCounterStartedAt: performance.now(),
  previousVideoTime: 0,
  ignoreMotionUntil: 0,
  deferredInstallPrompt: null,
  testSpeedIndex: 1,
  toastTimer: null,
  drag: null,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => elements.toast.classList.remove("is-visible"), 2400);
}

function setBodySheetState() {
  const hasOpenSheet = document.querySelector(".bottom-sheet.is-visible");
  document.body.classList.toggle("sheet-open", Boolean(hasOpenSheet));
}

function showSheet(name) {
  const sheet = elements[`${name}Sheet`];
  const backdrop = elements[`${name}Backdrop`];
  if (!sheet || !backdrop) return;
  sheet.classList.add("is-visible");
  backdrop.classList.add("is-visible");
  setBodySheetState();
}

function hideSheet(name) {
  const sheet = elements[`${name}Sheet`];
  const backdrop = elements[`${name}Backdrop`];
  if (!sheet || !backdrop) return;
  sheet.classList.remove("is-visible");
  backdrop.classList.remove("is-visible");
  setBodySheetState();
}

function applyRoi() {
  const { x, y, w, h } = state.roi;
  elements.roiBox.style.setProperty("--roi-x", `${x * 100}%`);
  elements.roiBox.style.setProperty("--roi-y", `${y * 100}%`);
  elements.roiBox.style.setProperty("--roi-w", `${w * 100}%`);
  elements.roiBox.style.setProperty("--roi-h", `${h * 100}%`);
  elements.dropFlash.style.left = `${(x + w / 2) * 100}%`;
  elements.dropFlash.style.top = `${(y + h / 2) * 100}%`;
}

function setSourceUi(label, isLive = true) {
  elements.sourceChipLabel.textContent = label;
  elements.sourceChip.classList.toggle("is-live", isLive);
  elements.cameraPlaceholder.classList.toggle("is-hidden", isLive);
  elements.analyzeButton.disabled = !isLive;
  elements.analyzeSubLabel.textContent = isLive ? "逐帧本地识别" : "连接影像后可用";
}

function resetSignalState(clearTotal = false) {
  state.previousFrame = null;
  state.previousMean = 0;
  state.baseline = 0;
  state.calibrationFrames = 0;
  state.candidateActive = false;
  state.candidatePeak = 0;
  state.candidateStartedAt = 0;
  state.lastDropAt = 0;
  state.previousVideoTime = 0;
  state.ignoreMotionUntil = 0;
  state.dropTimes = [];
  state.displayedRate = null;
  state.signalHistory.fill(0);

  if (clearTotal) state.totalDrops = 0;

  elements.rateValue.textContent = "--";
  elements.intervalValue.innerHTML = "--<small> s</small>";
  elements.totalValue.innerHTML = `${state.totalDrops}<small> 滴</small>`;
  elements.stabilityValue.innerHTML = "--<small> %</small>";
  setQuality(0);
  drawSignalGraph();
}

function stopCurrentSource() {
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  state.cameraTrack = null;
  state.torchOn = false;
  elements.torchButton.classList.remove("is-active");
  elements.torchButton.disabled = true;

  elements.video.pause();
  elements.video.srcObject = null;
  elements.video.removeAttribute("src");
  elements.video.load();
  elements.video.classList.remove("is-ready");

  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }

  state.sourceReady = false;
  state.analyzing = false;
  elements.app.classList.remove("is-analyzing");
}

async function waitForVideoReady() {
  if (elements.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
  await new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("视频无法读取"));
    };
    const cleanup = () => {
      elements.video.removeEventListener("loadeddata", onReady);
      elements.video.removeEventListener("error", onError);
    };
    elements.video.addEventListener("loadeddata", onReady, { once: true });
    elements.video.addEventListener("error", onError, { once: true });
  });
}

async function loadVideoSource(source, label, mode = "test", isObjectUrl = false) {
  stopCurrentSource();
  if (isObjectUrl) state.objectUrl = source;
  state.source = mode;
  state.roi = mode === "test" ? { ...TEST_ROI } : { ...CAMERA_ROI };
  applyRoi();
  elements.video.loop = true;
  elements.video.src = source;

  try {
    await waitForVideoReady();
    elements.video.playbackRate = mode === "test" ? [0.5, 1, 1.5, 2][state.testSpeedIndex] : 1;
    await elements.video.play();
    state.sourceReady = true;
    elements.video.classList.add("is-ready");
    setSourceUi(label);
    elements.torchButton.disabled = true;
    elements.testSpeedRow.classList.remove("is-hidden");
    hideSheet("welcome");
    hideSheet("source");
    resetSignalState(true);
    setAnalyzing(true);
  } catch (error) {
    setSourceUi("视频读取失败", false);
    showToast(error.message || "无法读取这段视频");
  }
}

async function startCamera(options = {}) {
  const autoAnalyze = Boolean(options?.autoAnalyze);

  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("摄像头需要 HTTPS 安全环境或原生应用容器");
    return;
  }

  stopCurrentSource();
  setSourceUi("请求摄像头权限…", false);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 60 },
      },
    });

    state.source = "camera";
    state.stream = stream;
    state.cameraTrack = stream.getVideoTracks()[0] || null;
    state.roi = { ...CAMERA_ROI };
    applyRoi();
    elements.video.loop = false;
    elements.video.srcObject = stream;
    await elements.video.play();
    state.sourceReady = true;
    elements.video.classList.add("is-ready");
    setSourceUi("后置摄像头");
    elements.testSpeedRow.classList.add("is-hidden");

    const capabilities = state.cameraTrack?.getCapabilities?.() || {};
    elements.torchButton.disabled = !capabilities.torch;

    hideSheet("welcome");
    hideSheet("source");
    resetSignalState(true);
    setAnalyzing(autoAnalyze);
    showToast(autoAnalyze ? "摄像头已开启，正在自动监测" : "请将滴嘴与液面之间的区域放入识别框");
  } catch (error) {
    const messages = {
      NotAllowedError: "未获得摄像头权限，请在系统设置中允许访问",
      NotFoundError: "没有找到可用摄像头",
      NotReadableError: "摄像头正被其他应用占用",
      OverconstrainedError: "摄像头不支持所需的画面规格",
    };
    setSourceUi("摄像头未连接", false);
    showToast(messages[error.name] || "摄像头启动失败，请重试");
  }
}

function setAnalyzing(analyzing) {
  if (!state.sourceReady) return;

  state.analyzing = analyzing;
  state.hasAnalyzed ||= analyzing;
  elements.app.classList.toggle("is-analyzing", analyzing);
  elements.app.classList.toggle("is-paused", !analyzing);
  elements.signalDot.classList.toggle("is-live", analyzing);
  elements.analyzeLabel.textContent = analyzing ? "暂停监测" : state.hasAnalyzed ? "继续监测" : "开始监测";
  elements.analyzeSubLabel.textContent = analyzing ? "正在逐帧分析" : "取景框可继续调整";

  if (analyzing) {
    if (state.source !== "camera") elements.video.play().catch(() => {});
    elements.signalTitle.textContent = state.calibrationFrames < 22 ? "正在校准" : "识别运行中";
    elements.signalHint.textContent = state.calibrationFrames < 22 ? "保持画面稳定约 1 秒" : "等待液滴通过识别区";
  } else {
    if (state.source !== "camera") elements.video.pause();
    elements.signalTitle.textContent = "监测已暂停";
    elements.signalHint.textContent = "可移动或调整识别框";
  }
}

async function toggleTorch() {
  if (!state.cameraTrack?.applyConstraints) return;
  state.torchOn = !state.torchOn;
  try {
    await state.cameraTrack.applyConstraints({ advanced: [{ torch: state.torchOn }] });
    elements.torchButton.classList.toggle("is-active", state.torchOn);
    showToast(state.torchOn ? "补光灯已开启" : "补光灯已关闭");
  } catch {
    state.torchOn = false;
    elements.torchButton.classList.remove("is-active");
    showToast("当前设备无法控制补光灯");
  }
}

function computeCoverCrop(videoWidth, videoHeight, targetWidth, targetHeight) {
  const videoRatio = videoWidth / videoHeight;
  const targetRatio = targetWidth / targetHeight;

  if (videoRatio > targetRatio) {
    const sourceWidth = videoHeight * targetRatio;
    return { sx: (videoWidth - sourceWidth) / 2, sy: 0, sw: sourceWidth, sh: videoHeight };
  }

  const sourceHeight = videoWidth / targetRatio;
  return { sx: 0, sy: (videoHeight - sourceHeight) / 2, sw: videoWidth, sh: sourceHeight };
}

function sampleMotionEnergy() {
  const viewWidth = elements.viewfinder.clientWidth;
  const viewHeight = elements.viewfinder.clientHeight;
  const canvasWidth = 240;
  const canvasHeight = Math.max(260, Math.round(canvasWidth * (viewHeight / viewWidth)));

  if (elements.analysisCanvas.width !== canvasWidth || elements.analysisCanvas.height !== canvasHeight) {
    elements.analysisCanvas.width = canvasWidth;
    elements.analysisCanvas.height = canvasHeight;
  }

  const crop = computeCoverCrop(
    elements.video.videoWidth,
    elements.video.videoHeight,
    canvasWidth,
    canvasHeight,
  );
  analysisContext.drawImage(
    elements.video,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    canvasWidth,
    canvasHeight,
  );

  const roiBoxX = Math.max(0, Math.floor(state.roi.x * canvasWidth));
  const roiBoxY = Math.max(0, Math.floor(state.roi.y * canvasHeight));
  const roiBoxWidth = Math.max(12, Math.floor(state.roi.w * canvasWidth));
  const roiBoxHeight = Math.max(10, Math.floor(state.roi.h * canvasHeight));
  const roiWidth = Math.max(8, Math.floor(roiBoxWidth * 0.6));
  const roiHeight = Math.max(4, Math.floor(roiBoxHeight * 0.14));
  const roiX = roiBoxX + Math.floor((roiBoxWidth - roiWidth) / 2);
  const roiY = roiBoxY + Math.floor(roiBoxHeight * 0.54);
  const image = analysisContext.getImageData(roiX, roiY, roiWidth, roiHeight).data;
  const sampleCount = Math.ceil((roiWidth * roiHeight) / 2);
  const current = new Uint8Array(sampleCount);
  let currentMean = 0;
  let sampleIndex = 0;

  for (let pixel = 0; pixel < roiWidth * roiHeight; pixel += 2) {
    const offset = pixel * 4;
    const gray = Math.round(image[offset] * 0.299 + image[offset + 1] * 0.587 + image[offset + 2] * 0.114);
    current[sampleIndex] = gray;
    currentMean += gray;
    sampleIndex += 1;
  }
  currentMean /= sampleIndex || 1;

  if (!state.previousFrame || state.previousFrame.length !== current.length) {
    state.previousFrame = current;
    state.previousMean = currentMean;
    return 0;
  }

  const meanDifference = Math.abs(currentMean - state.previousMean);

  state.previousFrame = current;
  state.previousMean = currentMean;
  return meanDifference;
}

function registerDrop(time, strength) {
  if (time - state.lastDropAt < 240) return;
  state.lastDropAt = time;
  state.dropTimes.push(time);
  state.dropTimes = state.dropTimes.slice(-9);
  state.totalDrops += 1;
  elements.totalValue.innerHTML = `${state.totalDrops}<small> 滴</small>`;

  elements.dropFlash.classList.remove("is-active");
  void elements.dropFlash.offsetWidth;
  elements.dropFlash.classList.add("is-active");

  const intervals = state.dropTimes.slice(1).map((dropTime, index) => dropTime - state.dropTimes[index]);
  const validIntervals = intervals.filter((interval) => interval >= 320 && interval <= 12000).slice(-6);
  if (!validIntervals.length) {
    elements.signalTitle.textContent = "检测到第 1 滴";
    elements.signalHint.textContent = "继续保持画面稳定";
    setQuality(24);
    return;
  }

  const interval = median(validIntervals);
  const measuredRate = clamp(60000 / interval, 5, 180);
  state.displayedRate = state.displayedRate === null
    ? measuredRate
    : state.displayedRate * 0.56 + measuredRate * 0.44;

  const mean = validIntervals.reduce((sum, value) => sum + value, 0) / validIntervals.length;
  const deviation = Math.sqrt(validIntervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / validIntervals.length);
  const coefficient = mean ? deviation / mean : 1;
  const stability = Math.round(clamp(100 - coefficient * 165, 0, 99));
  const sampleConfidence = clamp(validIntervals.length / 4, 0, 1);
  const signalConfidence = clamp((strength - state.baseline) / Math.max(0.4, state.baseline + 0.8), 0.25, 1);
  const quality = Math.round(clamp((42 + stability * 0.5) * sampleConfidence * signalConfidence, 12, 96));

  elements.rateValue.textContent = String(Math.round(state.displayedRate));
  elements.intervalValue.innerHTML = `${(interval / 1000).toFixed(2)}<small> s</small>`;
  elements.stabilityValue.innerHTML = `${stability}<small> %</small>`;
  elements.signalTitle.textContent = "滴液信号稳定";
  elements.signalHint.textContent = `已基于最近 ${validIntervals.length + 1} 滴估计`;
  setQuality(quality);
}

function setQuality(quality) {
  const rounded = Math.round(clamp(quality, 0, 100));
  elements.qualityOrb.style.setProperty("--quality", rounded);
  elements.qualityValue.textContent = `${rounded}%`;
  elements.qualityOrb.dataset.level = rounded >= 70 ? "good" : rounded >= 35 ? "fair" : "idle";
}

function processMotion(time) {
  if (state.source !== "camera") {
    const currentVideoTime = elements.video.currentTime;
    if (currentVideoTime + 0.18 < state.previousVideoTime) {
      state.previousFrame = null;
      state.candidateActive = false;
      state.ignoreMotionUntil = time + 420;
    }
    state.previousVideoTime = currentVideoTime;
  }

  const energy = sampleMotionEnergy();
  state.frameCounter += 1;

  if (time - state.fpsCounterStartedAt >= 1000) {
    const elapsed = (time - state.fpsCounterStartedAt) / 1000;
    elements.fpsValue.textContent = String(Math.round(state.frameCounter / elapsed));
    state.frameCounter = 0;
    state.fpsCounterStartedAt = time;
  }

  if (time < state.ignoreMotionUntil) {
    state.signalHistory.push(0);
    state.signalHistory.shift();
    return;
  }

  if (state.calibrationFrames < 22) {
    state.baseline = state.calibrationFrames === 0
      ? energy
      : state.baseline * 0.86 + energy * 0.14;
    state.calibrationFrames += 1;
    state.signalHistory.push(energy * 0.1);
    state.signalHistory.shift();
    elements.signalTitle.textContent = "正在校准环境";
    elements.signalHint.textContent = `${Math.round((state.calibrationFrames / 22) * 100)}% · 请保持手机稳定`;
    setQuality(Math.round((state.calibrationFrames / 22) * 16));
    return;
  }

  const threshold = Math.max(0.72, state.baseline * (2.75 - state.sensitivity * 0.95) + (1.05 - state.sensitivity) * 1.15);
  const normalizedSignal = clamp((energy - state.baseline) / Math.max(0.35, threshold - state.baseline), 0, 1.35);
  state.signalHistory.push(normalizedSignal);
  state.signalHistory.shift();

  if (!state.candidateActive && energy < threshold) {
    state.baseline = state.baseline * 0.985 + energy * 0.015;
  }

  if (!state.candidateActive && energy >= threshold && time - state.lastDropAt >= 240) {
    state.candidateActive = true;
    state.candidatePeak = energy;
    state.candidateStartedAt = time;
  } else if (state.candidateActive) {
    state.candidatePeak = Math.max(state.candidatePeak, energy);
    const candidateAge = time - state.candidateStartedAt;
    const eventFinished = energy < threshold * 0.78 || candidateAge > 220;

    if (eventFinished) {
      if (state.candidatePeak >= threshold * 1.04) registerDrop(time, state.candidatePeak);
      state.candidateActive = false;
      state.candidatePeak = 0;
    }
  }

  if (state.dropTimes.length && time - state.lastDropAt > 9000) {
    elements.signalTitle.textContent = "暂未检测到新液滴";
    elements.signalHint.textContent = "检查识别框或提高灵敏度";
  } else if (!state.dropTimes.length) {
    elements.signalTitle.textContent = "识别运行中";
    elements.signalHint.textContent = "等待液滴通过识别区";
  }
}

function drawSignalGraph() {
  const { width, height } = elements.signalCanvas;
  signalContext.clearRect(0, 0, width, height);

  const gradient = signalContext.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "rgba(122,229,215,0.06)");
  gradient.addColorStop(0.74, "rgba(122,229,215,0.48)");
  gradient.addColorStop(1, "rgba(203,255,247,0.92)");

  signalContext.beginPath();
  state.signalHistory.forEach((value, index) => {
    const x = (index / (state.signalHistory.length - 1)) * width;
    const y = height - 6 - clamp(value, 0, 1.25) / 1.25 * (height - 13);
    if (index === 0) signalContext.moveTo(x, y);
    else signalContext.lineTo(x, y);
  });
  signalContext.strokeStyle = gradient;
  signalContext.lineWidth = 2;
  signalContext.lineJoin = "round";
  signalContext.stroke();

  signalContext.beginPath();
  signalContext.moveTo(0, height - 6);
  signalContext.lineTo(width, height - 6);
  signalContext.strokeStyle = "rgba(218,255,249,0.08)";
  signalContext.lineWidth = 1;
  signalContext.stroke();
}

function analysisLoop(time) {
  if (
    state.analyzing
    && state.sourceReady
    && elements.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    && time - state.lastAnalysisAt >= 32
  ) {
    state.lastAnalysisAt = time;
    try {
      processMotion(time);
    } catch {
      elements.signalTitle.textContent = "画面分析暂时中断";
      elements.signalHint.textContent = "请重新选择影像源";
    }
  }

  drawSignalGraph();
  requestAnimationFrame(analysisLoop);
}

function handleRoiPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  const rect = elements.viewfinder.getBoundingClientRect();
  state.drag = {
    pointerId: event.pointerId,
    mode: event.target === elements.roiResize ? "resize" : "move",
    startX: event.clientX,
    startY: event.clientY,
    viewWidth: rect.width,
    viewHeight: rect.height,
    roi: { ...state.roi },
  };
  elements.roiBox.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function handleRoiPointerMove(event) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) return;
  const dx = (event.clientX - state.drag.startX) / state.drag.viewWidth;
  const dy = (event.clientY - state.drag.startY) / state.drag.viewHeight;
  const original = state.drag.roi;

  if (state.drag.mode === "move") {
    state.roi.x = clamp(original.x + dx, 0.02, 0.98 - original.w);
    state.roi.y = clamp(original.y + dy, 0.12, 0.92 - original.h);
  } else {
    state.roi.w = clamp(original.w + dx, 0.12, 0.72 - original.x);
    state.roi.h = clamp(original.h + dy, 0.12, 0.78 - original.y);
  }

  applyRoi();
  state.previousFrame = null;
  state.calibrationFrames = 0;
}

function handleRoiPointerUp(event) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) return;
  state.drag = null;
  elements.roiBox.releasePointerCapture(event.pointerId);
  showToast("识别区域已更新，正在重新校准");
}

function handleVideoFile(file) {
  if (!file) return;
  if (!file.type.startsWith("video/")) {
    showToast("请选择 MP4、WebM 或 MOV 视频");
    return;
  }
  if (file.size > 180 * 1024 * 1024) {
    showToast("测试视频请控制在 180MB 以内");
    return;
  }
  const objectUrl = URL.createObjectURL(file);
  loadVideoSource(objectUrl, "本地测试视频", "upload", true);
}

function cycleTestSpeed() {
  const speeds = [0.5, 1, 1.5, 2];
  state.testSpeedIndex = (state.testSpeedIndex + 1) % speeds.length;
  const speed = speeds[state.testSpeedIndex];
  elements.video.playbackRate = speed;
  elements.testSpeedButton.textContent = `${speed.toFixed(1)}×`;
  resetSignalState(true);
  showToast(`测试视频已切换为 ${speed.toFixed(1)} 倍速`);
}

elements.startCameraButton.addEventListener("click", startCamera);
elements.sheetCameraButton.addEventListener("click", startCamera);
elements.testVideoButton.addEventListener("click", () => loadVideoSource(TEST_VIDEO_URL, "内置真实视频", "test"));
elements.sheetTestButton.addEventListener("click", () => loadVideoSource(TEST_VIDEO_URL, "内置真实视频", "test"));
elements.analyzeButton.addEventListener("click", () => setAnalyzing(!state.analyzing));
elements.torchButton.addEventListener("click", toggleTorch);
elements.sourceButton.addEventListener("click", () => showSheet("source"));
elements.settingsButton.addEventListener("click", () => showSheet("settings"));
elements.testSpeedButton.addEventListener("click", cycleTestSpeed);

elements.videoUpload.addEventListener("change", (event) => {
  handleVideoFile(event.target.files?.[0]);
  event.target.value = "";
});

elements.sheetVideoUpload.addEventListener("change", (event) => {
  handleVideoFile(event.target.files?.[0]);
  event.target.value = "";
});

elements.sensitivitySlider.addEventListener("input", (event) => {
  const value = Number(event.target.value);
  state.sensitivity = value / 100;
  elements.sensitivityValue.textContent = `${value}%`;
  const progress = ((value - 20) / 80) * 100;
  event.target.style.setProperty("--sensitivity", `${progress}%`);
});

elements.resetRoiButton.addEventListener("click", () => {
  state.roi = state.source === "test" ? { ...TEST_ROI } : { ...CAMERA_ROI };
  applyRoi();
  resetSignalState(false);
  hideSheet("settings");
  showToast("识别框已重置");
});

elements.resetSessionButton.addEventListener("click", () => {
  resetSignalState(true);
  hideSheet("settings");
  showToast("本次监测数据已清空");
});

elements.roiBox.addEventListener("pointerdown", handleRoiPointerDown);
elements.roiBox.addEventListener("pointermove", handleRoiPointerMove);
elements.roiBox.addEventListener("pointerup", handleRoiPointerUp);
elements.roiBox.addEventListener("pointercancel", handleRoiPointerUp);

document.querySelectorAll("[data-close-sheet]").forEach((button) => {
  button.addEventListener("click", () => hideSheet(button.dataset.closeSheet));
});

elements.sourceBackdrop.addEventListener("click", () => hideSheet("source"));
elements.settingsBackdrop.addEventListener("click", () => hideSheet("settings"));
document.querySelector(".app-brand").addEventListener("click", (event) => event.preventDefault());

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.deferredInstallPrompt = event;
  elements.installButton.hidden = false;
});

elements.installButton.addEventListener("click", async () => {
  if (!state.deferredInstallPrompt) return;
  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice;
  state.deferredInstallPrompt = null;
  elements.installButton.hidden = true;
});

window.addEventListener("beforeunload", stopCurrentSource);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

applyRoi();
elements.sensitivitySlider.style.setProperty("--sensitivity", "56.25%");
drawSignalGraph();
requestAnimationFrame(analysisLoop);

const urlParams = new URLSearchParams(window.location.search);
const requestedSource = urlParams.get("source");
if (requestedSource === "test") {
  hideSheet("welcome");
  loadVideoSource(TEST_VIDEO_URL, "内置真实视频", "test");
} else if (requestedSource === "camera") {
  setBodySheetState();
  startCamera({ autoAnalyze: urlParams.get("autostart") === "1" });
} else {
  setBodySheetState();
}

