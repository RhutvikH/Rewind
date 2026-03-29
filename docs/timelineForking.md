# Rewind: Timeline Forking (Ghost Rewrite)

## Overview

The **Timeline Forking (Ghost Rewrite)** feature transforms code reviews from static, read-only comments into an interactive "What If" sandbox. Reviewers can pause the code's playback and rapidly generate a **Ghost Branch** directly inside the editor. 

This enables reviewers to demonstrate complex architectural changes, refactors, or fixes directly within the real-time context of the file without destroying or altering the developer's original code.

---

## Workflow & Commands

The extension automatically exposes three primary lifecycle commands to VS Code:

### `Rewind: Start Ghost Rewrite`
1. Select any block of text or functional code in the editor.
2. Trigger the command.
3. The extension instantly duplicates the selection:
   - The **Original Code** is isolated by markers and visually deactivated.
   - A **Ghost Sandbox** is generated immediately below it, containing an active duplicate of the selection ready to be edited.

### `Rewind: Accept Ghost Rewrite`
1. Place your cursor anywhere inside the active Ghost Sandbox.
2. Trigger the command.
3. The extension automatically resolves the fork by deleting the original codebase, clearing all marker decorators, and permanently hoisting your ghost code into the file.

### `Rewind: Discard Ghost Rewrite`
1. Place your cursor anywhere inside the active Ghost Sandbox.
2. Trigger the command.
3. The extension safely trashes the sandbox and cleans up the markers, perfectly restoring the original un-edited code exactly as it was.

---

## Architecture & Protections

### 1. The Inline Visual Engine (`src/decorations.ts`)
To prevent the need for separate diff windows, Rewind elegantly renders the simulation inline using custom VS Code editor decorations:
- **Original Block:** Painted with a 40% opacity layer (`0.4`) and a line-through to simulate deactivation.
- **Ghost Block:** Painted with a faint green structural glow (`rgba(0, 255, 128, 0.08)`) to clearly outline the active editing sandbox. 
- **Markers:** Small, isolated boundaries (`// [Rewind: Original Start]`, etc.) visually box in the operation.

### 2. Live Read-Only Zones (`src/ghostBranchManager.ts`)
To guarantee that the user never accidentally corrupts the original code or misaligns the marker system, the extension employs a highly robust **Read-Only Interceptor**:
- When a Ghost Branch is active, Rewind maps its line arrays globally.
- The `vscode.workspace.onDidChangeTextDocument` API hooks into the IDE physics to observe every single keystroke *before* it settles.
- If the reviewer attempts to select or edit the original codebase or the internal marker bounds, the extension immediately catches the operation, forces a native `undo` command, and displays a warning prompt. 
- Only the contents inside the glowing Ghost Sandbox remain editable!
