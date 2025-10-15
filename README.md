# OSKAR

**Interactive Body Pose Visualization Installation**

Created by **Rita Olivença** and **André Rocha**  
For **Periphera Festival 2025**  
Trafaria, Almada, Portugal  
**FCT UNL** (NOVA School of Science and Technology)

---

## 📖 Overview

OSKAR is an interactive installation that uses computer vision and pose detection to create dynamic, abstract visualizations of human movement. The system captures participants' body movements through a webcam and renders them as stylized "Schlemer sticks" — geometric lines inspired by Oskar Schlemmer's Bauhaus theater work — overlaid on the live video feed.

The installation explores the intersection of human motion, geometry, and real-time digital interpretation, creating a visual dialogue between the participant and the machine's understanding of their body.

---

## 🎨 Concept

The project draws inspiration from:
- **Oskar Schlemmer's Bauhaus theater** - Geometric abstraction of the human form
- **Motion capture aesthetics** - Technical representation of human movement
- **Live interactive art** - Audience participation and real-time generation

Participants see themselves transformed into abstract geometric compositions, where their body becomes a framework for dynamic line drawings that extend and connect in unexpected ways.

---

## 🛠️ Technical Overview

### Technologies Used
- **p5.js** - Creative coding framework for rendering
- **ml5.js** - Machine learning library for pose detection
- **MoveNet** - Google's pose estimation model
- **MediaPipe** - Body skeleton detection

### Key Features
- **Real-time pose detection** with 17 body keypoints
- **Custom Schlemer stick rendering** with 10 fixed connection lines
- **Exponential smoothing** for stable, fluid motion
- **Dynamic line length calculation** based on body proportions
- **Toggle visibility controls** for different visual layers
- **Fullscreen support** for installation display
- **Responsive canvas** that adapts to window size

---

## 🎮 Interactive Controls

### Visibility Toggles
| Key | Function | Default |
|-----|----------|---------|
| **S** | Toggle skeleton & keypoints visibility | ON |
| **O** | Toggle Schlemer connections visibility | ON |
| **E** | Toggle sequential ellipses visibility | OFF |
| **X** | Toggle unified offset contour visibility | OFF |
| **B** | Toggle video background (black when off) | ON |

### Configuration
| Key | Function |
|-----|----------|
| **R** | Reconfigure Schlemer connections + Toggle E ellipses fill (stroke/solid) |
| **C** | Recalculate line length + Toggle X ellipses fill (stroke/solid) |

### Smoothing Adjustment
| Key | Function |
|-----|----------|
| **+** or **=** | Increase smoothing factor (+0.1) → More responsive |
| **-** | Decrease smoothing factor (-0.1) → More smooth |

### Display
| Action | Function |
|--------|----------|
| **Double-click** | Toggle fullscreen mode |

---

## 🎯 Schlemer Stick Configuration

The system generates **10 fixed connection lines** between body keypoints:

### Lower-to-Upper Body Connections (8 lines)
Lines start from lower body and extend through upper body points:

1. **Right ankle → Right hip**
2. **Right ankle → Right wrist**
3. **Right knee → Right wrist**
4. **Right knee → Right shoulder**
5. **Left ankle → Left hip**
6. **Left ankle → Left wrist**
7. **Left knee → Left wrist**
8. **Left knee → Left shoulder**

### Centered Upper Body Connections (2 lines)
Lines are centered between two upper body points:

9. **Right wrist ↔ Right shoulder** (centered)
10. **Left wrist ↔ Left shoulder** (centered)

### Line Length Calculation
All lines share the same total length, calculated as:
```
Line Length = 1.5 × (Distance from ankle to nose)
```

This ensures uniform line lengths regardless of body size or position, creating a consistent visual language.

---

## 🔧 Smoothing System

### How It Works
The system uses **Exponential Moving Average (EMA)** smoothing to stabilize keypoint positions and reduce jitter:

```javascript
smoothedPosition = previousPosition × (1 - factor) + newPosition × factor
```

### Smoothing Factor Parameters

| Value | Effect | Use Case |
|-------|--------|----------|
| **0.0** | Maximum smoothing | Very stable but very laggy (not recommended) |
| **0.1-0.3** | High smoothing | Smooth motion with some lag - good for slow movements |
| **0.5** | **Balanced (default)** | Good compromise between smoothness and responsiveness |
| **0.7-0.9** | Low smoothing | More responsive - good for fast movements |
| **1.0** | No smoothing | Instant response, original jitter |

### Recommended Settings by Context
- **General installation use:** `0.5` (default)
- **Dancing/fast motion:** `0.6-0.8`
- **Slow controlled movements:** `0.3-0.5`
- **Video recording:** `0.3-0.4` (smoother appearance)

---

## 🖥️ Installation Setup

### Requirements
- Modern web browser (Chrome, Firefox, Edge)
- Webcam access
- Local web server (for camera permissions)

### Quick Start

1. **Clone or download** the project files:
   ```bash
   cd OSKAR
   ```

2. **Start a local server**:
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Or using Python 2
   python -m SimpleHTTPServer 8000
   
   # Or using Node.js
   npx http-server -p 8000
   ```

3. **Open in browser**:
   ```
   http://localhost:8000
   ```

4. **Allow camera access** when prompted

5. **Press R** once pose detection is active to initialize Schlemer connections

### For Public Installation

1. **Use a dedicated machine** with reliable webcam
2. **Set browser to fullscreen** (double-click or F11)
3. **Position camera** to capture full body of participants
4. **Test lighting conditions** - ensure good visibility
5. **Adjust smoothing** based on space and movement type
6. **Customize visual display**:
   - Press **S** to hide skeleton for cleaner views
   - Press **B** to hide video and show graphics on black background
   - Press **E** to show inner ellipses (body structure)
   - Press **X** to show expanded outer contour (body volume/aura)
   - Press **O** to show Schlemer geometric connections

---

## 📁 File Structure

```
OSKAR/
├── index.html          # Main HTML file
├── sketch.js           # Main p5.js sketch with all logic
├── style.css           # Styling (minimal, full-screen layout)
└── README.md           # This file
```

---

## 🎨 Visual Layers

The installation renders multiple visual layers (all toggleable):

### 1. Video Layer (toggle with B)
- Live webcam feed
- Mirrored for natural interaction
- Scales to fill canvas while maintaining aspect ratio
- Can be toggled OFF to show graphics on pure black background

### 2. Skeleton Layer (toggle with S)
- **Connections**: Red lines (0.5px) connecting body joints
- **Keypoints**: Green circles (4px) at detected body points
- Standard anatomical skeleton structure

### 3. Schlemer Layer (toggle with O)
- **Thick white lines** (6px) connecting body points
- Fixed configuration of 10 lines
- Uniform length based on body proportions
- Extends beyond body boundaries

### 4. Sequential Ellipses Layer (toggle with E)
- **White stroke ellipses** (1px, no fill) drawn along skeleton segments
- **Fill mode**: Press **R** to toggle between stroke and solid white fill
- Creates organic flowing shapes following anatomical body connections
- **Body segments**: Major axis aligned along the segment, minor axis = major/1.618
- **Face connections are excluded** (no ellipses on nose/eyes connections)
- **Special head ellipse**: From left ear to right ear with **inverted proportions**
  - Distance between ears becomes the **minor axis** (horizontal)
  - Perpendicular dimension is the **major axis** = distance × 1.618 (vertical)
  - Creates a taller ellipse representing the head volume
- Calculated in real-time based on 2D distance between connected joints
- Creates a fluid, continuous visual representation of body structure
- **When filled**: Creates solid white body segments that can blend together

### 5. Unified Offset Contour Layer (toggle with X)
- **Expanded ellipses** that create an outer boundary around the body
- **Fill mode**: Press **C** to toggle between stroke and solid white fill
- Uses the same ellipse calculations as layer 4 but with **1.618× offset applied**
- All ellipses are scaled outward by the golden ratio multiplier
- **Visual effect**: Overlapping expanded ellipses create a **unified outer silhouette**
- When ellipses intersect, they form a continuous boundary suggesting a boolean union
- Creates an **expanded body volume** representation
- Works independently from the E key (can show both or either)
- Perfect for creating an "aura" or volumetric representation of the body
- **Key difference from E**: These are larger, creating the outer envelope of the form
- **When filled**: Creates a solid white volumetric blob around the body

### Recommended Visual Combinations

**Pure Graphics Mode:**
- Press **B** to hide video (black background)
- Press **S** to hide skeleton
- Press **O** to show Schlemer connections
- Result: Clean white geometric lines on black

**Organic Body Mode:**
- Press **B** to hide video
- Press **S** and **O** to hide other layers
- Press **E** to show ellipses only
- Result: Flowing elliptical forms on black

**Full Abstraction:**
- Press **B** to hide video
- Enable **O** (Schlemer) and **E** (Ellipses)
- Result: Geometric + organic fusion on black

**Video Overlay:**
- Keep video ON (default)
- Toggle any combination of S, O, E, X as desired
- Result: Graphics overlaid on live video feed

**Body Volume Visualization:**
- Press **B** to hide video
- Press **S** and **O** to hide skeleton and Schlemer
- Press **E** and **X** together
- Result: Inner ellipses (E) + outer contour (X) create volumetric body representation

**Aura Effect:**
- Press **B** to hide video
- Hide all except **X** (unified contour)
- Result: Expanded outer boundary only, like a body "aura"

**Layered Depth:**
- Black background (**B** off)
- Enable **E** + **X** simultaneously
- Result: Two-layer ellipse system showing inner structure and outer volume

**Solid Body Blob:**
- Press **B** to hide video
- Enable **X** and press **C** to fill
- Result: Solid white volumetric blob representing body space

**Organic Fill with Structure:**
- Black background, enable **E** and **X**
- Press **R** to fill inner ellipses (solid segments)
- Keep **X** as stroke for outer boundary
- Result: Filled body segments with outer contour line

**Complete Fill:**
- Enable both **E** and **X**
- Press **R** and **C** to fill both
- Result: Dense white form with overlapping inner and outer volumes

---

## 🧮 Body Keypoint Index Reference

The system detects 17 keypoints:

| Index | Body Part |
|-------|-----------|
| 0 | Nose |
| 1 | Left Eye |
| 2 | Right Eye |
| 3 | Left Ear |
| 4 | Right Ear |
| 5 | Left Shoulder |
| 6 | Right Shoulder |
| 7 | Left Wrist |
| 8 | Right Wrist |
| 9 | Left Elbow |
| 10 | Right Elbow |
| 11 | Left Hip |
| 12 | Right Hip |
| 13 | Left Knee |
| 14 | Right Knee |
| 15 | Left Ankle |
| 16 | Right Ankle |

---

## 🎭 About Periphera Festival 2025

**Periphera Festival** is a multidisciplinary arts festival taking place in Trafaria, Almada, Portugal. The festival explores themes of technology, interactivity, and human connection through digital media, performance, and installation art.

**Location:** Trafaria, Almada, Portugal  
**Year:** 2025  
**Institution:** FCT UNL (NOVA School of Science and Technology)

---

## 👥 Credits

**Concept & Development:**
- **Rita Olivença**
- **André Rocha**

**Institutional Support:**
- **FCT UNL** (NOVA School of Science and Technology)
- **Periphera Festival**

**Technical Framework:**
- Built with [p5.js](https://p5js.org/)
- Powered by [ml5.js](https://ml5js.org/)
- Pose detection via [MoveNet](https://www.tensorflow.org/hub/tutorials/movenet)

**Artistic Inspiration:**
- Oskar Schlemmer - Bauhaus Theater & Triadisches Ballett

---

## 📄 License

This project is created for the Periphera Festival 2025 exhibition.

For inquiries about reuse or adaptation, please contact the creators.

---

## 🐛 Troubleshooting

### Camera not working
- Ensure you're accessing via `localhost` or `https` (not `file://`)
- Check browser camera permissions
- Try a different browser (Chrome recommended)

### Pose detection not working
- Ensure adequate lighting
- Stand at appropriate distance from camera (full body visible)
- Check browser console for errors

### Performance issues
- Close unnecessary browser tabs
- Reduce video resolution in code if needed
- Ensure adequate hardware (GPU acceleration helps)

### Lines appear jittery
- Decrease smoothing factor (press `-` key)
- Ensure stable lighting conditions
- Check if webcam has hardware smoothing enabled

---

## 🔮 Future Development Ideas

- Multiple participant detection
- Color customization via keyboard
- Recording/screenshot functionality
- Different Schlemer configurations
- Audio reactivity
- Projection mapping support
- Trail effects on lines
- Variable line thickness based on movement speed

---

## 🔬 Technical Notes: Extracting Outer Contour from Filled Blobs

### Question: Is it possible to get the outer contour of a white blob generated inside the code?

**Short Answer: Yes, but it's computationally intensive in real-time.**

### Approaches:

#### 1. **Marching Squares Algorithm** (Most reliable)
- Scans the pixel buffer to detect edges between white and black pixels
- Traces the outline to create a continuous contour path
- **Pros**: Accurate, creates true outer boundary
- **Cons**: CPU-intensive, requires pixel-level analysis each frame

```javascript
// Pseudo-code
function extractContour() {
  loadPixels();
  let contour = marchingSquares(pixels, threshold=128);
  return contour; // Array of points defining outer edge
}
```

#### 2. **p5.js Pixel Buffer Analysis**
- Render filled ellipses to an off-screen buffer
- Use `loadPixels()` to analyze the image
- Find boundary pixels where white meets black
- Connect boundary points into a path

**Implementation considerations:**
- Requires `createGraphics()` for off-screen rendering
- Need to scan pixels (can be slow for high-res canvas)
- Would add 10-30ms processing time per frame

#### 3. **OpenCV.js Integration**
- Use OpenCV's `findContours()` function
- Extremely efficient and robust
- **Pros**: Fast, battle-tested algorithms
- **Cons**: Adds ~1MB library dependency

#### 4. **Computational Geometry Approach**
- Calculate actual intersection points of all ellipses
- Use Sutherland-Hodgman or similar clipping algorithm
- Build convex/concave hull from intersection points
- **Pros**: Mathematically precise
- **Cons**: Complex implementation, many edge cases

### Recommended Approach for OSKAR:

**Use filled X layer (current implementation) as visual approximation:**
- When ellipses are filled and overlap, they naturally create a blob
- The overlapping creates visual union effect
- For performance, this is the best option

**If true contour is needed:**
1. Render filled X layer to off-screen graphics buffer
2. Use simplified marching squares on downsampled image
3. Draw resulting contour path with stroke
4. Cache result for several frames to reduce computation

### Performance Impact:
- Current filled ellipses: <1ms overhead
- Pixel-based contour extraction: 10-30ms (may cause frame drops)
- Acceptable for recording/still captures, challenging for real-time at 60fps

### Conclusion:
For real-time installation, the current overlapping filled ellipses provide an excellent visual approximation of a unified blob. For post-processing or special modes, contour extraction can be implemented using marching squares or OpenCV.js.

---

## 📞 Contact

For questions, feedback, or collaboration inquiries regarding this installation:

**Rita Olivença & André Rocha**  
FCT UNL - NOVA School of Science and Technology  
Periphera Festival 2025

---

*Created with ❤️ for Periphera Festival 2025*

