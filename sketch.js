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
let sharedPoseViz;

// Mask editing
let maskEditMode = false;
let selectedMaskPoint = -1;

// Track shift key state for mouse interactions
let isShiftDown = false;

function preload() {
  // Initialize the pose visualizer during preload
  // This ensures ml5's preload hooks work correctly
  sharedPoseViz = new PoseVisualizer();
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

  // Initialize video and model for shared OSKAR instance
  await sharedPoseViz.init();
  await sharedPoseViz.loadModel();
  sharedPoseViz.calculateSchlemerLineLength();
  sharedPoseViz.configureSchlemerConnections();

  // Create wrapper functions to draw to specific graphics buffers
  const poseViz1 = {
    ...sharedPoseViz,
    draw: (w, h) => {
      sharedPoseViz.pg = canvas1;
      sharedPoseViz.draw(w, h);
    },
  };

  const poseViz2 = {
    ...sharedPoseViz,
    draw: (w, h) => {
      sharedPoseViz.pg = canvas2;
      sharedPoseViz.draw(w, h);
    },
  };

  visualizers1 = [
    poseViz1,
    new PlaceholderVisualizer(100, "Placeholder 1", canvas1),
    new PlaceholderVisualizer(150, "Placeholder 2", canvas1),
  ];

  visualizers2 = [
    poseViz2,
    new PlaceholderVisualizer(100, "Placeholder 1", canvas2),
    new PlaceholderVisualizer(150, "Placeholder 2", canvas2),
  ];

  // Set initial visualizers
  viz1 = visualizers1[viz1Index]; // OSKAR
  viz2 = visualizers2[viz2Index]; // Placeholder

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
  console.log("Alt+1 - Cycle Canvas 1 (OSKAR, Placeholder 1, Placeholder 2)");
  console.log("Alt+2 - Cycle Canvas 2 (OSKAR, Placeholder 1, Placeholder 2)");
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
      viz1.draw(canvas1.width, canvas1.height);
      quadMap1.displayTexture(canvas1);
    }

    // Draw Canvas 2
    if (canvas2Visible && viz2) {
      canvas2.background(0);
      viz2.draw(canvas2.width, canvas2.height);
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
      const names = ["OSKAR", "Placeholder 1", "Placeholder 2"];
      console.log(`✓ Canvas 1 → ${names[viz1Index]}`);
      return false;
    }

    if (key === "2" || keyCode === 50) {
      viz2Index = (viz2Index + 1) % visualizers2.length;
      viz2 = visualizers2[viz2Index];
      const names = ["OSKAR", "Placeholder 1", "Placeholder 2"];
      console.log(`✓ Canvas 2 → ${names[viz2Index]}`);
      return false;
    }
  }

  // OSKAR controls - collect unique PoseVisualizer instances
  if (key === "b" || key === "B") {
    const poseInstances = new Set();
    if (
      viz1 instanceof PoseVisualizer ||
      (viz1 && viz1.showVideo !== undefined)
    )
      poseInstances.add(sharedPoseViz);
    if (
      viz2 instanceof PoseVisualizer ||
      (viz2 && viz2.showVideo !== undefined)
    )
      poseInstances.add(sharedPoseViz);

    poseInstances.forEach((viz) => {
      viz.showVideo = !viz.showVideo;
      console.log("✓ Video BG:", viz.showVideo ? "ON" : "OFF");
    });
    return false;
  }

  if (key === "t" || key === "T") {
    const poseInstances = new Set();
    if (
      viz1 instanceof PoseVisualizer ||
      (viz1 && viz1.showSchlemerTrail !== undefined)
    )
      poseInstances.add(sharedPoseViz);
    if (
      viz2 instanceof PoseVisualizer ||
      (viz2 && viz2.showSchlemerTrail !== undefined)
    )
      poseInstances.add(sharedPoseViz);

    poseInstances.forEach((viz) => {
      viz.showSchlemerTrail = !viz.showSchlemerTrail;
      if (!viz.showSchlemerTrail) {
        viz.trailHistory = [];
        viz.trailFrameCounter = 0;
      }
      console.log("✓ Trail:", viz.showSchlemerTrail ? "ON" : "OFF");
    });
    return false;
  }

  if (key === "r" || key === "R") {
    const poseInstances = new Set();
    if (
      viz1 instanceof PoseVisualizer ||
      (viz1 && viz1.calculateSchlemerLineLength)
    )
      poseInstances.add(sharedPoseViz);
    if (
      viz2 instanceof PoseVisualizer ||
      (viz2 && viz2.calculateSchlemerLineLength)
    )
      poseInstances.add(sharedPoseViz);

    poseInstances.forEach((viz) => {
      viz.calculateSchlemerLineLength();
      viz.configureSchlemerConnections();
      console.log("✓ Calibrated");
    });
    return false;
  }

  // Mirror mode toggle
  if (key === "m" || key === "M") {
    if (sharedPoseViz) {
      sharedPoseViz.mirrorMode = !sharedPoseViz.mirrorMode;
      console.log("✓ Mirror mode:", sharedPoseViz.mirrorMode ? "ON" : "OFF");
    }
    return false;
  }

  // Mask editing mode
  if (key === "a" || key === "A") {
    toggleMaskEditMode();
    return false;
  }

  // Enable/disable mask
  if (key === "e" || key === "E") {
    if (sharedPoseViz) {
      sharedPoseViz.maskEnabled = !sharedPoseViz.maskEnabled;
      saveDetectionMask();
      console.log("✓ Mask enabled:", sharedPoseViz.maskEnabled ? "ON" : "OFF");
    }
    return false;
  }

  // Clear mask
  if (key === "x" || key === "X") {
    if (sharedPoseViz) {
      sharedPoseViz.maskPoints = [];
      sharedPoseViz.maskEnabled = false;
      saveDetectionMask();
      console.log("✓ Mask cleared");
    }
    return false;
  }

  // Recalibrate Schlemmer stick lengths
  if (key === "k" || key === "K") {
    if (sharedPoseViz) {
      sharedPoseViz.schlemerLineLength = 0; // Reset to force recalculation
      sharedPoseViz.calculateSchlemerLineLength();
      console.log(
        "✓ Schlemer stick length recalibrated:",
        sharedPoseViz.schlemerLineLength.toFixed(1)
      );
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
  if (!sharedPoseViz || !sharedPoseViz.video || !sharedPoseViz.maskPoints)
    return;

  // Use CANVAS dimensions (1280x720), not screen dimensions!
  let canvasWidth = 1280;
  let canvasHeight = 720;

  let video = sharedPoseViz.video;
  let videoSrcWidth =
    video.elt && video.elt.videoWidth > 0 ? video.elt.videoWidth : video.width;
  let videoSrcHeight =
    video.elt && video.elt.videoHeight > 0
      ? video.elt.videoHeight
      : video.height;

  // Calculate video sizing to fit CANVAS (same as what PoseVisualizer does)
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

  // Center within canvas
  let videoOffsetX = (canvasWidth - drawWidth) / 2;
  let videoOffsetY = (canvasHeight - drawHeight) / 2;

  // Scale from video source to canvas display
  let scaleX = drawWidth / videoSrcWidth;
  let scaleY = drawHeight / videoSrcHeight;

  // Center the canvas on screen
  let screenOffsetX = (width - canvasWidth) / 2;
  let screenOffsetY = (height - canvasHeight) / 2;

  // Switch to 2D rendering for mask editor
  push();

  // Reset any WEBGL transforms
  translate(-width / 2, -height / 2);

  // Move to centered canvas position
  translate(screenOffsetX, screenOffsetY);

  // Draw black background for canvas area
  fill(0);
  noStroke();
  rect(0, 0, canvasWidth, canvasHeight);

  // Draw the video at canvas size
  image(sharedPoseViz.video, videoOffsetX, videoOffsetY, drawWidth, drawHeight);

  // Draw mask polygon in video coordinates (scaled to canvas display)
  if (sharedPoseViz.maskPoints.length > 0) {
    // Draw filled polygon
    fill(0, 255, 0, 50);
    stroke(0, 255, 0);
    strokeWeight(2);
    beginShape();
    for (let pt of sharedPoseViz.maskPoints) {
      vertex(pt.x * scaleX + videoOffsetX, pt.y * scaleY + videoOffsetY);
    }
    endShape(CLOSE);

    // Draw control points
    // After translate(-width/2, -height/2), we're in screen space (0,0 = top-left)
    // After translate(screenOffsetX, screenOffsetY), canvas starts at (screenOffsetX, screenOffsetY)
    // So mouse in canvas-local coords is just: mouse - screenOffset
    let localMouseX = mouseX - screenOffsetX;
    let localMouseY = mouseY - screenOffsetY;

    // Check if mouse is near any point
    let hoveredPoint = -1;
    for (let i = 0; i < sharedPoseViz.maskPoints.length; i++) {
      let pt = sharedPoseViz.maskPoints[i];
      let canvasX = pt.x * scaleX + videoOffsetX;
      let canvasY = pt.y * scaleY + videoOffsetY;
      let d = dist(localMouseX, localMouseY, canvasX, canvasY);
      if (d < 25) {
        hoveredPoint = i;
        break;
      }
    }

    for (let i = 0; i < sharedPoseViz.maskPoints.length; i++) {
      let pt = sharedPoseViz.maskPoints[i];
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
    canvasWidth,
    canvasHeight,
    videoOffsetX,
    videoOffsetY,
    scaleX,
    scaleY,
    screenOffsetX,
    screenOffsetY,
  };
}

function mousePressed() {
  if (!maskEditMode || !sharedPoseViz || !window.maskEditorMetrics) return;

  let {
    videoOffsetX,
    videoOffsetY,
    scaleX,
    scaleY,
    screenOffsetX,
    screenOffsetY,
  } = window.maskEditorMetrics;

  // Convert mouse position to canvas-local coordinates
  let localMouseX = mouseX - screenOffsetX;
  let localMouseY = mouseY - screenOffsetY;

  // Check if Shift is held for dragging mode
  if (isShiftDown) {
    // Check if clicking on existing point to drag
    for (let i = 0; i < sharedPoseViz.maskPoints.length; i++) {
      let pt = sharedPoseViz.maskPoints[i];
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
    sharedPoseViz.maskPoints.push({ x: videoX, y: videoY });
    console.log(
      `✓ Mask point added at video coords (${videoX.toFixed(
        0
      )}, ${videoY.toFixed(0)}) - Total: ${sharedPoseViz.maskPoints.length}`
    );
    return false;
  }
}

function mouseDragged() {
  if (!maskEditMode || !sharedPoseViz || !window.maskEditorMetrics) return;

  let {
    videoOffsetX,
    videoOffsetY,
    scaleX,
    scaleY,
    screenOffsetX,
    screenOffsetY,
  } = window.maskEditorMetrics;

  // Convert mouse position to canvas-local coordinates
  let localMouseX = mouseX - screenOffsetX;
  let localMouseY = mouseY - screenOffsetY;

  // Drag selected point in VIDEO coordinates
  if (selectedMaskPoint !== -1 && isShiftDown) {
    let videoX = (localMouseX - videoOffsetX) / scaleX;
    let videoY = (localMouseY - videoOffsetY) / scaleY;
    sharedPoseViz.maskPoints[selectedMaskPoint].x = videoX;
    sharedPoseViz.maskPoints[selectedMaskPoint].y = videoY;
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
  if (!sharedPoseViz) return;

  const maskData = {
    points: sharedPoseViz.maskPoints,
    enabled: sharedPoseViz.maskEnabled,
  };
  localStorage.setItem("oskar-detection-mask", JSON.stringify(maskData));
  console.log("✓ Mask saved to localStorage");
}

function loadDetectionMask() {
  if (!sharedPoseViz) return;

  const saved = localStorage.getItem("oskar-detection-mask");
  if (saved) {
    try {
      const maskData = JSON.parse(saved);
      sharedPoseViz.loadMask(maskData);
    } catch (e) {
      console.error("Error loading mask:", e);
    }
  }
}
