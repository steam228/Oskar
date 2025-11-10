/**
 * ClearRedSchlemerVisualizer - Clear white sticks, no trail effects
 * Always renders clean white lines regardless of trail settings
 */
class ClearRedSchlemerVisualizer extends SchlemerVisualizer {
  constructor(graphicsBuffer = null) {
    super([255, 255, 255], graphicsBuffer); // White color
    
    // Override trail settings - always disabled
    this.showSchlemerTrail = false;
    this.trailHistory = [];
  }
  
  // Override draw method to ignore trail effects completely
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

    // Draw ONLY Schlemer sticks (no trails ever)
    this.drawSchlemerSticks(poses, videoConfig.offsetX, videoConfig.offsetY, videoConfig.scaleX, videoConfig.scaleY);

    if (this.pg) {
      this.pg.pop();
    } else {
      pop();
    }
  }
  
  // Override trail methods to do nothing
  drawSchlemerTrail(offsetX, offsetY, scaleX, scaleY) {
    // No trails for clear visualizer
  }
  
  captureTrailSnapshot() {
    // No trail capture
  }
  
  updateTrailParameters(interval, maxFrames) {
    // Ignore trail parameter updates
  }
  
  // Override to prevent trail toggle
  set showSchlemerTrail(value) {
    // Always false for clear visualizer
  }
  
  get showSchlemerTrail() {
    return false;
  }
}