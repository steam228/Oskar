/*
 * OSKAR - Dual Canvas Projection Mapping System
 * Using p5.mapper for projection mapping
 * Using global p5 mode for ml5 compatibility
 */

let pMapper;
let quadMap1, quadMap2;
let canvas1, canvas2;
let viz1, viz2;
let visualizers1 = [];
let visualizers2 = [];
let viz1Index = 0;
let viz2Index = 1;
let canvas1Visible = true;
let canvas2Visible = true;

// Shared video and pose detection
let video;
let bodyPose;
let poses = [];
let previousPoses = [];

// Video configuration
let showVideo = true;
let mirrorMode = true;
let smoothingFactor = 0.5;
let schlemerLineLength = 0;

// Detection mask
let maskPoints = [];
let maskEnabled = false;

// OskarBit sensor integration
let sensorPort;
const SENSOR_BAUDRATE = 115200;
const MAX_SENSORS = 6;
let sensorData = {};
let sensorConnected = false;
let mostDynamicSensor = null;

// Trail control from sensors
let sensorTrailInterval = 3;  // Default interval between trail captures
let sensorTrailCount = 60;    // Default max trail frames

// Mask editing
let maskEditMode = false;
let selectedMaskPoint = -1;

// Track shift key state for mouse interactions
let isShiftDown = false;

// Sensor simulation mode
let simulationMode = false;
let simulationSensor = null;

// Sensor Data Class (simplified from OskarBit)
class SensorStream {
  constructor(id) {
    this.id = id;
    this.lastUpdate = Date.now();
    this.motion = 0;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.calibrating = true;
    this.calibrationData = [];
    this.baseX = 0;
    this.baseY = 0; 
    this.baseZ = 0;
    this.deadzone = 250;
  }
  
  update(x, y, z) {
    if (isNaN(x) || isNaN(y) || isNaN(z)) return;
    
    this.x = x;
    this.y = y;
    this.z = z;
    
    if (this.calibrating) {
      this.calibrationData.push({ x, y, z });
      if (this.calibrationData.length >= 30) { // Faster calibration
        this.finishCalibration();
      }
      this.lastUpdate = Date.now();
      return;
    }
    
    // Calculate motion
    let dx = this.x - this.baseX;
    let dy = this.y - this.baseY;
    let dz = this.z - this.baseZ;
    let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (distance < this.deadzone) {
      this.motion = 0;
    } else if (distance < 500) {
      this.motion = 1;
    } else if (distance < 1000) {
      this.motion = 2;
    } else if (distance < 2000) {
      this.motion = 3;
    } else if (distance < 3500) {
      this.motion = 4;
    } else {
      this.motion = 5;
    }
    
    this.lastUpdate = Date.now();
  }
  
  finishCalibration() {
    let sumX = 0, sumY = 0, sumZ = 0;
    for (let d of this.calibrationData) {
      sumX += d.x;
      sumY += d.y;
      sumZ += d.z;
    }
    this.baseX = sumX / this.calibrationData.length;
    this.baseY = sumY / this.calibrationData.length;
    this.baseZ = sumZ / this.calibrationData.length;
    this.calibrating = false;
    console.log(`✓ Sensor ${this.id} calibrated`);
  }
  
  isActive() {
    return Date.now() - this.lastUpdate < 5000;
  }
}

function preload() {
  // Preload is kept for consistency but video/pose init moved to setup
}

async function setup() {
  // Check if ml5 is loaded
  if (typeof ml5 === "undefined") {
    console.error("ml5.js not loaded! Please check your internet connection.");
    return;
  }
  console.log("ml5 version:", ml5.version);

  createCanvas(windowWidth, windowHeight, WEBGL);

  // Create projection mapper
  pMapper = createProjectionMapper(this);

  // Create two quad maps for our two canvases
  quadMap1 = pMapper.createQuadMap(1280, 720);
  quadMap2 = pMapper.createQuadMap(1280, 720);

  // Create p5.Graphics buffers for each canvas
  canvas1 = createGraphics(1280, 720);
  canvas2 = createGraphics(1280, 720);

  // Initialize video and pose detection
  await initVideo();
  await loadPoseModel();
  calculateSchlemerLineLength();

  // Create visualizers with different colors
  visualizers1 = [
    new ClearRedSchlemerVisualizer(canvas1),        // Clear red, no trails
    new WhiteSchlemerVisualizer(canvas1),           // White with trails
    new SpringyBlueSchlemerVisualizer(canvas1),     // Springy blue curves with trails
  ];

  visualizers2 = [
    new ClearRedSchlemerVisualizer(canvas2),        // Clear red, no trails
    new WhiteSchlemerVisualizer(canvas2),           // White with trails
    new SpringyBlueSchlemerVisualizer(canvas2),     // Springy blue curves with trails
  ];

  // Set initial visualizers
  viz1 = visualizers1[viz1Index]; // Clear (Red)
  viz2 = visualizers2[viz2Index]; // White

  // Load saved calibration
  pMapper.load("maps/map.json");

  // Load saved detection mask
  loadDetectionMask();

  // Initialize sensor port
  try {
    sensorPort = createSerial();
    let usedPorts = usedSerialPorts();
    if (usedPorts.length > 0) {
      sensorPort.open(usedPorts[0], SENSOR_BAUDRATE);
      console.log("✓ Sensor port available");
    }
  } catch (e) {
    console.log("⚠ Sensor port not available (optional)");
  }

  console.log("\n=== OSKAR Dual Canvas System with p5.mapper ===");
  console.log("\n=== Projection Mapping ===");
  console.log("C - Toggle calibration mode (drag corners to map)");
  console.log("S - Save current mapping");
  console.log("P - Connect sensor port");
  console.log("L - Load saved mapping");
  console.log("F - Toggle fullscreen");
  console.log("\n=== Canvas Visibility ===");
  console.log("Shift+1 - Show/Hide Canvas 1");
  console.log("Shift+2 - Show/Hide Canvas 2");
  console.log("\n=== Visualizer Controls ===");
  console.log("Alt+1 - Cycle Canvas 1 (Clear, White+Trail, Springy+Trail)");
  console.log("Alt+2 - Cycle Canvas 2 (Clear, White+Trail, Springy+Trail)");
  console.log("\n=== OSKAR Controls (when OSKAR is displayed) ===");
  console.log("B - Toggle video background");
  console.log("T - Toggle trail effect");
  console.log("R - Recalibrate stick length");
  console.log("M - Toggle mirror mode");
  console.log("\n=== Detection Mask ===");
  console.log(
    "A - Edit detection mask (click to add, hold Shift+drag to move)"
  );
  console.log("E - Enable/disable mask");
  console.log("X - Clear mask");
  console.log("\n=== Sensor Effects ===");
  console.log("XY Motion - Controls trail frequency and count");
  console.log("Z Motion - Controls springy line elasticity (auto)");
  console.log("+ / - - Manual elasticity override (when Springy is active)");

  console.log("\n✓ System initialized");
}

// === VIDEO AND POSE DETECTION FUNCTIONS ===

async function initVideo() {
  console.log("Initializing video capture...");
  video = createCapture(VIDEO);
  video.hide();

  return new Promise((resolve) => {
    video.elt.addEventListener("loadedmetadata", () => {
      console.log("✓ Video ready:", video.width, "x", video.height);
      // Add small delay to ensure video is truly ready
      setTimeout(() => resolve(), 500);
    });
  });
}

function loadPoseModel() {
  return new Promise((resolve, reject) => {
    try {
      console.log("Loading ml5 bodyPose model...");

      bodyPose = ml5.bodyPose(
        "MoveNet",
        {
          modelType: "SINGLEPOSE_LIGHTNING",
          enableSmoothing: true,
          minPoseScore: 0.25,
        },
        () => {
          // Model loaded callback
          console.log("✓ Model loaded, starting detection...");
          bodyPose.detectStart(video, gotPoses);
          console.log("✓ Pose detection started");
          resolve();
        }
      );
    } catch (error) {
      console.error("Error loading bodyPose model:", error);
      reject(error);
    }
  });
}

function calculateSchlemerLineLength() {
  if (poses.length === 0) return;

  let pose = poses[0];
  let nose = pose.keypoints[0];
  let leftAnkle = pose.keypoints[15];
  let rightAnkle = pose.keypoints[16];

  if (
    nose.confidence > 0.1 &&
    (leftAnkle.confidence > 0.1 || rightAnkle.confidence > 0.1)
  ) {
    let ankleX, ankleY;

    if (leftAnkle.confidence > 0.1 && rightAnkle.confidence > 0.1) {
      ankleX = (leftAnkle.x + rightAnkle.x) / 2;
      ankleY = (leftAnkle.y + rightAnkle.y) / 2;
    } else if (leftAnkle.confidence > 0.1) {
      ankleX = leftAnkle.x;
      ankleY = leftAnkle.y;
    } else {
      ankleX = rightAnkle.x;
      ankleY = rightAnkle.y;
    }

    let dx = nose.x - ankleX;
    let dy = nose.y - ankleY;
    let distance = Math.sqrt(dx * dx + dy * dy);
    schlemerLineLength = distance;
    
    // Update all visualizers with new length
    for (let viz of visualizers1) {
      viz.updateSchlemerLineLength(schlemerLineLength);
    }
    for (let viz of visualizers2) {
      viz.updateSchlemerLineLength(schlemerLineLength);
    }
  }
}

function smoothPoses(newPoses, factor) {
  if (previousPoses.length === 0) {
    return newPoses;
  }

  let smoothedPoses = [];

  for (let i = 0; i < newPoses.length; i++) {
    let newPose = newPoses[i];
    let smoothedPose = { keypoints: [] };
    let prevPose = previousPoses[i];

    if (prevPose) {
      for (let j = 0; j < newPose.keypoints.length; j++) {
        let newKp = newPose.keypoints[j];
        let prevKp = prevPose.keypoints[j];

        let smoothedKp = {
          x: prevKp.x * (1 - factor) + newKp.x * factor,
          y: prevKp.y * (1 - factor) + newKp.y * factor,
          confidence: newKp.confidence,
          name: newKp.name,
        };

        smoothedPose.keypoints.push(smoothedKp);
      }
    } else {
      smoothedPose = newPose;
    }

    smoothedPoses.push(smoothedPose);
  }

  return smoothedPoses;
}

function isPointInPolygon(point, polygon) {
  let x = point.x;
  let y = point.y;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].x;
    let yi = polygon[i].y;
    let xj = polygon[j].x;
    let yj = polygon[j].y;

    let intersect =
      yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

function filterPosesByMask(poses) {
  if (!maskEnabled || maskPoints.length < 3) {
    return poses;
  }

  let filteredPoses = [];

  for (let pose of poses) {
    let validKeypoints = 0;
    for (let keypoint of pose.keypoints) {
      if (keypoint.confidence > 0.1) {
        if (isPointInPolygon(keypoint, maskPoints)) {
          validKeypoints++;
        }
      }
    }

    // Only include pose if at least quarter of visible keypoints are in mask
    if (validKeypoints >= pose.keypoints.length / 4) {
      filteredPoses.push(pose);
    }
  }

  return filteredPoses;
}

function gotPoses(results) {
  let smoothedResults = smoothPoses(results, smoothingFactor);
  let filteredResults = filterPosesByMask(smoothedResults);
  poses = filteredResults;
  previousPoses = JSON.parse(JSON.stringify(smoothedResults));

  // Update all visualizers with new poses
  for (let viz of visualizers1) {
    viz.updatePoses(poses);
  }
  for (let viz of visualizers2) {
    viz.updatePoses(poses);
  }

  if (schlemerLineLength === 0 && poses.length > 0) {
    calculateSchlemerLineLength();
  }
}

function calculateVideoConfig(canvasWidth, canvasHeight) {
  // Get the original video source dimensions
  let videoSrcWidth, videoSrcHeight;
  if (video && video.elt && video.elt.videoWidth > 0) {
    videoSrcWidth = video.elt.videoWidth;
    videoSrcHeight = video.elt.videoHeight;
  } else {
    // Fallback to display dimensions if video not loaded yet
    videoSrcWidth = video ? video.width : 640;
    videoSrcHeight = video ? video.height : 480;
  }

  // Calculate proper video sizing for canvas
  let videoAspectRatio = videoSrcWidth / videoSrcHeight;
  let canvasAspectRatio = canvasWidth / canvasHeight;

  let drawWidth, drawHeight;

  if (videoAspectRatio > canvasAspectRatio) {
    drawHeight = canvasHeight;
    drawWidth = canvasHeight * videoAspectRatio;
  } else {
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / videoAspectRatio;
  }

  // Center the video on canvas
  let offsetX = (canvasWidth - drawWidth) / 2;
  let offsetY = (canvasHeight - drawHeight) / 2;

  // Scale from video source to canvas display
  let scaleX = drawWidth / videoSrcWidth;
  let scaleY = drawHeight / videoSrcHeight;

  return {
    drawWidth,
    drawHeight,
    offsetX,
    offsetY,
    scaleX,
    scaleY,
    mirrorMode,
    maskEnabled,
    maskPoints
  };
}

// === SENSOR FUNCTIONS ===

function readSensorData() {
  if (!sensorPort || !sensorPort.opened()) return;
  
  // Read multiple messages per frame to prevent lag
  for (let i = 0; i < 20; i++) {
    let data = sensorPort.readUntil("\n");
    if (!data) break;
    parseSensorMessage(data.trim());
  }
  
  // Update connection status
  sensorConnected = Object.values(sensorData).some(s => s.isActive());
}

function parseSensorMessage(msg) {
  // Registration: S1-S6
  let reg = msg.match(/^S([1-6])$/);
  if (reg) {
    let id = parseInt(reg[1]);
    if (!sensorData[id]) {
      sensorData[id] = new SensorStream(id);
      console.log(`✓ Sensor ${id} connected`);
    }
    return;
  }

  // Data: m1-m6 x=123 y=456 z=789
  let data = msg.match(/^m([1-6])/);
  if (data) {
    let id = parseInt(data[1]);
    
    if (!sensorData[id]) {
      sensorData[id] = new SensorStream(id);
    }
    
    let xm = msg.match(/x=([^,\s]+)/);
    let ym = msg.match(/y=([^,\s]+)/);
    let zm = msg.match(/z=([^,\s]+)/);
    
    if (xm && ym && zm) {
      sensorData[id].update(
        parseFloat(xm[1]),
        parseFloat(ym[1]),
        parseFloat(zm[1])
      );
    }
  }
}

function updateTrailParameters() {
  // Find the most dynamic sensor (highest motion value)
  let maxMotion = 0;
  mostDynamicSensor = null;
  
  for (let id in sensorData) {
    let sensor = sensorData[id];
    if (sensor.isActive() && !sensor.calibrating && sensor.motion > maxMotion) {
      maxMotion = sensor.motion;
      mostDynamicSensor = sensor;
    }
  }
  
  if (mostDynamicSensor && maxMotion > 0) {
    // Calculate combined motion intensity from X and Y
    let xMotion = Math.abs(mostDynamicSensor.x - mostDynamicSensor.baseX);
    let yMotion = Math.abs(mostDynamicSensor.y - mostDynamicSensor.baseY);
    let zMotion = Math.abs(mostDynamicSensor.z - mostDynamicSensor.baseZ);
    
    // Combined XY motion for trail control (0-5000+ range)
    let combinedMotion = Math.sqrt(xMotion * xMotion + yMotion * yMotion);
    
    // Trail interval: No motion = no trails, high motion = very fast trails
    if (combinedMotion < 100) {
      sensorTrailInterval = 999; // Effectively no trails
    } else {
      // Map motion to trail interval: 100-3000+ motion -> 1-8 interval
      sensorTrailInterval = Math.max(1, Math.floor(map(combinedMotion, 100, 3000, 8, 1)));
    }
    
    // Trail count: More motion = way more trails
    if (combinedMotion < 100) {
      sensorTrailCount = 5; // Almost no trails
    } else {
      // Map motion to trail count: 100-3000+ motion -> 20-300 trails
      sensorTrailCount = Math.floor(map(combinedMotion, 100, 3000, 20, 300));
    }
    
    // Z motion affects springiness (0.2 to 2.5 elasticity range)
    let zInfluence = map(zMotion, 0, 2000, 0.2, 2.5);
    
    // Update all visualizers with new trail parameters
    for (let viz of visualizers1) {
      if (viz.updateTrailParameters) {
        viz.updateTrailParameters(sensorTrailInterval, sensorTrailCount);
      }
      // Update springiness for springy visualizers
      if (viz instanceof SpringyBlueSchlemerVisualizer) {
        viz.setElasticity(zInfluence);
      }
    }
    for (let viz of visualizers2) {
      if (viz.updateTrailParameters) {
        viz.updateTrailParameters(sensorTrailInterval, sensorTrailCount);
      }
      // Update springiness for springy visualizers
      if (viz instanceof SpringyBlueSchlemerVisualizer) {
        viz.setElasticity(zInfluence);
      }
    }
    
    // Debug output (remove in final version)
    if (frameCount % 60 === 0) { // Log once per second
      console.log(`Motion: XY=${combinedMotion.toFixed(0)} Z=${zMotion.toFixed(0)} | Trail: int=${sensorTrailInterval} count=${sensorTrailCount} | Elastic=${zInfluence.toFixed(1)}`);
    }
  } else {
    // No motion detected - minimal trails
    sensorTrailInterval = 999;
    sensorTrailCount = 5;
    
    // Update all visualizers
    for (let viz of [...visualizers1, ...visualizers2]) {
      if (viz.updateTrailParameters) {
        viz.updateTrailParameters(sensorTrailInterval, sensorTrailCount);
      }
    }
  }
}

function enableSensorSimulation() {
  simulationMode = true;
  simulationSensor = new SensorStream(1);
  // Set baseline values manually for simulation
  simulationSensor.baseX = 0;
  simulationSensor.baseY = 0;
  simulationSensor.baseZ = 0;
  simulationSensor.calibrating = false;
  sensorData[1] = simulationSensor;
  console.log("✓ Simulation mode enabled - move mouse to test trails");
  console.log("  Mouse X/Y = sensor motion, Mouse wheel = Z motion");
}

function updateSimulation() {
  if (!simulationMode || !simulationSensor) return;
  
  // Use mouse position as sensor input
  let centerX = width / 2;
  let centerY = height / 2;
  
  // Map mouse position to sensor values
  let x = map(mouseX, 0, width, -1000, 1000);
  let y = map(mouseY, 0, height, -1000, 1000);
  let z = sin(millis() * 0.01) * 500; // Oscillating Z for demo
  
  simulationSensor.update(x, y, z);
}

function draw() {
  background(0);

  // Read sensor data or update simulation
  if (simulationMode) {
    updateSimulation();
  } else {
    readSensorData();
  }
  updateTrailParameters();

  // If in mask edit mode, show fullscreen unmapped video with mask editor
  if (maskEditMode) {
    drawMaskEditor();
  } else {
    // Normal operation - draw mapped canvases
    // Draw Canvas 1
    if (canvas1Visible && viz1) {
      canvas1.background(0);
      let videoConfig1 = calculateVideoConfig(canvas1.width, canvas1.height);
      viz1.draw(canvas1.width, canvas1.height, poses, showVideo, video, videoConfig1);
      quadMap1.displayTexture(canvas1);
    }

    // Draw Canvas 2
    if (canvas2Visible && viz2) {
      canvas2.background(0);
      let videoConfig2 = calculateVideoConfig(canvas2.width, canvas2.height);
      viz2.draw(canvas2.width, canvas2.height, poses, showVideo, video, videoConfig2);
      quadMap2.displayTexture(canvas2);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function keyPressed() {
  // Track modifier keys from native event
  let isAltPressed = window.event && window.event.altKey;
  let isShiftPressed = window.event && window.event.shiftKey;

  // Update global shift state for mouse interactions
  if (keyCode === SHIFT) {
    isShiftDown = true;
  }

  console.log(
    "Key pressed:",
    key,
    "KeyCode:",
    keyCode,
    "Shift:",
    isShiftPressed,
    "Alt:",
    isAltPressed
  );

  // Projection mapping controls (no modifiers)
  if (!isShiftPressed && !isAltPressed) {
    if (key === "c" || key === "C") {
      pMapper.toggleCalibration();
      console.log("✓ Calibration mode toggled");
      return false;
    }

    if (key === "f" || key === "F") {
      let fs = fullscreen();
      fullscreen(!fs);
      console.log("✓ Fullscreen toggled");
      return false;
    }

    if (key === "l" || key === "L") {
      pMapper.load("maps/map.json");
      console.log("✓ Mapping loaded");
      return false;
    }

    if (key === "s" || key === "S") {
      pMapper.save("map.json");
      console.log("✓ Mapping saved");
      return false;
    }
    
    if (key === "p" || key === "P") {
      // P = Connect sensor Port OR enable simulation
      if (typeof createSerial === 'undefined') {
        console.log("⚠ Serial not available - enabling sensor simulation mode");
        enableSensorSimulation();
        return false;
      }
      
      if (!sensorPort) {
        try {
          sensorPort = createSerial();
        } catch (e) {
          console.log("⚠ Cannot create serial port - enabling sensor simulation mode");
          enableSensorSimulation();
          return false;
        }
      }
      
      if (sensorPort.opened()) {
        console.log("✓ Sensors already connected");
        return false;
      }
      
      // Try to find and connect to an available port
      let availablePorts = usedSerialPorts();
      console.log("Available serial ports:", availablePorts);
      
      if (availablePorts.length > 0) {
        sensorPort.open(availablePorts[0], SENSOR_BAUDRATE);
        console.log(`✓ Attempting connection to ${availablePorts[0]}...`);
      } else {
        // No used ports, try to open port selection dialog
        sensorPort.open(SENSOR_BAUDRATE);
        console.log("✓ Opening port selection dialog...");
      }
      return false;
    }
  }

  // Shift + number keys for visibility
  if (isShiftPressed && !isAltPressed) {
    if (key === "1" || key === "!" || keyCode === 49) {
      canvas1Visible = !canvas1Visible;
      console.log("✓ Canvas 1 visibility:", canvas1Visible ? "ON" : "OFF");
      return false;
    }

    if (key === "2" || key === "@" || keyCode === 50) {
      canvas2Visible = !canvas2Visible;
      console.log("✓ Canvas 2 visibility:", canvas2Visible ? "ON" : "OFF");
      return false;
    }
  }

  // Alt + number keys for visualizer cycling (must not be in mask edit mode)
  if (isAltPressed && !isShiftPressed && !maskEditMode) {
    if (key === "1" || keyCode === 49) {
      viz1Index = (viz1Index + 1) % visualizers1.length;
      viz1 = visualizers1[viz1Index];
      const names = ["Clear", "White+Trail", "Springy+Trail"];
      console.log(`✓ Canvas 1 → ${names[viz1Index]}`);
      return false;
    }

    if (key === "2" || keyCode === 50) {
      viz2Index = (viz2Index + 1) % visualizers2.length;
      viz2 = visualizers2[viz2Index];
      const names = ["Clear", "White+Trail", "Springy+Trail"];
      console.log(`✓ Canvas 2 → ${names[viz2Index]}`);
      return false;
    }
  }

  // Video background toggle
  if (key === "b" || key === "B") {
    showVideo = !showVideo;
    console.log("✓ Video BG:", showVideo ? "ON" : "OFF");
    return false;
  }

  if (key === "t" || key === "T") {
    // Toggle trail for all visualizers
    for (let viz of visualizers1) {
      viz.showSchlemerTrail = !viz.showSchlemerTrail;
      if (!viz.showSchlemerTrail) {
        viz.trailHistory = [];
        viz.trailFrameCounter = 0;
      }
    }
    for (let viz of visualizers2) {
      viz.showSchlemerTrail = !viz.showSchlemerTrail;
      if (!viz.showSchlemerTrail) {
        viz.trailHistory = [];
        viz.trailFrameCounter = 0;
      }
    }
    console.log("✓ Trail:", visualizers1[0].showSchlemerTrail ? "ON" : "OFF");
    return false;
  }

  if (key === "r" || key === "R") {
    calculateSchlemerLineLength();
    console.log("✓ Calibrated");
    return false;
  }

  // Mirror mode toggle
  if (key === "m" || key === "M") {
    mirrorMode = !mirrorMode;
    console.log("✓ Mirror mode:", mirrorMode ? "ON" : "OFF");
    return false;
  }

  // Mask editing mode
  if (key === "a" || key === "A") {
    toggleMaskEditMode();
    return false;
  }

  // Enable/disable mask
  if (key === "e" || key === "E") {
    maskEnabled = !maskEnabled;
    saveDetectionMask();
    console.log("✓ Mask enabled:", maskEnabled ? "ON" : "OFF");
    return false;
  }

  // Clear mask
  if (key === "x" || key === "X") {
    maskPoints = [];
    maskEnabled = false;
    saveDetectionMask();
    console.log("✓ Mask cleared");
    return false;
  }

  // Recalibrate Schlemmer stick lengths
  if (key === "k" || key === "K") {
    schlemerLineLength = 0; // Reset to force recalculation
    calculateSchlemerLineLength();
    console.log(
      "✓ Schlemer stick length recalibrated:",
      schlemerLineLength.toFixed(1)
    );
    return false;
  }
  
  // Elasticity controls for springy visualizer
  if (key === "+" || key === "=") {
    for (let viz of [...visualizers1, ...visualizers2]) {
      if (viz instanceof SpringyBlueSchlemerVisualizer) {
        let newElasticity = viz.getElasticity() + 0.1;
        viz.setElasticity(newElasticity);
        console.log("✓ Elasticity increased:", newElasticity.toFixed(1));
      }
    }
    return false;
  }
  
  if (key === "-" || key === "_") {
    for (let viz of [...visualizers1, ...visualizers2]) {
      if (viz instanceof SpringyBlueSchlemerVisualizer) {
        let newElasticity = viz.getElasticity() - 0.1;
        viz.setElasticity(newElasticity);
        console.log("✓ Elasticity decreased:", newElasticity.toFixed(1));
      }
    }
    return false;
  }

  return true;
}

function keyReleased() {
  // Update global shift state for mouse interactions
  if (keyCode === SHIFT) {
    isShiftDown = false;
  }
}

// === MASK EDITING FUNCTIONS ===

function toggleMaskEditMode() {
  maskEditMode = !maskEditMode;

  if (maskEditMode) {
    // Entering mask edit mode
    console.log("✓ Mask editing ON");
    console.log("  - Click to add points");
    console.log("  - Hold Shift and click/drag to move points");
    console.log("  - Press A to exit");
    console.log("  - Press E to enable/disable mask");
    console.log("  - Press X to clear mask");
    cursor(CROSS);
  } else {
    // Exiting mask edit mode
    saveDetectionMask();
    cursor(ARROW);
    console.log("✓ Mask editing OFF");
  }
}

function drawMaskEditor() {
  if (!video)
    return;

  // Use SCREEN dimensions for fullscreen mask editing
  let screenWidth = width;
  let screenHeight = height;

  let videoSource = video;
  let videoSrcWidth =
    videoSource.elt && videoSource.elt.videoWidth > 0 ? videoSource.elt.videoWidth : videoSource.width;
  let videoSrcHeight =
    videoSource.elt && videoSource.elt.videoHeight > 0
      ? videoSource.elt.videoHeight
      : videoSource.height;

  // Calculate video sizing to fit SCREEN
  let videoAspectRatio = videoSrcWidth / videoSrcHeight;
  let screenAspectRatio = screenWidth / screenHeight;

  let drawWidth, drawHeight;
  if (videoAspectRatio > screenAspectRatio) {
    drawHeight = screenHeight;
    drawWidth = screenHeight * videoAspectRatio;
  } else {
    drawWidth = screenWidth;
    drawHeight = screenWidth / videoAspectRatio;
  }

  // Center within screen
  let videoOffsetX = (screenWidth - drawWidth) / 2;
  let videoOffsetY = (screenHeight - drawHeight) / 2;

  // Scale from video source to screen display
  let scaleX = drawWidth / videoSrcWidth;
  let scaleY = drawHeight / videoSrcHeight;

  // Switch to 2D rendering for mask editor
  push();

  // Reset any WEBGL transforms
  translate(-width / 2, -height / 2);

  // Draw black background for full screen
  fill(0);
  noStroke();
  rect(0, 0, screenWidth, screenHeight);

  // Apply mirror mode if enabled
  if (mirrorMode) {
    translate(screenWidth, 0);
    scale(-1, 1);
  }

  // Draw the video fullscreen
  image(videoSource, videoOffsetX, videoOffsetY, drawWidth, drawHeight);

  // Draw mask polygon in video coordinates (scaled to canvas display)
  if (maskPoints.length > 0) {
    // Draw filled polygon
    fill(0, 255, 0, 50);
    stroke(0, 255, 0);
    strokeWeight(2);
    beginShape();
    for (let pt of maskPoints) {
      vertex(pt.x * scaleX + videoOffsetX, pt.y * scaleY + videoOffsetY);
    }
    endShape(CLOSE);

    // Draw control points
    // After translate(-width/2, -height/2), we're in screen space (0,0 = top-left)
    // Mouse coordinates are already in screen space
    let localMouseX = mouseX;
    let localMouseY = mouseY;

    // Check if mouse is near any point
    let hoveredPoint = -1;
    for (let i = 0; i < maskPoints.length; i++) {
      let pt = maskPoints[i];
      let canvasX = pt.x * scaleX + videoOffsetX;
      let canvasY = pt.y * scaleY + videoOffsetY;
      let d = dist(localMouseX, localMouseY, canvasX, canvasY);
      if (d < 25) {
        hoveredPoint = i;
        break;
      }
    }

    for (let i = 0; i < maskPoints.length; i++) {
      let pt = maskPoints[i];
      let canvasX = pt.x * scaleX + videoOffsetX;
      let canvasY = pt.y * scaleY + videoOffsetY;

      // Highlight hovered or selected points
      if (i === selectedMaskPoint) {
        // Being dragged
        fill(255, 200, 0);
        stroke(255, 200, 0);
        strokeWeight(4);
        circle(canvasX, canvasY, 22);
      } else if (i === hoveredPoint && isShiftDown) {
        // Hovered with Shift held (ready to drag)
        fill(255, 255, 0);
        stroke(255, 255, 0);
        strokeWeight(3);
        circle(canvasX, canvasY, 20);
      } else if (i === hoveredPoint) {
        // Hovered without Shift (highlight only)
        fill(150, 255, 150);
        stroke(150, 255, 150);
        strokeWeight(2);
        circle(canvasX, canvasY, 18);
      } else {
        // Normal state
        fill(0, 255, 0);
        stroke(0, 255, 0);
        strokeWeight(2);
        circle(canvasX, canvasY, 15);
      }
    }

    // Update cursor based on state
    if (selectedMaskPoint !== -1) {
      cursor(HAND);
    } else if (hoveredPoint !== -1 && isShiftDown) {
      cursor(HAND);
    } else {
      cursor(CROSS);
    }
  }

  pop();

  // Store metrics for mouse interaction
  window.maskEditorMetrics = {
    screenWidth,
    screenHeight,
    videoOffsetX,
    videoOffsetY,
    scaleX,
    scaleY,
    mirrorMode,
  };
}

function mousePressed() {
  if (!maskEditMode || !window.maskEditorMetrics) return;

  let {
    videoOffsetX,
    videoOffsetY,
    scaleX,
    scaleY,
  } = window.maskEditorMetrics;

  // Mouse coordinates are already in screen space
  let localMouseX = mouseX;
  let localMouseY = mouseY;

  // Check if Shift is held for dragging mode
  if (isShiftDown) {
    // Check if clicking on existing point to drag
    for (let i = 0; i < maskPoints.length; i++) {
      let pt = maskPoints[i];
      let canvasX = pt.x * scaleX + videoOffsetX;
      let canvasY = pt.y * scaleY + videoOffsetY;
      let d = dist(localMouseX, localMouseY, canvasX, canvasY);
      if (d < 25) {
        selectedMaskPoint = i;
        cursor(HAND);
        console.log(`✓ Grabbed mask point #${i} for dragging`);
        return false;
      }
    }
  } else {
    // Add new point in VIDEO coordinates (convert from canvas coordinates)
    let videoX = (localMouseX - videoOffsetX) / scaleX;
    let videoY = (localMouseY - videoOffsetY) / scaleY;
    maskPoints.push({ x: videoX, y: videoY });
    console.log(
      `✓ Mask point added at video coords (${videoX.toFixed(
        0
      )}, ${videoY.toFixed(0)}) - Total: ${maskPoints.length}`
    );
    return false;
  }
}

function mouseDragged() {
  if (!maskEditMode || !window.maskEditorMetrics) return;

  let {
    videoOffsetX,
    videoOffsetY,
    scaleX,
    scaleY,
  } = window.maskEditorMetrics;

  // Mouse coordinates are already in screen space
  let localMouseX = mouseX;
  let localMouseY = mouseY;

  // Drag selected point in VIDEO coordinates
  if (selectedMaskPoint !== -1 && isShiftDown) {
    let videoX = (localMouseX - videoOffsetX) / scaleX;
    let videoY = (localMouseY - videoOffsetY) / scaleY;
    maskPoints[selectedMaskPoint].x = videoX;
    maskPoints[selectedMaskPoint].y = videoY;
    return false;
  }
}

function mouseReleased() {
  if (!maskEditMode) return;

  selectedMaskPoint = -1;
  cursor(CROSS);
  return false;
}

function saveDetectionMask() {
  const maskData = {
    points: maskPoints,
    enabled: maskEnabled,
  };
  localStorage.setItem("oskar-detection-mask", JSON.stringify(maskData));
  console.log("✓ Mask saved to localStorage");
}

function loadDetectionMask() {
  const saved = localStorage.getItem("oskar-detection-mask");
  if (saved) {
    try {
      const maskData = JSON.parse(saved);
      if (maskData) {
        maskPoints = maskData.points || [];
        maskEnabled = maskData.enabled || false;
        console.log(
          `✓ Mask loaded: ${maskPoints.length} points, enabled: ${maskEnabled}`
        );
      }
    } catch (e) {
      console.error("Error loading mask:", e);
    }
  }
}
