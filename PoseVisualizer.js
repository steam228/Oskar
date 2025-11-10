/**
 * PoseVisualizer - Simplified OSKAR pose detection
 * Only Schlemer sticks + trail + video background
 * Works with global p5 mode
 */
class PoseVisualizer {
  constructor(graphicsBuffer = null) {
    this.pg = graphicsBuffer; // Optional graphics buffer to draw to
    this.video = null;
    this.bodyPose = null;
    this.poses = [];
    this.schlemerConnections = [];
    this.schlemerLineLength = 0;
    this.previousPoses = [];

    // Trail parameters
    this.trailHistory = [];
    this.trailMaxFrames = 60;
    this.trailInterval = 3;
    this.trailFrameCounter = 0;

    // Simple toggles
    this.showSchlemerTrail = false;
    this.showVideo = true;

    // Mirror mode
    this.mirrorMode = true;

    // Detection mask
    this.maskPoints = [];
    this.maskEnabled = false;

    // Smoothing
    this.smoothingFactor = 0.5;
  }

  async init() {
    console.log("Initializing video capture...");
    this.video = createCapture(VIDEO);
    this.video.hide();

    return new Promise((resolve) => {
      this.video.elt.addEventListener("loadedmetadata", () => {
        console.log("✓ Video ready:", this.video.width, "x", this.video.height);
        this.videoResize();
        // Add small delay to ensure video is truly ready
        setTimeout(() => resolve(), 500);
      });
    });
  }

  loadModel() {
    return new Promise((resolve, reject) => {
      try {
        console.log("Loading ml5 bodyPose model...");

        // Use callback-based initialization instead of async/await
        this.bodyPose = ml5.bodyPose(
          "MoveNet",
          {
            modelType: "SINGLEPOSE_LIGHTNING",
            enableSmoothing: true,
            minPoseScore: 0.25,
          },
          () => {
            // Model loaded callback
            console.log("✓ Model loaded, starting detection...");
            this.bodyPose.detectStart(this.video, (results) =>
              this.gotPoses(results)
            );
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

  videoResize() {
    let videoAspectRatio = this.video.width / this.video.height;
    let canvasAspectRatio = width / height;

    let drawWidth, drawHeight;

    if (videoAspectRatio > canvasAspectRatio) {
      drawHeight = height;
      drawWidth = height * videoAspectRatio;
    } else {
      drawWidth = width;
      drawHeight = width / videoAspectRatio;
    }

    this.video.size(drawWidth, drawHeight);
  }

  loadMask(maskData) {
    if (maskData) {
      this.maskPoints = maskData.points || [];
      this.maskEnabled = maskData.enabled || false;
      console.log(
        `✓ Mask loaded: ${this.maskPoints.length} points, enabled: ${this.maskEnabled}`
      );
    }
  }

  draw(canvasWidth, canvasHeight) {
    // Use appropriate push based on context
    if (this.pg) {
      this.pg.push();
    } else {
      push();
    }

    // Get the original video source dimensions (not the scaled element size)
    let videoSrcWidth, videoSrcHeight;
    if (this.video.elt && this.video.elt.videoWidth > 0) {
      videoSrcWidth = this.video.elt.videoWidth;
      videoSrcHeight = this.video.elt.videoHeight;
    } else {
      // Fallback to display dimensions if video not loaded yet
      videoSrcWidth = this.video.width || 640;
      videoSrcHeight = this.video.height || 480;
    }

    // Calculate proper video sizing for this specific canvas
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

    // Apply mirror transform first (before any drawing)
    if (this.mirrorMode) {
      if (this.pg) {
        this.pg.translate(canvasWidth, 0);
        this.pg.scale(-1, 1);
      } else {
        translate(canvasWidth, 0);
        scale(-1, 1);
      }
    }

    // Draw the webcam video with clipping mask (if enabled)
    if (this.showVideo) {
      // Apply clipping ONLY for video (not for graphics)
      if (this.maskEnabled && this.maskPoints.length >= 3) {
        if (this.pg) {
          this.pg.drawingContext.save();
          this.pg.drawingContext.beginPath();
          for (let i = 0; i < this.maskPoints.length; i++) {
            // Scale mask points from video coords to canvas display coords
            let px = this.maskPoints[i].x * scaleX + offsetX;
            let py = this.maskPoints[i].y * scaleY + offsetY;
            if (i === 0) {
              this.pg.drawingContext.moveTo(px, py);
            } else {
              this.pg.drawingContext.lineTo(px, py);
            }
          }
          this.pg.drawingContext.closePath();
          this.pg.drawingContext.clip();
        } else {
          drawingContext.save();
          drawingContext.beginPath();
          for (let i = 0; i < this.maskPoints.length; i++) {
            // Scale mask points from video coords to canvas display coords
            let px = this.maskPoints[i].x * scaleX + offsetX;
            let py = this.maskPoints[i].y * scaleY + offsetY;
            if (i === 0) {
              drawingContext.moveTo(px, py);
            } else {
              drawingContext.lineTo(px, py);
            }
          }
          drawingContext.closePath();
          drawingContext.clip();
        }
      }

      // Draw video (clipped if mask is enabled)
      if (this.pg) {
        this.pg.image(this.video, offsetX, offsetY, drawWidth, drawHeight);
      } else {
        image(this.video, offsetX, offsetY, drawWidth, drawHeight);
      }

      // Restore context after video (end clipping for video)
      if (this.maskEnabled && this.maskPoints.length >= 3) {
        if (this.pg) {
          this.pg.drawingContext.restore();
        } else {
          drawingContext.restore();
        }
      }
    }

    // Draw Schlemer sticks (always on, NEVER clipped by mask)
    this.drawSchlemerSticks(offsetX, offsetY, scaleX, scaleY);

    // Draw Schlemer trail (if enabled, NEVER clipped by mask)
    if (this.showSchlemerTrail) {
      this.drawSchlemerTrail(offsetX, offsetY, scaleX, scaleY);
    }

    if (this.pg) {
      this.pg.pop();
    } else {
      pop();
    }
  }

  drawSchlemerSticks(offsetX, offsetY, scaleX, scaleY) {
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
            let dirLength = Math.sqrt(dirX * dirX + dirY * dirY);

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
            let dirLength = Math.sqrt(dirX * dirX + dirY * dirY);

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

          if (this.pg) {
            this.pg.stroke(255);
            this.pg.strokeWeight(6);
            this.pg.line(
              startX * scaleX + offsetX,
              startY * scaleY + offsetY,
              endX * scaleX + offsetX,
              endY * scaleY + offsetY
            );
          } else {
            stroke(255);
            strokeWeight(6);
            line(
              startX * scaleX + offsetX,
              startY * scaleY + offsetY,
              endX * scaleX + offsetX,
              endY * scaleY + offsetY
            );
          }
        }
      }
    }
  }

  drawSchlemerTrail(offsetX, offsetY, scaleX, scaleY) {
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
        if (this.pg) {
          this.pg.stroke(255, opacity);
          this.pg.strokeWeight(weight);
          this.pg.line(
            stick.startX * scaleX + offsetX,
            stick.startY * scaleY + offsetY,
            stick.endX * scaleX + offsetX,
            stick.endY * scaleY + offsetY
          );
        } else {
          stroke(255, opacity);
          strokeWeight(weight);
          line(
            stick.startX * scaleX + offsetX,
            stick.startY * scaleY + offsetY,
            stick.endX * scaleX + offsetX,
            stick.endY * scaleY + offsetY
          );
        }
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
            let dirLength = Math.sqrt(dirX * dirX + dirY * dirY);

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
            let dirLength = Math.sqrt(dirX * dirX + dirY * dirY);

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
      let distance = Math.sqrt(dx * dx + dy * dy);
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

  filterPosesByMask(poses) {
    if (!this.maskEnabled || this.maskPoints.length < 3) {
      return poses;
    }

    let filteredPoses = [];

    for (let pose of poses) {
      let validKeypoints = 0;
      for (let keypoint of pose.keypoints) {
        if (keypoint.confidence > 0.1) {
          if (this.isPointInPolygon(keypoint, this.maskPoints)) {
            validKeypoints++;
          }
        }
      }

      // Only include pose if at least half of visible keypoints are in mask
      if (validKeypoints >= pose.keypoints.length / 4) {
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
