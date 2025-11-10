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

// Mask editing
let maskEditMode = false;
let selectedMaskPoint = -1;

// Track shift key state for mouse interactions
let isShiftDown = false;

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
    new WhiteSchlemerVisualizer(canvas1),   // White (original)
    new RedSchlemerVisualizer(canvas1),     // Red
    new BlueSchlemerVisualizer(canvas1),    // Blue
  ];

  visualizers2 = [
    new WhiteSchlemerVisualizer(canvas2),   // White (original)
    new RedSchlemerVisualizer(canvas2),     // Red
    new BlueSchlemerVisualizer(canvas2),    // Blue
  ];

  // Set initial visualizers
  viz1 = visualizers1[viz1Index]; // White
  viz2 = visualizers2[viz2Index]; // Red

  // Load saved calibration
  pMapper.load("maps/map.json");

  // Load saved detection mask
  loadDetectionMask();

  console.log("\n=== OSKAR Dual Canvas System with p5.mapper ===");
  console.log("\n=== Projection Mapping ===");
  console.log("C - Toggle calibration mode (drag corners to map)");
  console.log("S - Save current mapping");
  console.log("L - Load saved mapping");
  console.log("F - Toggle fullscreen");
  console.log("\n=== Canvas Visibility ===");
  console.log("Shift+1 - Show/Hide Canvas 1");
  console.log("Shift+2 - Show/Hide Canvas 2");
  console.log("\n=== Visualizer Controls ===");
  console.log("Alt+1 - Cycle Canvas 1 (White, Red, Blue)");
  console.log("Alt+2 - Cycle Canvas 2 (White, Red, Blue)");
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

function draw() {
  background(0);

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
      const names = ["White", "Red", "Blue"];
      console.log(`✓ Canvas 1 → ${names[viz1Index]}`);
      return false;
    }

    if (key === "2" || keyCode === 50) {
      viz2Index = (viz2Index + 1) % visualizers2.length;
      viz2 = visualizers2[viz2Index];
      const names = ["White", "Red", "Blue"];
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
