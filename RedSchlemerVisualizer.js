/**
 * RedSchlemerVisualizer - Red Schlemer sticks
 */
class RedSchlemerVisualizer extends SchlemerVisualizer {
  constructor(graphicsBuffer = null) {
    super([255, 0, 0], graphicsBuffer); // Red color
  }
}