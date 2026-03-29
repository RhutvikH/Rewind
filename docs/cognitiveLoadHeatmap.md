# Rewind: Cognitive Load Heatmap

## Overview

The **Cognitive Load Heatmap** is a core feature of the Rewind extension designed to visibly map out the areas of code where a developer experienced the highest friction, struggle, or "cognitive load." 

By tracking typing behaviors—specifically deletions and true pauses—the system paints a background color gradient directly onto the VS Code editor lines. This allows reviewers to instantly zone in on complex logic or difficult refactors that might require closer attention.

---

## Activation

To toggle the heatmap on or off, run the following command from the VS Code Command Palette:
**`Rewind: Toggle Cognitive Load Heatmap`** (`rewind.toggleHeatmap`)

When activated:
1. A **notification** confirms "Cognitive Load Heatmap Enabled".
2. The system dynamically analyzes the current file's line metrics.
3. A **smooth color gradient** is overlaid on the editor lines.

Hovering over any highlighted line will display a breakdown of the cognitive load:
- **Linear Typing**: Base edits.
- **Deletions / Backspaces**: High friction edits.
- **Dwell time (Pauses)**: Significant pauses in typing.

---

## Architecture & Algorithms

### 1. The Strategy Pattern (`CognitiveLoadStrategy`)
The calculation of cognitive load is isolated behind a formal `Strategy` design pattern (`src/strategies/CognitiveLoadStrategy.ts`). This ensures the logic is modular, highly cohesive, and easily swappable if different calculation metrics are desired in the future.

### 2. The Default Strategy (`DeletionsAndPausesStrategy`)
Currently, the system uses the `DeletionsAndPausesStrategy`, which deliberately ignores standard "linear typing." Instead, it aggressively penalizes:
1. **Deletions / Rewrites**: Tracked via exact `rangeLength` drops during document modifications.
2. **True Pauses**: The system only tracks "dwell time" if the user has been completely inactive (no typing) for over `1000ms`. This elegantly excludes long, continuous typing sessions from being falsely flagged as cognitive load.

**The Formula:**
```typescript
// Grace period: First 5 seconds of idle dwell time don't count
const effectiveDwellSeconds = Math.max(0, (metrics.dwellTimeMs - 5000) / 1000);

// Score Calculation (Tunable Weights)
return (metrics.deletions * 0.2) + (effectiveDwellSeconds * 0.1);
```

### 3. Smooth Visual Rendering

To ensure the physical UI is organically pleasing and avoids jarring visual leaps or disconnected "jagged" highlights, the decorations layer implements both spatial blending and dense color interpolation:

- **1D Spatial Blur**: Before coloring, the line scores are passed through a convolution kernel (`[0.2, 0.6, 0.2]`). This means a highly complex line will organically "bleed" its glow into the lines directly above and below it, creating a soft, connected heatmap.
- **21-Step Gradient Mapping**: The extension registers 21 distinct background decoration ranges. As the smoothed score climbs, the color maps dynamically from a highly transparent faint yellow (`rgba(255, 255, 0, 0.0)`) up to a solid tension red (`rgba(255, 0, 0, 0.6)`). This entirely eliminates the visual "snapping" typically seen in threshold-bound coloring (e.g., suddenly jumping from yellow to orange).