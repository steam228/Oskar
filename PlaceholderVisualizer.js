/**
 * PlaceholderVisualizer - Simple placeholder with black background and white circle
 * Works with global p5 mode
 */
class PlaceholderVisualizer {
  constructor(circleSize = 100, name = 'Placeholder', graphicsBuffer = null) {
    this.pg = graphicsBuffer;
    this.circleSize = circleSize;
    this.name = name;
  }
  
  async init() {
    // No initialization needed for placeholder
    return Promise.resolve();
  }
  
  async loadModel() {
    // No model to load
    return Promise.resolve();
  }
  
  loadMask(maskData) {
    // No mask for placeholder
  }
  
  draw(canvasWidth, canvasHeight) {
    // If we have a graphics buffer, draw to it, otherwise draw to main canvas
    if (this.pg) {
      this.pg.push();
      this.pg.fill(255);
      this.pg.noStroke();
      this.pg.circle(canvasWidth / 2, canvasHeight / 2, this.circleSize);
      this.pg.pop();
    } else {
      push();
      fill(255);
      noStroke();
      circle(canvasWidth / 2, canvasHeight / 2, this.circleSize);
      pop();
    }
  }
  
  videoResize() {
    // No video for placeholder
  }
}

