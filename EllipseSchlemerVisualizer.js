/**
 * EllipseSchlemerVisualizer — bone-aligned ellipses instead of straight sticks.
 * Ported from the legacy sketchPose.js drawSequentialEllipses / drawUnifiedContour modes.
 *
 * Two toggles (exposed via setters on the instance):
 *   - fillEllipses : stroke (false) vs solid white fill (true)
 *   - contourMode  : sequential ellipses (false) vs golden-ratio scaled overlap forming a body contour (true)
 *
 * Uses a fuller skeleton than the 9 Schlemmer sticks, so the silhouette wraps the whole body.
 */
class EllipseSchlemerVisualizer extends SchlemerVisualizer {
  constructor(graphicsBuffer = null) {
    super([255, 255, 255], graphicsBuffer);
    this.fillEllipses = false;
    this.contourMode = false;
    this.ellipseConnections = this.buildEllipseConnections();
  }

  buildEllipseConnections() {
    // MoveNet skeleton, non-face bones. Format: [indexA, indexB, isHead]
    return [
      [3, 4, true],    // left ear ↔ right ear (head — drawn inverted, major axis perpendicular)
      [5, 6, false],   // shoulders
      [11, 12, false], // hips
      [5, 11, false],  // left torso side
      [6, 12, false],  // right torso side
      [5, 7, false],   // left upper arm
      [7, 9, false],   // left forearm
      [6, 8, false],   // right upper arm
      [8, 10, false],  // right forearm
      [11, 13, false], // left thigh
      [13, 15, false], // left shin
      [12, 14, false], // right thigh
      [14, 16, false], // right shin
    ];
  }

  drawSchlemerSticks(poses, offsetX, offsetY, scaleX, scaleY) {
    if (!poses) return;
    const ctx = this.pg || null;
    const offsetMultiplier = this.contourMode ? 1.618 : 1.0;

    for (let i = 0; i < poses.length; i++) {
      const pose = poses[i];

      for (let j = 0; j < this.ellipseConnections.length; j++) {
        const [aIdx, bIdx, isHead] = this.ellipseConnections[j];
        const pa = pose.keypoints[aIdx];
        const pb = pose.keypoints[bIdx];
        if (!pa || !pb || pa.confidence <= 0.1 || pb.confidence <= 0.1) continue;

        const cx = (pa.x + pb.x) / 2;
        const cy = (pa.y + pb.y) / 2;
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let majorAxis, minorAxis;
        if (isHead) {
          // Head: ear-to-ear distance is the short axis, vertical span is the long axis
          minorAxis = dist;
          majorAxis = dist * 1.618;
        } else {
          majorAxis = dist;
          minorAxis = dist / 1.618;
        }
        majorAxis *= offsetMultiplier;
        minorAxis *= offsetMultiplier;

        const angle = Math.atan2(dy, dx);
        const px = cx * scaleX + offsetX;
        const py = cy * scaleY + offsetY;

        if (ctx) {
          ctx.push();
          ctx.translate(px, py);
          ctx.rotate(angle);
          if (this.fillEllipses) {
            ctx.fill(255);
            ctx.noStroke();
          } else {
            ctx.noFill();
            ctx.stroke(255);
            ctx.strokeWeight(2);
          }
          ctx.ellipse(0, 0, majorAxis * scaleX, minorAxis * scaleY);
          ctx.pop();
        } else {
          push();
          translate(px, py);
          rotate(angle);
          if (this.fillEllipses) {
            fill(255);
            noStroke();
          } else {
            noFill();
            stroke(255);
            strokeWeight(2);
          }
          ellipse(0, 0, majorAxis * scaleX, minorAxis * scaleY);
          pop();
        }
      }
    }
  }

  // Trail capture for ellipses would just re-render the same shapes; skip for clarity.
  captureTrailSnapshot() {}
  drawSchlemerTrail() {}
  updateTrailParameters() {}

  setFillEllipses(v) { this.fillEllipses = !!v; }
  setContourMode(v) { this.contourMode = !!v; }
}
