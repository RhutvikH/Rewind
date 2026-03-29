# Rewind: Contextual Audio Sync

## Overview

**Contextual Audio Sync** allows developers to record their "stream of consciousness" as they code or review. Unlike regular voice notes, these recordings are **spatially aware**—they know exactly which line of code you were looking at or typing on at any given second.

This creates a "living documentation" where any developer can click a line of code and hear the original author's thought process behind it.

---

## Features

### 1. Thought Recording
Capture your verbal explanations as you code. The system tracks:
- Which file you are in.
- Which line your cursor is on (Selection events).
- Which line you are currently editing (Change events).

### 2. Visual Explanation Badges
Lines that have associated audio explanations are marked with a **Microphone Icon** in the gutter. A soft yellow background highlight (`rgba(255, 200, 0, 0.08)`) indicates the depth of recorded context.

### 3. Spatially-Synced Playback
Hovering over a marked line reveals a "Play Recording" link. Clicking it opens a dedicated **Rewind Playback** panel that starts the audio exactly at the moment you were discussing that specific line.

### 4. Code Graph Visualization
Run the Code Graph command to see a visual map of your project's architecture, helping you understand the dependencies and flow of information alongside your audio notes.

---

## Workflow & Commands

### `Rewind: Start Thought Recording` (`rewind.startRecording`)
Starts the recording session. Ensure your microphone is active. As you move around the code or type, Rewind drops "sync markers" automatically.

### `Rewind: Stop Thought Recording` (`rewind.stopRecording`)
Stops the session and saves the audio (`.wav`) and metadata (`.json`) into the project's `.rewind/` folder.

### `Rewind: Play Explanation For This Line` (`rewind.playForLine`)
Plays the most recent audio explanation for the current line.

### `Rewind: Show Code Graph` (`rewind.showGraph`)
Opens an interactive visualization of the project's file dependencies.

---

## Prerequisites

To use Audio Sync, you must have **SoX (Sound eXchange)** installed on your system and available in your `PATH`.
- **Linux**: `sudo apt-get install sox libsox-fmt-all`
- **macOS**: `brew install sox`
- **Windows**: Download the binary and add to PATH.

---

## Data Privacy
All recordings are stored **locally** in a `.rewind/` directory within your workspace. No audio data ever leaves your machine.
