/**
 * SpringyBlueSchlemerVisualizer - Springy white bezier curves instead of rigid blue sticks
 * Uses simple physics simulation for bouncy lines between Schlemmer stick endpoints
 */
class SpringyBlueSchlemerVisualizer extends SchlemerVisualizer {
  constructor(graphicsBuffer = null) {
    // Pass white color to base class since we draw white springy lines
    super([255, 255, 255], graphicsBuffer);
    
    // Spring physics for each Schlemmer connection
    this.springData = [];
    
    // Spring parameters (elasticity controls)
    this.springStrength = 0.02;    // How strong the spring force is
    this.damping = 0.95;           // How much the spring bounces
    this.restLength = 0.3;         // Fraction of total distance
    this.elasticity = 1.0;         // Overall elasticity multiplier (controllable)
    
    this.initializeSprings();
  }
  
  initializeSprings() {
    // Create spring data for each Schlemmer connection
    for (let i = 0; i < this.schlemerConnections.length; i++) {
      this.springData.push({
        controlPoints: [
          { x: 0, y: 0, vx: 0, vy: 0 }, // Control point 1
          { x: 0, y: 0, vx: 0, vy: 0 }, // Control point 2
        ],
        initialized: false
      });
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

          // Calculate start and end points (same logic as rigid sticks)
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

          // Convert to screen coordinates
          let screenStartX = startX * scaleX + offsetX;
          let screenStartY = startY * scaleY + offsetY;
          let screenEndX = endX * scaleX + offsetX;
          let screenEndY = endY * scaleY + offsetY;

          // Draw springy bezier curve instead of rigid line
          this.drawSpringyLine(j, screenStartX, screenStartY, screenEndX, screenEndY);
        }
      }
    }
  }
  
  drawSpringyLine(connectionIndex, startX, startY, endX, endY) {
    let springInfo = this.springData[connectionIndex];
    
    // Initialize control points if not done yet
    if (!springInfo.initialized) {
      // Place control points along the line initially
      springInfo.controlPoints[0].x = startX + (endX - startX) * 0.33;
      springInfo.controlPoints[0].y = startY + (endY - startY) * 0.33;
      springInfo.controlPoints[1].x = startX + (endX - startX) * 0.66;
      springInfo.controlPoints[1].y = startY + (endY - startY) * 0.66;
      springInfo.initialized = true;
    }
    
    // Calculate ideal positions for control points
    let idealX1 = startX + (endX - startX) * 0.33;
    let idealY1 = startY + (endY - startY) * 0.33;
    let idealX2 = startX + (endX - startX) * 0.66;
    let idealY2 = startY + (endY - startY) * 0.66;
    
    // Add some perpendicular offset for springiness
    let dx = endX - startX;
    let dy = endY - startY;
    let length = Math.sqrt(dx * dx + dy * dy);
    
    if (length > 0) {
      // Perpendicular direction
      let perpX = -dy / length;
      let perpY = dx / length;
      
      // Add some sine wave motion for springy effect (affected by elasticity)
      let time = millis() * 0.003;
      let waveAmplitude = 15 * this.elasticity;
      let wave1 = Math.sin(time + connectionIndex * 0.5) * waveAmplitude;
      let wave2 = Math.sin(time + connectionIndex * 0.5 + Math.PI) * waveAmplitude;
      
      idealX1 += perpX * wave1;
      idealY1 += perpY * wave1;
      idealX2 += perpX * wave2;
      idealY2 += perpY * wave2;
    }
    
    // Apply spring physics to control points
    for (let i = 0; i < springInfo.controlPoints.length; i++) {
      let cp = springInfo.controlPoints[i];
      let idealX = (i === 0) ? idealX1 : idealX2;
      let idealY = (i === 0) ? idealY1 : idealY2;
      
      // Spring force toward ideal position (affected by elasticity)
      let effectiveSpringStrength = this.springStrength * this.elasticity;
      let effectiveDamping = this.damping + (1 - this.elasticity) * 0.03; // Less elasticity = more damping
      
      let forceX = (idealX - cp.x) * effectiveSpringStrength;
      let forceY = (idealY - cp.y) * effectiveSpringStrength;
      
      // Update velocity
      cp.vx += forceX;
      cp.vy += forceY;
      
      // Apply damping
      cp.vx *= effectiveDamping;
      cp.vy *= effectiveDamping;
      
      // Update position
      cp.x += cp.vx;
      cp.y += cp.vy;
    }
    
    // Draw the bezier curve
    if (this.pg) {
      this.pg.stroke(255, 255, 255); // White color
      this.pg.strokeWeight(4);
      this.pg.noFill();
      this.pg.bezier(
        startX, startY,
        springInfo.controlPoints[0].x, springInfo.controlPoints[0].y,
        springInfo.controlPoints[1].x, springInfo.controlPoints[1].y,
        endX, endY
      );
    } else {
      stroke(255, 255, 255); // White color
      strokeWeight(4);
      noFill();
      bezier(
        startX, startY,
        springInfo.controlPoints[0].x, springInfo.controlPoints[0].y,
        springInfo.controlPoints[1].x, springInfo.controlPoints[1].y,
        endX, endY
      );
    }
  }
  
  // Override trail drawing to use springy lines as well
  drawSchlemerTrail(offsetX, offsetY, scaleX, scaleY) {
    if (this.schlemerLineLength === 0 || !this.poses || this.poses.length === 0) return;

    this.trailFrameCounter++;

    if (this.trailFrameCounter >= this.trailInterval) {
      this.trailFrameCounter = 0;
      this.captureTrailSnapshot();
    }

    // Draw trail with reduced opacity springy lines
    for (let t = this.trailHistory.length - 1; t >= 0; t--) {
      let trailItem = this.trailHistory[t];
      trailItem.age++;

      if (trailItem.age > this.trailMaxFrames) {
        this.trailHistory.splice(t, 1);
        continue;
      }

      let fadeFactor = 1 - trailItem.age / this.trailMaxFrames;
      let opacity = fadeFactor * 128; // Reduced opacity for trail
      
      // Draw simple lines for trail (springy effect only on current pose)
      for (let stick of trailItem.sticks) {
        if (this.pg) {
          this.pg.stroke(255, 255, 255, opacity);
          this.pg.strokeWeight(2);
          this.pg.line(
            stick.startX * scaleX + offsetX,
            stick.startY * scaleY + offsetY,
            stick.endX * scaleX + offsetX,
            stick.endY * scaleY + offsetY
          );
        } else {
          stroke(255, 255, 255, opacity);
          strokeWeight(2);
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
  
  // Method to control elasticity (0.1 = very stiff, 2.0 = very bouncy)
  setElasticity(elasticityValue) {
    this.elasticity = Math.max(0.1, Math.min(3.0, elasticityValue));
  }
  
  getElasticity() {
    return this.elasticity;
  }
}