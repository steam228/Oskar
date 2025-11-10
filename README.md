# OSKAR

**Interactive Body Pose Visualization Installation**

Created by **Rita Olivença** and **André Rocha**  
For **Periphera Festival 2025** | Trafaria, Almada, Portugal  
**FCT UNL** (NOVA School of Science and Technology)

---

## Overview

OSKAR uses computer vision and pose detection to create abstract visualizations of human movement. Body movements are captured through a webcam and rendered as stylized "Schlemer sticks" — geometric lines inspired by Oskar Schlemmer's Bauhaus theater work.

**Technologies:** p5.js, ml5.js, MoveNet pose estimation, dommapper projection mapping

**Key Features:**
- Dual-canvas architecture with independent projection mapping
- Real-time pose detection (17 body keypoints)
- Custom Schlemmer stick rendering (10 fixed connection lines)
- Motion trail/drag effect with dynamic fading
- Detection mask for selective area tracking
- Mirror mode toggle
- Fullscreen support

---

## Keyboard Controls

### Canvas Management

| Key | Function |
|-----|----------|
| **1** | Toggle projection mapping for Canvas 1 |
| **2** | Toggle projection mapping for Canvas 2 |
| **Shift+1** | Show/Hide Canvas 1 |
| **Shift+2** | Show/Hide Canvas 2 |
| **Ctrl+1** | Reset Canvas 1 mapping to default |
| **Ctrl+2** | Reset Canvas 2 mapping to default |
| **Alt+1** | Cycle visualizers on Canvas 1 (OSKAR → Placeholder 1 → Placeholder 2) |
| **Alt+2** | Cycle visualizers on Canvas 2 (OSKAR → Placeholder 1 → Placeholder 2) |

### OSKAR Visualizer

| Key | Function |
|-----|----------|
| **B** | Toggle video background |
| **T** | Toggle trail/drag effect |
| **K** | Recalibrate Schlemmer stick length (stand in T-pose) |
| **M** | Toggle mirror mode (flip video + pose detection) |

### Detection Mask

| Key | Function |
|-----|----------|
| **A** | Toggle mask editing mode |
| **E** | Enable/disable mask filtering |
| **X** | Clear mask completely |
| **Click** | Add mask point (in edit mode) |
| **Shift+Drag** | Move mask point (in edit mode) |

### Projection Mapping

| Key | Function |
|-----|----------|
| **C** | Toggle calibration mode |
| **F** | Toggle fullscreen |
| **L** | Load saved mapping |
| **S** | Save mapping to file |

### General

| Action | Function |
|--------|----------|
| **Double-click** | Toggle fullscreen |

---

## Quick Start

### Setup

1. **Start a local server:**
   ```bash
   # Python 3
   python3 -m http.server 8000
   
   # Or Node.js
   npx http-server -p 8000
   ```

2. **Open browser:** `http://localhost:8000`

3. **Allow camera access** when prompted

4. **Stand in T-pose** and press **K** to calibrate stick lengths

### Installation Workflow

**For projection installations:**

1. Set up your projector(s)
2. Press **Alt+1** / **Alt+2** to assign visualizers to canvases
3. Press **1** to map Canvas 1 to projection surface (drag corners)
4. Press **2** to map Canvas 2 to second surface (if using dual projection)
5. Press **A** to define detection mask (optional - limits tracking area)
6. Press **Double-click** for fullscreen

---

## Dual Canvas System

OSKAR supports **two independent canvases** for dual-projection or flexible setups:

- **Canvas 1:** Primary canvas (top-left) - starts at 40% scale, 50×50px
- **Canvas 2:** Secondary canvas (top-right) - starts at 40% scale, 600×50px

Each canvas can display:
- OSKAR pose detection visualizer
- Placeholder visualizer 1
- Placeholder visualizer 2

**Switching visualizers:** Use **Alt+1** or **Alt+2** to cycle through options

**Both canvases support independent projection mapping** with separate localStorage persistence.

### Mapping Workflow

Since only one canvas can be mapped at a time:

1. Press **1** → map Canvas 1 (red guides appear)
2. Drag corner handles to match projection surface
3. Press **1** again to exit
4. Press **2** → map Canvas 2
5. Drag corner handles for second surface
6. Press **2** again to exit

Both mappings persist between sessions.

---

## Detection Mask

Define a polygon to **limit pose detection to specific areas** (stage, interaction zone, etc.).

### How It Works

- **Video clipping:** Video shows only inside polygon
- **Pose filtering:** Only tracks people with ≥25% of keypoints inside mask
- **Graphics freedom:** Schlemmer sticks extend freely beyond mask boundary
- **Persistent:** Saved to localStorage

### Workflow

1. Press **A** → enter mask edit mode
2. **Click** to add points (minimum 3 points)
3. **Shift+Drag** to move existing points
4. Press **A** again → activate mask
5. Press **E** to toggle mask on/off without clearing
6. Press **X** to clear mask completely

**Visual feedback:** Green polygon with numbered points (edit mode only), yellow highlight when hovering/dragging

---

## Schlemmer Stick System

**10 Fixed Connections** inspired by Oskar Schlemmer's Bauhaus theater work:

**Lower-to-Upper (8 lines):**
1. Right ankle → Right hip
2. Right ankle → Right wrist  
3. Right knee → Right wrist
4. Right knee → Right shoulder
5. Left ankle → Left hip
6. Left ankle → Left wrist
7. Left knee → Left wrist
8. Left knee → Left shoulder

**Centered (2 lines):**
9. Right wrist ↔ Right shoulder (bidirectional)
10. Left wrist ↔ Left shoulder (bidirectional)

**Calibration:** Press **K** while standing in T-pose to set base stick length

---

## Trail/Drag Effect

Captures snapshots of Schlemmer sticks at regular intervals, gradually fading out over time.

**Toggle with T key** (affects all OSKAR canvases)

**Visual effect:** Ghost images that fade in both opacity and line weight

---

## Mirror Mode

Two camera configurations:

| Mode | Description | Use Case |
|------|-------------|----------|
| **ON** (default) | Mirrored display | Camera facing user (like a mirror) |
| **OFF** | Non-mirrored | Camera facing away / rear projection |

**Toggle with M key** - affects both video and pose detection

---

## Projection Mapping

Uses [dommapper](https://github.com/ericrav/dommapper) for quad-corner mapping to any surface.

### Setup Process

1. Press **1** or **2** to enter mapping mode
2. Canvas content hides, red guides appear
3. Drag 4 corner handles to match projection surface
4. Press **1** or **2** again to exit

### Technical Details

- Canvas resolution: 1280×720 (16:9)
- Both canvases start at 40% scale for easy corner access
- Uses CSS matrix3d transforms (hardware accelerated)
- Canvas 1 saved to: `__dommapper-oskar-canvas1`
- Canvas 2 saved to: `__dommapper-oskar-canvas2`

### Reset Mapping

**Quick:** Press **Ctrl+1** or **Ctrl+2**

**Manual (console):**
```javascript
localStorage.removeItem('__dommapper-oskar-canvas1')
localStorage.removeItem('__dommapper-oskar-canvas2')
location.reload()
```

---

## Body Keypoints

17 detected keypoints via MoveNet:

| Index | Body Part | Index | Body Part |
|-------|-----------|-------|-----------|
| 0 | Nose | 9 | Left Elbow |
| 1 | Left Eye | 10 | Right Elbow |
| 2 | Right Eye | 11 | Left Hip |
| 3 | Left Ear | 12 | Right Hip |
| 4 | Right Ear | 13 | Left Knee |
| 5 | Left Shoulder | 14 | Right Knee |
| 6 | Right Shoulder | 15 | Left Ankle |
| 7 | Left Wrist | 16 | Right Ankle |
| 8 | Right Wrist | | |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Camera not working | Access via `localhost` or `https` (not `file://`) |
| | Check browser camera permissions |
| Pose detection issues | Ensure adequate lighting and full body visibility |
| | Check if detection mask is active (press **A** to check) |
| Sticks wrong length | Press **K** while in T-pose to recalibrate |
| Canvas not showing | Press **Shift+1** or **Shift+2** to toggle visibility |
| Reset all settings | Console: `localStorage.clear()` then `location.reload()` |

---

## File Structure

```
OSKAR/
├── index.html                 # Main HTML
├── sketch.js                  # Dual canvas manager
├── PoseVisualizer.js          # OSKAR visualizer (Schlemmer + trail)
├── PlaceholderVisualizer.js   # Simple placeholder
├── sketchPose.js              # Backup (full-featured version)
├── style.css                  # Styling
├── libs/                      # p5.js + ml5.js libraries
└── README.md                  # This file
```

**Architecture:**
- `sketch.js`: Main controller for dual canvas system and projection mapping
- `PoseVisualizer.js`: Simplified OSKAR with Schlemmer sticks + trail only
- `PlaceholderVisualizer.js`: Simple test visualizer
- Visualizers swap between canvases via **Alt+1** / **Alt+2**

---

## Credits

**Concept & Development:**
- Rita Olivença
- André Rocha

**Institutional Support:**
- FCT UNL (NOVA School of Science and Technology)
- Periphera Festival

**Technical Framework:**
- [p5.js](https://p5js.org/) - Creative coding
- [ml5.js](https://ml5js.org/) - Machine learning
- [MoveNet](https://www.tensorflow.org/hub/tutorials/movenet) - Pose detection
- [dommapper](https://github.com/ericrav/dommapper) - Projection mapping

**Artistic Inspiration:**
- Oskar Schlemmer - Bauhaus Theater & Triadisches Ballett

---

## About Periphera Festival 2025

Multidisciplinary arts festival exploring technology, interactivity, and human connection through digital media, performance, and installation art.

**Location:** Trafaria, Almada, Portugal  
**Year:** 2025  
**Institution:** FCT UNL

---

## License

Created for Periphera Festival 2025 exhibition.  
For inquiries about reuse or adaptation, please contact the creators.

---

*Created with ❤️ for Periphera Festival 2025*
