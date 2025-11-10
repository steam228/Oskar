/**
 * PoseVisualizer - Handles all pose detection and visualization
 * BACKUP OF FULL VERSION with all features
 */
class PoseVisualizerFull {
  constructor() {
    this.video = null;
    this.bodyPose = null;
    this.poses = [];
    this.connections = [];
    this.schlemerConnections = [];
    this.schlemerLineLength = 0;
    this.previousPoses = [];

    // Trail/Drag parameters
    this.trailHistory = [];
    this.trailMaxFrames = 60;
    this.trailInterval = 3;
    this.trailFrameCounter = 0;

    // Visibility toggles
    this.showSkeleton = true;
    this.showSchlemer = true;
    this.showSchlemerTrail = false;
    this.showEllipses = false;
    this.showVideo = true;
    this.showUnifiedContour = false;

    // Mirror mode
    this.mirrorMode = true;

    // Fill toggles
    this.fillEllipses = false;
    this.fillUnifiedContour = false;

    // Smoothing
    this.smoothingFactor = 0.5;

    // Detection mask
    this.maskPoints = [];
    this.maskEnabled = false;
  }

  async init() {
    // Create the video and hide it
    this.video = createCapture(VIDEO);
    this.video.hide();

    // Wait for video to load
    return new Promise((resolve) => {
      this.video.elt.addEventListener("loadedmetadata", () => {
        this.videoResize();
        resolve();
      });
    });
  }

  async loadModel() {
    // Load the bodyPose model
    this.bodyPose = await ml5.bodyPose();
    this.bodyPose.detectStart(this.video, (results) => this.gotPoses(results));
    this.connections = this.bodyPose.getSkeleton();
  }

  videoResize() {
    let videoAspectRatio = this.video.width / this.video.height;
    let canvasAspectRatio = windowWidth / windowHeight;

    let drawWidth, drawHeight;

    if (videoAspectRatio > canvasAspectRatio) {
      drawHeight = windowHeight;
      drawWidth = windowHeight * videoAspectRatio;
    } else {
      drawWidth = windowWidth;
      drawHeight = windowWidth / videoAspectRatio;
    }

    this.video.size(drawWidth, drawHeight);
  }

  loadMask(maskData) {
    if (maskData) {
      this.maskPoints = maskData.points || [];
      this.maskEnabled = maskData.enabled || false;
    }
  }

  draw(canvasWidth, canvasHeight) {
    push();

    // Apply mirror transform if in mirror mode
    if (this.mirrorMode) {
      translate(canvasWidth, 0);
      scale(-1, 1);
    }

    // Apply clipping mask if enabled
    if (this.maskEnabled && this.maskPoints.length >= 3) {
      drawingContext.save();
      drawingContext.beginPath();

      for (let i = 0; i < this.maskPoints.length; i++) {
        let px = this.maskPoints[i].x;
        let py = this.maskPoints[i].y;

        if (i === 0) {
          drawingContext.moveTo(px, py);
        } else {
          drawingContext.lineTo(px, py);
        }
      }
      drawingContext.closePath();
      drawingContext.clip();
    }

    // Center the video on canvas
    let offsetX = (canvasWidth - this.video.width) / 2;
    let offsetY = (canvasHeight - this.video.height) / 2;

    // Draw the webcam video
    if (this.showVideo) {
      image(this.video, offsetX, offsetY);
    }

    // Draw skeleton connections and keypoints
    if (this.showSkeleton) {
      this.drawConnections(offsetX, offsetY);
      this.drawKeypoints(offsetX, offsetY);
    }

    // Draw Schlemer sticks
    if (this.showSchlemer) {
      this.drawSchlemerSticks(offsetX, offsetY);
    }

    // Draw Schlemer trail
    if (this.showSchlemerTrail) {
      this.drawSchlemerTrail(offsetX, offsetY);
    }

    // Draw sequential ellipses
    if (this.showEllipses) {
      this.drawSequentialEllipses(offsetX, offsetY);
    }

    // Draw unified offset contour
    if (this.showUnifiedContour) {
      this.drawUnifiedContour(offsetX, offsetY);
    }

    // Restore context if clipping was applied
    if (this.maskEnabled && this.maskPoints.length >= 3) {
      drawingContext.restore();
    }

    pop();
  }

  // All the drawing methods from original sketch.js
  drawSchlemerSticks(offsetX, offsetY) {
    if (this.schlemerLineLength === 0) return;

    for (let i = 0; i < this.poses.length; i++) {
      let pose = this.poses[i];

      for (let j = 0; j < this.schlemerConnections.length; j++) {
        let lowerIndex = this.schlemerConnections[j].lower;
        let upperIndex = this.schlemerConnections[j].upper;
        let isCentered = this.schlemerConnections[j].centered;
        let lengthRatio = this.schlemerConnections[j].lengthRatio;

        let point1 = pose.keypoints[lowerIndex];
        let point2 = pose.keypoints[upperIndex];
        let actualLineLength = this.schlemerLineLength * lengthRatio;

        if (point1.confidence > 0.1 && point2.confidence > 0.1) {
          let startX, startY, endX, endY;

          if (isCentered) {
            let centerX = (point1.x + point2.x) / 2;
            let centerY = (point1.y + point2.y) / 2;
            let dirX = point2.x - point1.x;
            let dirY = point2.y - point1.y;
            let dirLength = sqrt(dirX * dirX + dirY * dirY);

            if (dirLength > 0) {
              dirX /= dirLength;
              dirY /= dirLength;
              let halfLength = actualLineLength / 2;
              startX = centerX - dirX * halfLength;
              startY = centerY - dirY * halfLength;
              endX = centerX + dirX * halfLength;
              endY = centerY + dirY * halfLength;
            } else {
              continue;
            }
          } else {
            let dirX = point2.x - point1.x;
            let dirY = point2.y - point1.y;
            let dirLength = sqrt(dirX * dirX + dirY * dirY);

            if (dirLength > 0) {
              dirX /= dirLength;
              dirY /= dirLength;
              startX = point1.x;
              startY = point1.y;
              endX = point1.x + dirX * actualLineLength;
              endY = point1.y + dirY * actualLineLength;
            } else {
              continue;
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

  drawSchlemerTrail(offsetX, offsetY) {
    if (this.schlemerLineLength === 0 || this.poses.length === 0) return;

    this.trailFrameCounter++;

    if (this.trailFrameCounter >= this.trailInterval) {
      this.trailFrameCounter = 0;
      this.captureTrailSnapshot();
    }

    for (let t = this.trailHistory.length - 1; t >= 0; t--) {
      let trailItem = this.trailHistory[t];
      trailItem.age++;

      if (trailItem.age > this.trailMaxFrames) {
        this.trailHistory.splice(t, 1);
        continue;
      }

      let fadeFactor = 1 - trailItem.age / this.trailMaxFrames;
      let opacity = fadeFactor * 255;
      let weight = fadeFactor * 6;

      for (let stick of trailItem.sticks) {
        stroke(255, opacity);
        strokeWeight(weight);
        line(
          stick.startX + offsetX,
          stick.startY + offsetY,
          stick.endX + offsetX,
          stick.endY + offsetY
        );
      }
    }
  }

  captureTrailSnapshot() {
    if (this.poses.length === 0 || this.schlemerLineLength === 0) return;

    let snapshot = { age: 0, sticks: [] };

    for (let i = 0; i < this.poses.length; i++) {
      let pose = this.poses[i];

      for (let j = 0; j < this.schlemerConnections.length; j++) {
        let lowerIndex = this.schlemerConnections[j].lower;
        let upperIndex = this.schlemerConnections[j].upper;
        let isCentered = this.schlemerConnections[j].centered;
        let lengthRatio = this.schlemerConnections[j].lengthRatio;
        let point1 = pose.keypoints[lowerIndex];
        let point2 = pose.keypoints[upperIndex];
        let actualLineLength = this.schlemerLineLength * lengthRatio;

        if (point1.confidence > 0.1 && point2.confidence > 0.1) {
          let startX, startY, endX, endY;

          if (isCentered) {
            let centerX = (point1.x + point2.x) / 2;
            let centerY = (point1.y + point2.y) / 2;
            let dirX = point2.x - point1.x;
            let dirY = point2.y - point1.y;
            let dirLength = sqrt(dirX * dirX + dirY * dirY);

            if (dirLength > 0) {
              dirX /= dirLength;
              dirY /= dirLength;
              let halfLength = actualLineLength / 2;
              startX = centerX - dirX * halfLength;
              startY = centerY - dirY * halfLength;
              endX = centerX + dirX * halfLength;
              endY = centerY + dirY * halfLength;
            } else {
              continue;
            }
          } else {
            let dirX = point2.x - point1.x;
            let dirY = point2.y - point1.y;
            let dirLength = sqrt(dirX * dirX + dirY * dirY);

            if (dirLength > 0) {
              dirX /= dirLength;
              dirY /= dirLength;
              startX = point1.x;
              startY = point1.y;
              endX = point1.x + dirX * actualLineLength;
              endY = point1.y + dirY * actualLineLength;
            } else {
              continue;
            }
          }

          snapshot.sticks.push({ startX, startY, endX, endY });
        }
      }
    }

    if (snapshot.sticks.length > 0) {
      this.trailHistory.push(snapshot);
    }
  }

  drawConnections(offsetX, offsetY) {
    for (let i = 0; i < this.poses.length; i++) {
      let pose = this.poses[i];
      for (let j = 0; j < this.connections.length; j++) {
        let pointAIndex = this.connections[j][0];
        let pointBIndex = this.connections[j][1];
        let pointA = pose.keypoints[pointAIndex];
        let pointB = pose.keypoints[pointBIndex];

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

  drawKeypoints(offsetX, offsetY) {
    for (let i = 0; i < this.poses.length; i++) {
      let pose = this.poses[i];
      for (let j = 0; j < pose.keypoints.length; j++) {
        let keypoint = pose.keypoints[j];
        if (keypoint.confidence > 0.1) {
          fill(200);
          noStroke();
          circle(keypoint.x + offsetX, keypoint.y + offsetY, 4);
        }
      }
    }
  }

  drawSequentialEllipses(offsetX, offsetY) {
    for (let i = 0; i < this.poses.length; i++) {
      let pose = this.poses[i];
      let leftEar = pose.keypoints[3];
      let rightEar = pose.keypoints[4];

      if (leftEar.confidence > 0.1 && rightEar.confidence > 0.1) {
        this.drawEllipseSegment(leftEar, rightEar, offsetX, offsetY, true);
      }

      for (let j = 0; j < this.connections.length; j++) {
        let pointAIndex = this.connections[j][0];
        let pointBIndex = this.connections[j][1];
        let isFaceConnection = pointAIndex <= 2 || pointBIndex <= 2;

        if (!isFaceConnection) {
          let pointA = pose.keypoints[pointAIndex];
          let pointB = pose.keypoints[pointBIndex];

          if (pointA.confidence > 0.1 && pointB.confidence > 0.1) {
            this.drawEllipseSegment(pointA, pointB, offsetX, offsetY, false);
          }
        }
      }
    }
  }

  drawEllipseSegment(point1, point2, offsetX, offsetY, inverted = false) {
    let centerX = (point1.x + point2.x) / 2;
    let centerY = (point1.y + point2.y) / 2;
    let dx = point2.x - point1.x;
    let dy = point2.y - point1.y;
    let distance = sqrt(dx * dx + dy * dy);
    let majorAxis, minorAxis;

    if (inverted) {
      minorAxis = distance;
      majorAxis = distance * 1.618;
    } else {
      majorAxis = distance;
      minorAxis = distance / 1.618;
    }

    let angle = atan2(dy, dx);

    push();
    translate(centerX + offsetX, centerY + offsetY);
    rotate(angle);

    if (this.fillEllipses) {
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

  drawUnifiedContour(offsetX, offsetY) {
    for (let i = 0; i < this.poses.length; i++) {
      let pose = this.poses[i];
      let leftEar = pose.keypoints[3];
      let rightEar = pose.keypoints[4];

      if (leftEar.confidence > 0.1 && rightEar.confidence > 0.1) {
        this.drawOffsetEllipseSegment(
          leftEar,
          rightEar,
          offsetX,
          offsetY,
          true
        );
      }

      for (let j = 0; j < this.connections.length; j++) {
        let pointAIndex = this.connections[j][0];
        let pointBIndex = this.connections[j][1];
        let isFaceConnection = pointAIndex <= 2 || pointBIndex <= 2;

        if (!isFaceConnection) {
          let pointA = pose.keypoints[pointAIndex];
          let pointB = pose.keypoints[pointBIndex];

          if (pointA.confidence > 0.1 && pointB.confidence > 0.1) {
            this.drawOffsetEllipseSegment(
              pointA,
              pointB,
              offsetX,
              offsetY,
              false
            );
          }
        }
      }
    }
  }

  drawOffsetEllipseSegment(point1, point2, offsetX, offsetY, inverted = false) {
    let centerX = (point1.x + point2.x) / 2;
    let centerY = (point1.y + point2.y) / 2;
    let dx = point2.x - point1.x;
    let dy = point2.y - point1.y;
    let distance = sqrt(dx * dx + dy * dy);
    let majorAxis, minorAxis;
    let offsetMultiplier = 1.618;

    if (inverted) {
      minorAxis = distance;
      majorAxis = distance * 1.618;
    } else {
      majorAxis = distance;
      minorAxis = distance / 1.618;
    }

    majorAxis *= offsetMultiplier;
    minorAxis *= offsetMultiplier;
    let angle = atan2(dy, dx);

    push();
    translate(centerX + offsetX, centerY + offsetY);
    rotate(angle);

    if (this.fillUnifiedContour) {
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

  calculateSchlemerLineLength() {
    if (this.poses.length === 0) return;

    let pose = this.poses[0];
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
      let distance = sqrt(dx * dx + dy * dy);
      this.schlemerLineLength = distance;
    }
  }

  configureSchlemerConnections() {
    this.schlemerConnections = [
      { lower: 16, upper: 14, centered: false, lengthRatio: 0.75 },
      { lower: 14, upper: 12, centered: false, lengthRatio: 1.5 },
      { lower: 6, upper: 10, centered: false, lengthRatio: 1.5 },
      { lower: 12, upper: 6, centered: false, lengthRatio: 1.5 },
      { lower: 15, upper: 13, centered: false, lengthRatio: 0.75 },
      { lower: 13, upper: 11, centered: false, lengthRatio: 1.5 },
      { lower: 5, upper: 9, centered: false, lengthRatio: 1.5 },
      { lower: 11, upper: 5, centered: false, lengthRatio: 1.5 },
      { lower: 5, upper: 6, centered: true, lengthRatio: 0.75 },
    ];
  }

  smoothPoses(newPoses, factor) {
    if (this.previousPoses.length === 0) {
      return newPoses;
    }

    let smoothedPoses = [];

    for (let i = 0; i < newPoses.length; i++) {
      let newPose = newPoses[i];
      let smoothedPose = { keypoints: [] };
      let prevPose = this.previousPoses[i];

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

  isPointInPolygon(point, polygon) {
    if (polygon.length < 3) return true;

    let x = point.x;
    let y = point.y;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      let xi = polygon[i].x;
      let yi = polygon[i].y;
      let xj = polygon[j].x;
      let yj = polygon[j].y;

      let intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  filterPosesByMask(poses) {
    if (!this.maskEnabled || this.maskPoints.length < 3) {
      return poses;
    }

    let filteredPoses = [];

    for (let pose of poses) {
      let insideCount = 0;
      let totalCount = 0;

      for (let keypoint of pose.keypoints) {
        if (keypoint.confidence > 0.1) {
          totalCount++;
          if (this.isPointInPolygon(keypoint, this.maskPoints)) {
            insideCount++;
          }
        }
      }

      if (totalCount > 0 && insideCount / totalCount >= 0.5) {
        filteredPoses.push(pose);
      }
    }

    return filteredPoses;
  }

  gotPoses(results) {
    let smoothedResults = this.smoothPoses(results, this.smoothingFactor);
    let filteredResults = this.filterPosesByMask(smoothedResults);
    this.poses = filteredResults;
    this.previousPoses = JSON.parse(JSON.stringify(smoothedResults));

    if (this.schlemerLineLength === 0 && this.poses.length > 0) {
      this.calculateSchlemerLineLength();
      this.configureSchlemerConnections();
    }
  }
}


