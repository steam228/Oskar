/**
 * SpringSplineVisualizer - OSKAR pose detection with spring physics and bezier splines
 * Features configurable spring hardness and smooth spline curves
 * Works with global p5 mode
 */
class SpringSplineVisualizer {
  constructor(graphicsBuffer = null) {
    this.pg = graphicsBuffer;
    this.video = null;
    this.bodyPose = null;
    this.poses = [];
    this.schlemerConnections = [];
    this.schlemerLineLength = 0;
    this.previousPoses = [];

    // Spring physics system
    this.springs = [];
    this.springHardness = 0.15;     // How stiff the springs are (0.05 = very soft, 0.8 = very hard)
    this.springDamping = 0.9;       // How much energy is lost each frame (0.7 = bouncy, 0.99 = smooth)
    this.midPointHardness = 0.12;   // Separate hardness for middle point (slightly softer for more bounce)
    
    // Visual toggles
    this.showVideo = true;
    this.showSplines = true;
    
    // Mirror mode
    this.mirrorMode = true;

    // Detection mask
    this.maskPoints = [];
    this.maskEnabled = false;

    // Smoothing
    this.smoothingFactor = 0.5;
  }

  async init() {
    console.log("Initializing SpringSpline video capture...");
    this.video = createCapture(VIDEO);
    this.video.hide();

    return new Promise((resolve) => {
      this.video.elt.addEventListener("loadedmetadata", () => {
        console.log("✓ SpringSpline Video ready:", this.video.width, "x", this.video.height);
        this.videoResize();
        setTimeout(() => resolve(), 500);
      });
    });
  }

  loadModel() {
    return new Promise((resolve, reject) => {
      try {
        console.log("Loading SpringSpline ml5 bodyPose model...");

        this.bodyPose = ml5.bodyPose(
          "MoveNet",
          {
            modelType: "SINGLEPOSE_LIGHTNING",
            enableSmoothing: true,
            minPoseScore: 0.25,
          },
          () => {
            console.log("✓ SpringSpline Model loaded, starting detection...");
            this.bodyPose.detectStart(this.video, (results) =>
              this.gotPoses(results)
            );
            console.log("✓ SpringSpline Pose detection started");
            resolve();
          }
        );
      } catch (error) {
        console.error("Error loading SpringSpline bodyPose model:", error);
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
        `✓ SpringSpline Mask loaded: ${this.maskPoints.length} points, enabled: ${this.maskEnabled}`
      );
    }
  }

  initializeSprings() {
    if (!this.poses.length || !this.schlemerConnections.length) return;

    this.springs = [];
    
    for (let connection of this.schlemerConnections) {
      // Initialize springs with current pose positions if available
      let initialStartX = 0, initialStartY = 0;
      let initialEndX = 0, initialEndY = 0;
      
      if (this.poses.length > 0) {
        let pose = this.poses[0];
        let point1 = pose.keypoints[connection.lower];
        let point2 = pose.keypoints[connection.upper];
        
        if (point1.confidence > 0.1 && point2.confidence > 0.1) {
          if (connection.centered) {
            let centerX = (point1.x + point2.x) / 2;
            let centerY = (point1.y + point2.y) / 2;
            let dirX = point2.x - point1.x;
            let dirY = point2.y - point1.y;
            let dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
            
            if (dirLength > 0 && this.schlemerLineLength > 0) {
              dirX /= dirLength;
              dirY /= dirLength;
              let halfLength = (this.schlemerLineLength * connection.lengthRatio) / 2;
              initialStartX = centerX - dirX * halfLength;
              initialStartY = centerY - dirY * halfLength;
              initialEndX = centerX + dirX * halfLength;
              initialEndY = centerY + dirY * halfLength;
            }
          } else {
            initialStartX = point1.x;
            initialStartY = point1.y;
            if (this.schlemerLineLength > 0) {
              let dirX = point2.x - point1.x;
              let dirY = point2.y - point1.y;
              let dirLength = Math.sqrt(dirX * dirX + dirY * dirY);
              if (dirLength > 0) {
                dirX /= dirLength;
                dirY /= dirLength;
                let actualLength = this.schlemerLineLength * connection.lengthRatio;
                initialEndX = point1.x + dirX * actualLength;
                initialEndY = point1.y + dirY * actualLength;
              }
            }
          }
        }
      }
      
      let spring = {
        connection: connection,
        startPoint: { x: initialStartX, y: initialStartY, vx: 0, vy: 0 }, // Spring anchor for start
        endPoint: { x: initialEndX, y: initialEndY, vx: 0, vy: 0 },       // Spring anchor for end
        midPoint: { x: (initialStartX + initialEndX) / 2, y: (initialStartY + initialEndY) / 2, vx: 0, vy: 0 }, // Spring-driven middle
        targetStart: { x: initialStartX, y: initialStartY },              // Target position from pose
        targetEnd: { x: initialEndX, y: initialEndY },                    // Target position from pose
        targetMid: { x: (initialStartX + initialEndX) / 2, y: (initialStartY + initialEndY) / 2 }, // Target middle position
        controlStart: { x: 0, y: 0 },                                     // Bezier control point near start
        controlEnd: { x: 0, y: 0 }                                        // Bezier control point near end
      };
      
      this.springs.push(spring);
    }
  }

  updateSprings(offsetX, offsetY, scaleX, scaleY) {
    if (!this.poses.length || !this.springs.length) return;

    let pose = this.poses[0];

    for (let spring of this.springs) {
      let connection = spring.connection;
      let lowerIndex = connection.lower;
      let upperIndex = connection.upper;
      let isCentered = connection.centered;
      let lengthRatio = connection.lengthRatio;

      let point1 = pose.keypoints[lowerIndex];
      let point2 = pose.keypoints[upperIndex];

      if (point1.confidence > 0.1 && point2.confidence > 0.1) {
        let actualLineLength = this.schlemerLineLength * lengthRatio;

        // Calculate target positions (same logic as original Schlemer sticks)
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
            spring.targetStart.x = centerX - dirX * halfLength;
            spring.targetStart.y = centerY - dirY * halfLength;
            spring.targetEnd.x = centerX + dirX * halfLength;
            spring.targetEnd.y = centerY + dirY * halfLength;
          }
        } else {
          let dirX = point2.x - point1.x;
          let dirY = point2.y - point1.y;
          let dirLength = Math.sqrt(dirX * dirX + dirY * dirY);

          if (dirLength > 0) {
            dirX /= dirLength;
            dirY /= dirLength;
            spring.targetStart.x = point1.x;
            spring.targetStart.y = point1.y;
            spring.targetEnd.x = point1.x + dirX * actualLineLength;
            spring.targetEnd.y = point1.y + dirY * actualLineLength;
          }
        }

        // Calculate target middle position (parallel to line when at rest)
        spring.targetMid.x = (spring.targetStart.x + spring.targetEnd.x) / 2;
        spring.targetMid.y = (spring.targetStart.y + spring.targetEnd.y) / 2;

        // Apply spring physics to start, end, and middle points
        this.applySpringForce(spring.startPoint, spring.targetStart, this.springHardness);
        this.applySpringForce(spring.endPoint, spring.targetEnd, this.springHardness);
        this.applySpringForce(spring.midPoint, spring.targetMid, this.midPointHardness);

        // Calculate bezier control points based on spring positions
        let dx = spring.endPoint.x - spring.startPoint.x;
        let dy = spring.endPoint.y - spring.startPoint.y;
        
        // Control points are positioned between the anchor points and middle point
        // This creates a smooth curve that flows through the middle point
        spring.controlStart.x = (spring.startPoint.x + spring.midPoint.x) / 2;
        spring.controlStart.y = (spring.startPoint.y + spring.midPoint.y) / 2;
        
        spring.controlEnd.x = (spring.endPoint.x + spring.midPoint.x) / 2;
        spring.controlEnd.y = (spring.endPoint.y + spring.midPoint.y) / 2;
      }
    }
  }

  applySpringForce(springPoint, target, hardness = this.springHardness) {
    // Calculate spring force (Hooke's law: F = -kx)
    let forceX = (target.x - springPoint.x) * hardness;
    let forceY = (target.y - springPoint.y) * hardness;
    
    // Apply force to velocity
    springPoint.vx += forceX;
    springPoint.vy += forceY;
    
    // Apply damping
    springPoint.vx *= this.springDamping;
    springPoint.vy *= this.springDamping;
    
    // Update position
    springPoint.x += springPoint.vx;
    springPoint.y += springPoint.vy;
  }

  draw(canvasWidth, canvasHeight) {
    if (this.pg) {
      this.pg.push();
    } else {
      push();
    }

    // Get video dimensions and scaling (same as PoseVisualizer)
    let videoSrcWidth, videoSrcHeight;
    if (this.video.elt && this.video.elt.videoWidth > 0) {
      videoSrcWidth = this.video.elt.videoWidth;
      videoSrcHeight = this.video.elt.videoHeight;
    } else {
      videoSrcWidth = this.video.width || 640;
      videoSrcHeight = this.video.height || 480;
    }

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

    let offsetX = (canvasWidth - drawWidth) / 2;
    let offsetY = (canvasHeight - drawHeight) / 2;
    let scaleX = drawWidth / videoSrcWidth;
    let scaleY = drawHeight / videoSrcHeight;

    // Apply mirror transform
    if (this.mirrorMode) {
      if (this.pg) {
        this.pg.translate(canvasWidth, 0);
        this.pg.scale(-1, 1);
      } else {
        translate(canvasWidth, 0);
        scale(-1, 1);
      }
    }

    // Draw video background if enabled
    if (this.showVideo) {
      if (this.maskEnabled && this.maskPoints.length >= 3) {
        // Apply mask clipping to video
        if (this.pg) {
          this.pg.drawingContext.save();
          this.pg.drawingContext.beginPath();
          for (let i = 0; i < this.maskPoints.length; i++) {
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
          this.pg.image(this.video, offsetX, offsetY, drawWidth, drawHeight);
          this.pg.drawingContext.restore();
        } else {
          drawingContext.save();
          drawingContext.beginPath();
          for (let i = 0; i < this.maskPoints.length; i++) {
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
          image(this.video, offsetX, offsetY, drawWidth, drawHeight);
          drawingContext.restore();
        }
      } else {
        if (this.pg) {
          this.pg.image(this.video, offsetX, offsetY, drawWidth, drawHeight);
        } else {
          image(this.video, offsetX, offsetY, drawWidth, drawHeight);
        }
      }
    }

    // Update and draw springs/splines
    if (this.showSplines && this.springs.length > 0) {
      this.updateSprings(offsetX, offsetY, scaleX, scaleY);
      this.drawSplines(offsetX, offsetY, scaleX, scaleY);
    }

    if (this.pg) {
      this.pg.pop();
    } else {
      pop();
    }
  }

  drawSplines(offsetX, offsetY, scaleX, scaleY) {
    for (let spring of this.springs) {
      // Draw two connected bezier curves that pass through the middle point
      // This creates a smooth curve: start -> control1 -> midPoint -> control2 -> end
      
      if (this.pg) {
        this.pg.stroke(255);
        this.pg.strokeWeight(4);
        this.pg.noFill();
        
        // First half: start -> midPoint
        this.pg.bezier(
          spring.startPoint.x * scaleX + offsetX,
          spring.startPoint.y * scaleY + offsetY,
          spring.controlStart.x * scaleX + offsetX,
          spring.controlStart.y * scaleY + offsetY,
          spring.controlStart.x * scaleX + offsetX,
          spring.controlStart.y * scaleY + offsetY,
          spring.midPoint.x * scaleX + offsetX,
          spring.midPoint.y * scaleY + offsetY
        );
        
        // Second half: midPoint -> end
        this.pg.bezier(
          spring.midPoint.x * scaleX + offsetX,
          spring.midPoint.y * scaleY + offsetY,
          spring.controlEnd.x * scaleX + offsetX,
          spring.controlEnd.y * scaleY + offsetY,
          spring.controlEnd.x * scaleX + offsetX,
          spring.controlEnd.y * scaleY + offsetY,
          spring.endPoint.x * scaleX + offsetX,
          spring.endPoint.y * scaleY + offsetY
        );
      } else {
        stroke(255);
        strokeWeight(4);
        noFill();
        
        // First half: start -> midPoint
        bezier(
          spring.startPoint.x * scaleX + offsetX,
          spring.startPoint.y * scaleY + offsetY,
          spring.controlStart.x * scaleX + offsetX,
          spring.controlStart.y * scaleY + offsetY,
          spring.controlStart.x * scaleX + offsetX,
          spring.controlStart.y * scaleY + offsetY,
          spring.midPoint.x * scaleX + offsetX,
          spring.midPoint.y * scaleY + offsetY
        );
        
        // Second half: midPoint -> end
        bezier(
          spring.midPoint.x * scaleX + offsetX,
          spring.midPoint.y * scaleY + offsetY,
          spring.controlEnd.x * scaleX + offsetX,
          spring.controlEnd.y * scaleY + offsetY,
          spring.controlEnd.x * scaleX + offsetX,
          spring.controlEnd.y * scaleY + offsetY,
          spring.endPoint.x * scaleX + offsetX,
          spring.endPoint.y * scaleY + offsetY
        );
      }
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

    // Initialize springs when connections are configured
    this.initializeSprings();
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

  // Spring control methods
  setSpringHardness(value) {
    this.springHardness = Math.max(0.05, Math.min(0.8, value));
    console.log("✓ Spring hardness:", this.springHardness.toFixed(3));
  }

  setSpringDamping(value) {
    this.springDamping = Math.max(0.7, Math.min(0.99, value));
    console.log("✓ Spring damping:", this.springDamping.toFixed(3));
  }

  adjustSpringHardness(delta) {
    this.setSpringHardness(this.springHardness + delta);
  }

  adjustSpringDamping(delta) {
    this.setSpringDamping(this.springDamping + delta);
  }

  setMidPointHardness(value) {
    this.midPointHardness = Math.max(0.05, Math.min(0.8, value));
    console.log("✓ Mid-point hardness:", this.midPointHardness.toFixed(3));
  }

  adjustMidPointHardness(delta) {
    this.setMidPointHardness(this.midPointHardness + delta);
  }
}