# OSKAR

**Interactive Body Pose Visualization Installation with Sensor Integration**

Created by **Rita Olivença** and **André Rocha**  
For **Periphera Festival 2025** | Trafaria, Almada, Portugal  
**FCT UNL** (NOVA School of Science and Technology)

---

## Overview

OSKAR uses computer vision and pose detection to create abstract visualizations of human movement. Body movements are captured through a webcam and rendered as stylized "Schlemer sticks" — geometric lines inspired by Oskar Schlemmer's Bauhaus theater work. The system integrates with micro:bit sensors for dynamic trail control.

**Technologies:** p5.js, ml5.js, MoveNet pose estimation, p5.mapper projection mapping, p5.webserial

**Key Features:**
- Dual-canvas architecture with independent projection mapping
- Real-time pose detection (17 body keypoints) 
- Three distinct visualizer types with configurable behaviors
- Sensor-responsive trail system via micro:bit integration
- Physics-based springy line rendering with elasticity control
- Detection mask for selective area tracking
- Mirror mode toggle
- Fullscreen support

---

## Visualizer Types

OSKAR offers three distinct visualization modes:

| Type | Description | Trail Behavior |
|------|-------------|----------------|
| **White+Trail** | Classic white Schlemmer sticks | Sensor-responsive trails |
| **Clear** | Pure white sticks, always clean | No trails (immune to sensors) |
| **Springy+Trail** | Physics-based white bezier curves | Sensor-responsive trails + elasticity |

---

## Complete Keyboard Controls

| Key | Function |
|-----|----------|
| **Projection Mapping** |
| **C** | Toggle calibration mode (drag corners to map) |
| **S** | Save current mapping |
| **L** | Load saved mapping |
| **F** | Toggle fullscreen |
| **Canvas Visibility** |
| **Shift+1** | Show/Hide Canvas 1 |
| **Shift+2** | Show/Hide Canvas 2 |
| **Visualizer Selection** |
| **Alt+1** | Cycle Canvas 1 (White+Trail → Clear → Springy+Trail) |
| **Alt+2** | Cycle Canvas 2 (White+Trail → Clear → Springy+Trail) |
| **Pose Controls** |
| **B** | Toggle video background |
| **T** | Toggle trail effect |
| **R** | Recalibrate Schlemmer stick length (stand in T-pose) |
| **K** | Recalibrate Schlemmer stick length (alternative) |
| **M** | Toggle mirror mode |
| **Detection Mask** |
| **A** | Toggle mask editing mode |
| **E** | Enable/disable mask filtering |
| **X** | Clear mask completely |
| **Sensor Integration** |
| **P** | Connect sensor port / Enable simulation mode |
| **+** | Increase springy line elasticity |
| **-** | Decrease springy line elasticity |
| **Mouse Actions** |
| **Click** | Add mask point (in mask edit mode) |
| **Shift+Drag** | Move mask point (in mask edit mode) |
| **Double-click** | Toggle fullscreen |

---

## Sensor Integration (OskarBit System)

### Hardware Setup
1. **Micro:bit receiver** connected via USB (runs receiver code)
2. **1-6 micro:bit senders** with accelerometer data (sensor IDs 1-6)
3. **Serial communication** at 115200 baud rate

### Sensor Effects
- **XY Motion** (combined) controls trail frequency and persistence
  - No motion = no trails
  - High motion = dramatic trail effects (up to 300 trail frames)
- **Z Motion** automatically controls springy line elasticity (0.2-2.5 range)
- **Most dynamic sensor** wins (highest motion level controls effects)

### Connection
1. **Press P** to connect sensor port
2. **Select micro:bit port** from browser dialog
3. **Sensors auto-register** as S1-S6
4. **Move sensors** to see immediate trail response

### Simulation Mode
If no sensors available, **Press P** enables mouse simulation:
- **Mouse position** = XY sensor motion
- **Automatic Z oscillation** = springiness demo

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

4. **Stand in T-pose** and press **R** to calibrate stick lengths

### Installation Workflow
**For projection installations:**

1. Set up your projector(s)
2. Press **Alt+1** / **Alt+2** to select visualizers for each canvas
3. Press **C** to enter calibration mode, drag corners to map projection surface
4. Press **C** again to exit calibration
5. Press **A** to define detection mask (optional - limits tracking area)
6. Press **P** to connect sensors (optional - for dynamic trails)
7. Press **F** for fullscreen

---

## Dual Canvas System

OSKAR supports **two independent canvases** for dual-projection setups:

- **Canvas 1 & 2:** Each can display any of the three visualizer types
- **Independent mapping:** Each canvas maps separately to projection surfaces
- **Shared sensors:** All visualizers respond to the same sensor data
- **Clear visualizer exception:** Always immune to sensor trail effects

### Mapping Workflow
1. Press **C** → enter calibration mode (corners become draggable)
2. **Drag 4 corners** to match your projection surface(s)
3. Press **C** again → exit calibration mode
4. Settings automatically saved to localStorage

---

## Detection Mask

Define a polygon to **limit pose detection to specific areas** (stage, interaction zone, etc.).

### How It Works
- **Video clipping:** Video shows only inside polygon
- **Pose filtering:** Only tracks people with ≥25% of keypoints inside mask
- **Graphics freedom:** Schlemmer sticks extend freely beyond mask boundary
- **Persistent:** Saved to localStorage

### Workflow
1. Press **A** → enter mask edit mode (fullscreen video with overlay)
2. **Click** to add points (minimum 3 points)
3. **Shift+Drag** to move existing points
4. Press **A** again → exit edit mode
5. Press **E** to toggle mask on/off without clearing
6. Press **X** to clear mask completely

---

## Schlemmer Stick System

**9 Fixed Connections** inspired by Oskar Schlemmer's Bauhaus theater work:

1. Right ankle → Right knee
2. Right knee → Right hip  
3. Right hip → Right shoulder
4. Right shoulder → Right wrist
5. Left ankle → Left knee
6. Left knee → Left hip
7. Left hip → Left shoulder
8. Left shoulder → Left wrist
9. Left shoulder ↔ Right shoulder (centered line)

**Calibration:** Press **R** while standing in T-pose to set base stick length

---

## Springy Line Physics

The **Springy+Trail** visualizer uses physics simulation for dynamic line behavior:

### Parameters
- **Spring Strength:** How quickly lines return to rest position
- **Damping:** How much bounce vs. stiffness
- **Elasticity:** Overall multiplier (0.1 = very stiff, 3.0 = very bouncy)

### Controls
- **+/-** keys: Manual elasticity adjustment
- **Z sensor motion:** Automatic elasticity control (overrides manual)
- **Real-time response:** Immediate visual feedback

---

## Mirror Mode

| Mode | Description | Use Case |
|------|-------------|----------|
| **ON** (default) | Mirrored display | Camera facing user (like a mirror) |
| **OFF** | Non-mirrored | Camera facing away / rear projection |

**Toggle with M key** - affects both video and pose detection

---

## Projection Mapping

Uses [p5.mapper](https://github.com/jdeboi/p5.mapper) for quad-corner mapping to any surface.

### Technical Details
- Canvas resolution: 1280×720 (16:9)
- Uses WebGL transforms for hardware acceleration
- Mapping data saved to localStorage automatically
- Independent mapping for each canvas

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
| Sticks wrong length | Press **R** while in T-pose to recalibrate |
| Canvas not showing | Press **Shift+1** or **Shift+2** to toggle visibility |
| Sensors not connecting | Install micro:bit receiver code, check USB connection |
| No trail effects | Press **P** to connect sensors or enable simulation |
| Browser serial issues | Use Chrome/Edge, ensure HTTPS or localhost |
| Reset all settings | Console: `localStorage.clear()` then `location.reload()` |

---

## File Structure

```
OSKAR/
├── index.html                      # Main HTML with library imports
├── sketch.js                       # Main controller with sensor integration
├── SchlemerVisualizer.js           # Base visualizer class
├── WhiteSchlemerVisualizer.js      # White sticks with trails
├── ClearRedSchlemerVisualizer.js   # Clear white sticks (no trails)
├── SpringyBlueSchlemerVisualizer.js # Physics-based springy curves
├── PoseVisualizer.js               # Legacy pose visualizer
├── sketchPose.js                   # Backup/alternative version  
├── style.css                       # Styling
├── libs/                           # Local p5.js + ml5.js libraries
├── maps/                           # Projection mapping data
└── README.md                       # This file
```

**Architecture:**
- `sketch.js`: Main controller with dual canvas system, pose detection, and sensor integration
- `SchlemerVisualizer.js`: Base class for all visualizer types
- Three specialized visualizers with different trail behaviors
- Sensor integration via OskarBit micro:bit system

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
- [p5.mapper](https://github.com/jdeboi/p5.mapper) - Projection mapping
- [p5.webserial](https://github.com/gohai/p5.webserial) - Serial communication

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