/**
 * SchlemerVisualizer - Pure Schlemer stick rendering
 * Takes poses from external source and renders with configurable colors
 * No video/detection logic - just visualization
 */
class SchlemerVisualizer {
  constructor(color = [255, 255, 255], graphicsBuffer = null) {
    this.pg = graphicsBuffer; // Optional graphics buffer to draw to
    this.color = color; // RGB color array [r, g, b]
    this.schlemerConnections = [];
    this.schlemerLineLength = 0;

    // Trail parameters
    this.trailHistory = [];
    this.trailMaxFrames = 60;
    this.trailInterval = 3;
    this.trailFrameCounter = 0;

    // Trail toggle (controlled externally)
    this.showSchlemerTrail = false;

    // Configure connections on creation
    this.configureSchlemerConnections();
  }

  draw(canvasWidth, canvasHeight, poses, showVideo, video, videoConfig) {
    // Use appropriate push based on context
    if (this.pg) {
      this.pg.push();
    } else {
      push();
    }

    // Apply mirror transform first (if enabled in videoConfig)
    if (videoConfig.mirrorMode) {
      if (this.pg) {
        this.pg.translate(canvasWidth, 0);
        this.pg.scale(-1, 1);
      } else {
        translate(canvasWidth, 0);
        scale(-1, 1);
      }
    }

    // Draw video background if requested
    if (showVideo && video) {
      this.drawVideoBackground(canvasWidth, canvasHeight, video, videoConfig);
    }

    // Draw Schlemer sticks (always on, NEVER clipped by mask)
    this.drawSchlemerSticks(poses, videoConfig.offsetX, videoConfig.offsetY, videoConfig.scaleX, videoConfig.scaleY);

    // Draw Schlemer trail (if enabled, NEVER clipped by mask)
    if (this.showSchlemerTrail) {
      this.drawSchlemerTrail(videoConfig.offsetX, videoConfig.offsetY, videoConfig.scaleX, videoConfig.scaleY);
    }

    if (this.pg) {
      this.pg.pop();
    } else {
      pop();
    }
  }

  drawVideoBackground(canvasWidth, canvasHeight, video, videoConfig) {
    // Apply clipping ONLY for video (if mask enabled)
    if (videoConfig.maskEnabled && videoConfig.maskPoints && videoConfig.maskPoints.length >= 3) {
      if (this.pg) {
        this.pg.drawingContext.save();
        this.pg.drawingContext.beginPath();
        for (let i = 0; i < videoConfig.maskPoints.length; i++) {
          // Scale mask points from video coords to canvas display coords
          let px = videoConfig.maskPoints[i].x * videoConfig.scaleX + videoConfig.offsetX;
          let py = videoConfig.maskPoints[i].y * videoConfig.scaleY + videoConfig.offsetY;
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
        for (let i = 0; i < videoConfig.maskPoints.length; i++) {
          // Scale mask points from video coords to canvas display coords
          let px = videoConfig.maskPoints[i].x * videoConfig.scaleX + videoConfig.offsetX;
          let py = videoConfig.maskPoints[i].y * videoConfig.scaleY + videoConfig.offsetY;
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
      this.pg.image(video, videoConfig.offsetX, videoConfig.offsetY, videoConfig.drawWidth, videoConfig.drawHeight);
    } else {
      image(video, videoConfig.offsetX, videoConfig.offsetY, videoConfig.drawWidth, videoConfig.drawHeight);
    }

    // Restore context after video (end clipping for video)
    if (videoConfig.maskEnabled && videoConfig.maskPoints && videoConfig.maskPoints.length >= 3) {
      if (this.pg) {
        this.pg.drawingContext.restore();
      } else {
        drawingContext.restore();
      }
    }
  }

  drawSchlemerSticks(poses, offsetX, offsetY, scaleX, scaleY) {
    if (this.schlemerLineLength === 0 || !poses) return;

    for (let i = 0; i < poses.length; i++) {
      let pose = poses[i];

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
            this.pg.stroke(this.color[0], this.color[1], this.color[2]);
            this.pg.strokeWeight(6);
            this.pg.line(
              startX * scaleX + offsetX,
              startY * scaleY + offsetY,
              endX * scaleX + offsetX,
              endY * scaleY + offsetY
            );
          } else {
            stroke(this.color[0], this.color[1], this.color[2]);
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
    if (this.schlemerLineLength === 0 || !this.poses || this.poses.length === 0) return;

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
          this.pg.stroke(this.color[0], this.color[1], this.color[2], opacity);
          this.pg.strokeWeight(weight);
          this.pg.line(
            stick.startX * scaleX + offsetX,
            stick.startY * scaleY + offsetY,
            stick.endX * scaleX + offsetX,
            stick.endY * scaleY + offsetY
          );
        } else {
          stroke(this.color[0], this.color[1], this.color[2], opacity);
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
    if (!this.poses || this.poses.length === 0 || this.schlemerLineLength === 0) return;

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

  updatePoses(poses) {
    this.poses = poses;
  }

  updateSchlemerLineLength(length) {
    this.schlemerLineLength = length;
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
  
  updateTrailParameters(interval, maxFrames) {
    this.trailInterval = interval;
    this.trailMaxFrames = maxFrames;
  }
}