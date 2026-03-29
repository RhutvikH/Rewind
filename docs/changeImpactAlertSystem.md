# Rewind: Change Impact Alert System

## Overview

The **Change Impact Alert System** is a powerful cross-file reference analysis tool that automatically detects when a change in one file might break or affect code in other parts of the workspace. 

By mapping out exported symbols and their usages, Rewind ensures that you are immediately aware of the "ripple effect" of your refactors or changes.

---

## How It Works

### 1. Automatic Analysis on Save
Every time you save a TypeScript or JavaScript file, Rewind silently analyzes the exported symbols (functions, classes, types, etc.) in that file. It then performs a workspace-wide search for any locations that reference those symbols.

### 2. Impact Alerts
If references are found in *other* files, the system:
- Shows a **Warning Notification** with a summary of the affected locations.
- Updates the **Status Bar** with the total count of potential impacts.
- Places **Gutter Decorations** (Warning icon) on the exact lines in the affected files that reference the changed code.

### 3. Hover Insights
Hovering over an impacted line provides a detailed message:
`References 'mySymbol' from 'src/utils.ts', which was just modified. Verify it still works as expected.`

---

## Commands

### `Rewind: Analyze Change Impact on Active File` (`rewind.analyzeImpact`)
Manually trigger an analysis of the current file's impact on the rest of the project. Useful if you want to check impact before saving or on an existing file.

### `Rewind: Show Impact Analysis Results` (`rewind.showImpactResults`)
Opens a dedicated **Results Panel** (Webview) that lists all current impact alerts, grouped by file. Clicking a result instantly navigates you to the affected code.

### `Rewind: Clear All Impact Alerts` (`rewind.clearImpactAlerts`)
Purges all current impact highlights and resets the status bar.

---

## Technical Implementation

- **Symbol Extraction**: Uses regex patterns to identify `export`, `export default`, and `export { ... }` declarations.
- **Reference Provider**: Leverages VS Code's native `vscode.executeReferenceProvider` command to find usages across the workspace.
- **Persistence**: Alerts are kept in-memory during the session and updated dynamically as you navigate and edit files.
