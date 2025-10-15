/*
 * 👋 Hello! This is an ml5.js example made and shared with ❤️.
 * Learn more about the ml5.js project: https://ml5js.org/
 * ml5.js license and Code of Conduct: https://github.com/ml5js/ml5-next-gen/blob/main/LICENSE.md
 *
 * This example demonstrates drawing skeletons on poses for the MoveNet model.
 */
let video;
let bodyPose;
let poses = [];
let connections;
let schlemerConnections = []; // Store the random connection pairs
let schlemerLineLength = 0; // Total length of each Schlemer line

// Smoothing parameters
let smoothingFactor = 0.5; // Range: 0-1. Lower = smoother but more lag, Higher = more responsive
let previousPoses = []; // Store previous poses for smoothing

// Visibility toggles
let showSkeleton = true; // Toggle for skeleton connections and keypoints
let showSchlemer = true; // Toggle for Schlemer connections
let showEllipses = false; // Toggle for sequential ellipses
let showVideo = true; // Toggle for video background
let showUnifiedContour = false; // Toggle for unified offset ellipse contour

// Fill toggles for ellipses
let fillEllipses = false; // Toggle fill for E ellipses
let fillUnifiedContour = false; // Toggle fill for X ellipses

async function setup() {
  createCanvas(windowWidth, windowHeight);

  // Create the video and hide it
  video = createCapture(VIDEO);
  video.hide();

  // Wait for video to load to get its dimensions
  video.elt.addEventListener("loadedmetadata", () => {
    videoResize();
  });

  // Load the bodyPose model using async/await
  bodyPose = await ml5.bodyPose();

  // Start detecting poses in the webcam video
  bodyPose.detectStart(video, gotPoses);

  // Get the skeleton connection information
  connections = bodyPose.getSkeleton();
}

function draw() {
  background(0);

  // Mirror the canvas
  push();
  translate(width, 0);
  scale(-1, 1);

  // Center the video on canvas
  let offsetX = (width - video.width) / 2;
  let offsetY = (height - video.height) / 2;

  // Draw the webcam video (if enabled) or keep black background
  if (showVideo) {
    image(video, offsetX, offsetY);
  }

  // Draw skeleton connections and keypoints (if enabled)
  if (showSkeleton) {
    drawConnections(offsetX, offsetY); // Draw the skeleton connections
    drawKeypoints(offsetX, offsetY); // Draw the keypoints
  }

  // Draw Schlemer sticks (if enabled)
  if (showSchlemer) {
    drawSchlemerSticks(offsetX, offsetY); // Draw the Schlemer connections
  }

  // Draw sequential ellipses (if enabled)
  if (showEllipses) {
    drawSequentialEllipses(offsetX, offsetY);
  }

  // Draw unified offset contour (if enabled)
  if (showUnifiedContour) {
    drawUnifiedContour(offsetX, offsetY);
  }

  pop();
}

function drawSchlemerSticks(offsetX, offsetY) {
  // Draw the stored connections
  if (schlemerLineLength === 0) return; // Don't draw if length not calculated yet

  for (let i = 0; i < poses.length; i++) {
    let pose = poses[i];

    for (let j = 0; j < schlemerConnections.length; j++) {
      let lowerIndex = schlemerConnections[j].lower;
      let upperIndex = schlemerConnections[j].upper;
      let isCentered = schlemerConnections[j].centered;

      let point1 = pose.keypoints[lowerIndex];
      let point2 = pose.keypoints[upperIndex];

      // Only draw a line if both points are confident enough
      if (point1.confidence > 0.1 && point2.confidence > 0.1) {
        let startX, startY, endX, endY;

        if (isCentered) {
          // For centered connections: line is centered between the two points
          // Calculate center point
          let centerX = (point1.x + point2.x) / 2;
          let centerY = (point1.y + point2.y) / 2;

          // Calculate direction vector from point1 to point2
          let dirX = point2.x - point1.x;
          let dirY = point2.y - point1.y;

          // Normalize the direction vector
          let dirLength = sqrt(dirX * dirX + dirY * dirY);
          if (dirLength > 0) {
            dirX /= dirLength;
            dirY /= dirLength;

            // Line extends half the total length in each direction from center
            let halfLength = schlemerLineLength / 2;
            startX = centerX - dirX * halfLength;
            startY = centerY - dirY * halfLength;
            endX = centerX + dirX * halfLength;
            endY = centerY + dirY * halfLength;
          } else {
            continue; // Skip if points are at the same location
          }
        } else {
          // For non-centered connections: line starts from lower body and extends through upper
          // Calculate direction vector from lower to upper body
          let dirX = point2.x - point1.x;
          let dirY = point2.y - point1.y;

          // Normalize the direction vector
          let dirLength = sqrt(dirX * dirX + dirY * dirY);
          if (dirLength > 0) {
            dirX /= dirLength;
            dirY /= dirLength;

            // Line starts at lower body point and extends to total length
            startX = point1.x;
            startY = point1.y;
            endX = point1.x + dirX * schlemerLineLength;
            endY = point1.y + dirY * schlemerLineLength;
          } else {
            continue; // Skip if points are at the same location
          }
        }

        stroke(255);
        strokeWeight(6);
        line(
          startX + offsetX,
          startY + offsetY,
          endX + offsetX,
          endY + offsetY
        );
      }
    }
  }
}

function calculateSchlemerLineLength() {
  // Calculate line length as 1.5 * distance from ankle to nose
  if (poses.length === 0) return;

  let pose = poses[0];
  let nose = pose.keypoints[0]; // Nose is typically index 0
  let leftAnkle = pose.keypoints[15]; // Left ankle
  let rightAnkle = pose.keypoints[16]; // Right ankle

  // Check if keypoints are confident
  if (
    nose.confidence > 0.1 &&
    (leftAnkle.confidence > 0.1 || rightAnkle.confidence > 0.1)
  ) {
    // Use the ankle with higher confidence, or average if both are confident
    let ankleX, ankleY;
    if (leftAnkle.confidence > 0.1 && rightAnkle.confidence > 0.1) {
      // Average both ankles
      ankleX = (leftAnkle.x + rightAnkle.x) / 2;
      ankleY = (leftAnkle.y + rightAnkle.y) / 2;
    } else if (leftAnkle.confidence > 0.1) {
      ankleX = leftAnkle.x;
      ankleY = leftAnkle.y;
    } else {
      ankleX = rightAnkle.x;
      ankleY = rightAnkle.y;
    }

    // Calculate distance from ankle to nose
    let dx = nose.x - ankleX;
    let dy = nose.y - ankleY;
    let distance = sqrt(dx * dx + dy * dy);

    // Set line length to 1.5 times this distance
    schlemerLineLength = distance * 1.5;
  }
}

function configureSchlemerConnections() {
  // Fixed connection pairs
  // First 8 connections: lower body -> upper body (line extends beyond upper)
  // Last 2 connections: upper body -> upper body (line centered between both)
  schlemerConnections = [
    { lower: 16, upper: 12, centered: false }, // 1. Right ankle -> Right hip
    { lower: 16, upper: 8, centered: false }, // 2. Right ankle -> Right wrist
    { lower: 14, upper: 8, centered: false }, // 3. Right knee -> Right wrist
    { lower: 14, upper: 6, centered: false }, // 4. Right knee -> Right shoulder
    { lower: 15, upper: 11, centered: false }, // 5. Left ankle -> Left hip
    { lower: 15, upper: 7, centered: false }, // 6. Left ankle -> Left wrist
    { lower: 13, upper: 7, centered: false }, // 7. Left knee -> Left wrist
    { lower: 13, upper: 5, centered: false }, // 8. Left knee -> Left shoulder
    { lower: 8, upper: 6, centered: true }, // 9. Right wrist -> Right shoulder (centered)
    { lower: 7, upper: 5, centered: true }, // 10. Left wrist -> Left shoulder (centered)
  ];
}

function drawConnections(offsetX, offsetY) {
  for (let i = 0; i < poses.length; i++) {
    let pose = poses[i];
    for (let j = 0; j < connections.length; j++) {
      let pointAIndex = connections[j][0];
      let pointBIndex = connections[j][1];
      let pointA = pose.keypoints[pointAIndex];
      let pointB = pose.keypoints[pointBIndex];
      // Only draw a line if both points are confident enough
      if (pointA.confidence > 0.1 && pointB.confidence > 0.1) {
        stroke(200);
        strokeWeight(0.5);
        line(
          pointA.x + offsetX,
          pointA.y + offsetY,
          pointB.x + offsetX,
          pointB.y + offsetY
        );
      }
    }
  }
}

function drawKeypoints(offsetX, offsetY) {
  for (let i = 0; i < poses.length; i++) {
    let pose = poses[i];
    for (let j = 0; j < pose.keypoints.length; j++) {
      let keypoint = pose.keypoints[j];
      // Only draw a circle if the keypoint's confidence is bigger than 0.1
      if (keypoint.confidence > 0.1) {
        fill(200);
        noStroke();
        circle(keypoint.x + offsetX, keypoint.y + offsetY, 4);
      }
    }
  }
}

function drawSequentialEllipses(offsetX, offsetY) {
  // Draw ellipses along skeleton segments
  for (let i = 0; i < poses.length; i++) {
    let pose = poses[i];

    // Special case: Head ellipse from left ear (3) to right ear (4)
    // This one uses inverted proportions (minor axis is larger)
    let leftEar = pose.keypoints[3];
    let rightEar = pose.keypoints[4];

    if (leftEar.confidence > 0.1 && rightEar.confidence > 0.1) {
      drawEllipseSegment(leftEar, rightEar, offsetX, offsetY, true);
    }

    // Draw ellipses for all skeleton connections (excluding face connections)
    for (let j = 0; j < connections.length; j++) {
      let pointAIndex = connections[j][0];
      let pointBIndex = connections[j][1];

      // Skip face connections (nose=0, eyes=1,2, ears=3,4)
      // Only allow connections that don't involve indices 0, 1, 2
      let isFaceConnection = pointAIndex <= 2 || pointBIndex <= 2;

      if (!isFaceConnection) {
        let pointA = pose.keypoints[pointAIndex];
        let pointB = pose.keypoints[pointBIndex];

        // Only draw if both points are confident
        if (pointA.confidence > 0.1 && pointB.confidence > 0.1) {
          drawEllipseSegment(pointA, pointB, offsetX, offsetY, false);
        }
      }
    }
  }
}

function drawEllipseSegment(
  point1,
  point2,
  offsetX,
  offsetY,
  inverted = false
) {
  // Calculate center point between the two keypoints
  let centerX = (point1.x + point2.x) / 2;
  let centerY = (point1.y + point2.y) / 2;

  // Calculate distance between points
  let dx = point2.x - point1.x;
  let dy = point2.y - point1.y;
  let distance = sqrt(dx * dx + dy * dy);

  let majorAxis, minorAxis;

  if (inverted) {
    // For ear-to-ear: distance is the minor axis, major is perpendicular and larger
    minorAxis = distance;
    majorAxis = distance * 1.618;
  } else {
    // For body segments: distance is the major axis
    majorAxis = distance;
    minorAxis = distance / 1.618;
  }

  // Calculate angle of rotation (angle of the line between points)
  let angle = atan2(dy, dx);

  // Draw the ellipse
  push();
  translate(centerX + offsetX, centerY + offsetY);
  rotate(angle);

  // Apply fill based on toggle
  if (fillEllipses) {
    fill(255);
    noStroke();
  } else {
    noFill();
    stroke(255);
    strokeWeight(1);
  }

  ellipse(0, 0, majorAxis, minorAxis);

  pop();
}

function drawUnifiedContour(offsetX, offsetY) {
  // Draw offset ellipses that create a unified outer contour
  // All ellipses are scaled by 1.618× to create an expanded outer boundary

  for (let i = 0; i < poses.length; i++) {
    let pose = poses[i];

    // Special case: Head ellipse from left ear to right ear with offset
    let leftEar = pose.keypoints[3];
    let rightEar = pose.keypoints[4];

    if (leftEar.confidence > 0.1 && rightEar.confidence > 0.1) {
      drawOffsetEllipseSegment(leftEar, rightEar, offsetX, offsetY, true);
    }

    // Draw offset ellipses for all skeleton connections (excluding face)
    for (let j = 0; j < connections.length; j++) {
      let pointAIndex = connections[j][0];
      let pointBIndex = connections[j][1];

      // Skip face connections (nose=0, eyes=1,2)
      let isFaceConnection = pointAIndex <= 2 || pointBIndex <= 2;

      if (!isFaceConnection) {
        let pointA = pose.keypoints[pointAIndex];
        let pointB = pose.keypoints[pointBIndex];

        // Only draw if both points are confident
        if (pointA.confidence > 0.1 && pointB.confidence > 0.1) {
          drawOffsetEllipseSegment(pointA, pointB, offsetX, offsetY, false);
        }
      }
    }
  }
}

function drawOffsetEllipseSegment(
  point1,
  point2,
  offsetX,
  offsetY,
  inverted = false
) {
  // Calculate center point between the two keypoints
  let centerX = (point1.x + point2.x) / 2;
  let centerY = (point1.y + point2.y) / 2;

  // Calculate distance between points
  let dx = point2.x - point1.x;
  let dy = point2.y - point1.y;
  let distance = sqrt(dx * dx + dy * dy);

  let majorAxis, minorAxis;
  let offsetMultiplier = 1.618; // Offset factor to expand ellipses

  if (inverted) {
    // For ear-to-ear: distance is the minor axis, major is perpendicular and larger
    minorAxis = distance;
    majorAxis = distance * 1.618;
  } else {
    // For body segments: distance is the major axis
    majorAxis = distance;
    minorAxis = distance / 1.618;
  }

  // Apply offset: multiply both axes by 1.618 to expand outward
  majorAxis *= offsetMultiplier;
  minorAxis *= offsetMultiplier;

  // Calculate angle of rotation (angle of the line between points)
  let angle = atan2(dy, dx);

  // Draw the offset ellipse
  push();
  translate(centerX + offsetX, centerY + offsetY);
  rotate(angle);

  // Apply fill based on toggle
  if (fillUnifiedContour) {
    fill(255);
    noStroke();
  } else {
    noFill();
    stroke(255);
    strokeWeight(1);
  }

  ellipse(0, 0, majorAxis, minorAxis);

  pop();
}

/**
 * Smooth keypoint positions using exponential moving average
 *
 * @param {Array} newPoses - Array of new pose detections from ml5
 * @param {Number} factor - Smoothing factor (0-1)
 *   - 0.0 = Maximum smoothing (very smooth but very laggy)
 *   - 0.5 = Balanced (default, good for most cases)
 *   - 1.0 = No smoothing (instant response but jittery)
 *
 * Formula: smoothedValue = previousValue * (1 - factor) + newValue * factor
 *
 * @returns {Array} Smoothed poses
 */
function smoothPoses(newPoses, factor) {
  // If no previous poses, return new poses as-is
  if (previousPoses.length === 0) {
    return newPoses;
  }

  let smoothedPoses = [];

  for (let i = 0; i < newPoses.length; i++) {
    let newPose = newPoses[i];
    let smoothedPose = { keypoints: [] };

    // If we have a previous pose for this person, smooth it
    let prevPose = previousPoses[i];

    if (prevPose) {
      for (let j = 0; j < newPose.keypoints.length; j++) {
        let newKp = newPose.keypoints[j];
        let prevKp = prevPose.keypoints[j];

        // Apply exponential smoothing to x, y coordinates
        let smoothedKp = {
          x: prevKp.x * (1 - factor) + newKp.x * factor,
          y: prevKp.y * (1 - factor) + newKp.y * factor,
          confidence: newKp.confidence, // Don't smooth confidence
          name: newKp.name,
        };

        smoothedPose.keypoints.push(smoothedKp);
      }
    } else {
      // No previous data for this pose, use new data as-is
      smoothedPose = newPose;
    }

    smoothedPoses.push(smoothedPose);
  }

  return smoothedPoses;
}

// Callback function for when bodyPose outputs data
function gotPoses(results) {
  // Apply smoothing to the poses
  let smoothedResults = smoothPoses(results, smoothingFactor);

  // Save the smoothed output to the poses variable
  poses = smoothedResults;

  // Update previous poses for next frame
  previousPoses = JSON.parse(JSON.stringify(smoothedResults)); // Deep copy

  // Calculate line length and configure connections once when poses are first detected
  if (schlemerLineLength === 0 && poses.length > 0) {
    calculateSchlemerLineLength();
    configureSchlemerConnections();
  }
}

function videoResize() {
  let videoAspectRatio = video.width / video.height;
  let canvasAspectRatio = windowWidth / windowHeight;

  let drawWidth, drawHeight;

  if (videoAspectRatio > canvasAspectRatio) {
    // Fit to height
    drawHeight = windowHeight;
    drawWidth = windowHeight * videoAspectRatio;
  } else {
    // Fit to width
    drawWidth = windowWidth;
    drawHeight = windowWidth / videoAspectRatio;
  }

  video.size(drawWidth, drawHeight);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  videoResize();
}

// Handle double click to toggle fullscreen
function doubleClicked() {
  let fs = fullscreen();
  fullscreen(!fs);
}

// Handle key press to configure Schlemer connections
function keyPressed() {
  if (key === "r" || key === "R") {
    configureSchlemerConnections();
    // Also toggle fill for E ellipses
    fillEllipses = !fillEllipses;
    console.log(
      "E ellipses fill:",
      fillEllipses ? "ON (solid)" : "OFF (stroke)"
    );
  }
  if (key === "c" || key === "C") {
    calculateSchlemerLineLength();
    // Also toggle fill for X ellipses
    fillUnifiedContour = !fillUnifiedContour;
    console.log(
      "X ellipses fill:",
      fillUnifiedContour ? "ON (solid)" : "OFF (stroke)"
    );
  }

  // Toggle visibility
  if (key === "s" || key === "S") {
    showSkeleton = !showSkeleton;
    console.log("Skeleton visibility:", showSkeleton ? "ON" : "OFF");
  }
  if (key === "o" || key === "O") {
    showSchlemer = !showSchlemer;
    console.log(
      "Schlemer connections visibility:",
      showSchlemer ? "ON" : "OFF"
    );
  }
  if (key === "e" || key === "E") {
    showEllipses = !showEllipses;
    console.log("Sequential ellipses visibility:", showEllipses ? "ON" : "OFF");
  }
  if (key === "b" || key === "B") {
    showVideo = !showVideo;
    console.log("Video background:", showVideo ? "ON" : "OFF");
  }
  if (key === "x" || key === "X") {
    showUnifiedContour = !showUnifiedContour;
    console.log(
      "Unified contour visibility:",
      showUnifiedContour ? "ON" : "OFF"
    );
  }

  // Adjust smoothing factor
  if (key === "+" || key === "=") {
    smoothingFactor = min(smoothingFactor + 0.1, 1.0);
    console.log("Smoothing factor:", smoothingFactor.toFixed(2));
  }
  if (key === "-" || key === "_") {
    smoothingFactor = max(smoothingFactor - 0.1, 0.0);
    console.log("Smoothing factor:", smoothingFactor.toFixed(2));
  }
}
