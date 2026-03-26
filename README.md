# Rewind README

This is the README for your extension "rewind". After writing up a brief description, we recommend including the following sections.

## Features

- Paste Geneology and Drift Analysis

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

Users appreciate release notes as you update your extension.

## Documentation
## Paste Geneology and Drift Analysis

Paste Genealogy is a core feature of the Rewind extension that helps users track the provenance and evolution of code snippets pasted from external sources.

### Core Features

1. **Automatic Paste Detection**
   - The extension automatically intercepts code pasted into the editor (for snippets of 10 characters or more).
   - Upon detecting a paste, the user is prompted to optionally provide a source for the snippet (e.g., "StackOverflow", "GitHub", "Internal Wiki").

2. **Drift Calculation**
   - As the pasted code is modified, the extension tracks its evolution.
   - It calculates a "Drift" percentage using the Levenshtein distance between the original pasted snippet and the current state of the block.
   - If the text block is expanded or shifted by new lines, the extension automatically adjusts its tracking coordinates.

3. **Visual Indicators and Hovers**
   - Tracked pasted snippets are highlighted with a distinct background decoration.
   - Hovering over a highlighted snippet displays:
     - The **Source** of the snippet.
     - The **Drift** (modification percentage).
     - The **Original text** that was pasted.

4. **Manual Tracking**
   - Users can manually highlight an existing block of code and run the command `Rewind: Mark Selection as Pasted` (`rewind.markAsPasted`).
   - This allows bringing existing code under genealogy tracking and manually assigning a source.

### Technical Implementation

**Enjoy!**
- **Activation**: Triggers eagerly `onStartupFinished` to ensure all changes are tracked.
- **Tracking Core**: Handled by `PasteManager`, which listens to `vscode.workspace.onDidChangeTextDocument` events, adjusting coordinates mathematically on content changes.
- **Drift Logic**: Powered by the `fast-levenshtein` library to calculate efficient string distances continuously.
- **UI Overlay**: Powered by the `decorations.ts` module which applies `vscode.TextEditorDecorationType` to the active editor dynamically.
