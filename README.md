# Rewind

**Supercharge your development and code reviews with living documentation and real-time insights.**

Rewind is a VS Code extension designed to bridge the gap between writing code and explaining it. It provides a suite of tools for tracking cognitive load, managing intent, analyzing change impact, and synchronized audio commentary—all directly inside your editor.

---

## Key Features

### [Cognitive Load Heatmap](./docs/cognitiveLoadHeatmap.md)
Visualize where you struggled the most. Rewind tracks deletions and pauses to paint a real-time heatmap of your "cognitive friction," helping you identify complex blocks that need refactoring or closer review.

### [Instant Intent Markers](./docs/IntentMarkers.md)
Drop meaningful "intent badges" (e.g., `Refactoring`, `Bug Fix`, `Needs Review`) on any line. Communicate *why* you wrote code a certain way without cluttering your logic with permanent comments.

### [Paste Genealogy & Drift Analysis](./docs/paste_geneology.md)
Track the provenance of pasted code. Automatically detect snippets from StackOverflow or other sources and monitor how much they "drift" from the original source as you modify them.

### [Timeline Forking (Ghost Rewrite)](./docs/timelineForking.md)
Review code by *demoing* alternatives. Create "Ghost Branches" to rewrite code blocks in a sandbox without altering the original code, allowing for interactive "What If" scenarios during reviews.

### [Change Impact Alert System](./docs/changeImpactAlertSystem.md)
Understand the ripple effect of your changes. Automatically analyze workspace-wide impacts when you save a file, highlighting every location that might be affected by your refactor.

### [Contextual Audio Sync](./docs/contextualAudioSync.md)
Record your thought process as you code. Rewind syncs your voice to specific lines and selection events, allowing others to click a line and hear exactly what you were thinking at that moment.

---

## Installation & Setup

1. Search for **Rewind** in the VS Code Marketplace and click **Install**.
2. **Audio Sync Dependency**: Ensure [SoX](http://sox.sourceforge.net/) is installed on your system for audio recording capabilities.
3. Open any TypeScript or JavaScript project to begin.

---

## Configuration

Customize your Rewind experience in `settings.json`:

- `rewind.intentMarkerColor`: Customize the highlight color for intent markers.
- `rewind.customIntentCategories`: Define your own team-specific intent labels.

---

## Common Commands

| Command | Description |
| --- | --- |
| `Rewind: Toggle Cognitive Load Heatmap` | Show/hide the friction heatmap. |
| `Rewind: Add Intent Marker` | Drop a badge on the current line. |
| `Rewind: Start Ghost Rewrite` | Fork a code block into a sandbox. |
| `Rewind: Analyze Change Impact` | Manually check cross-file impacts. |
| `Rewind: Start Thought Recording` | Begin an audio-synced session. |
| `Rewind: Show Code Graph` | Visualize project dependencies. |

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
