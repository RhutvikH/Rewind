import * as vscode from "vscode";
import { CognitiveLoadManager } from "./cognitiveLoadManager";
import {
  initHeatmapDecorations,
  updateHeatmapDecorations,
} from "./decorations";

let cognitiveLoadManager: CognitiveLoadManager;
let isHeatmapActive = false;

export function activate(context: vscode.ExtensionContext) {
  console.log("Rewind: Cognitive Load Tracker activated.");

  initHeatmapDecorations();
  cognitiveLoadManager = new CognitiveLoadManager();

  const docChangeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
    cognitiveLoadManager.onDocumentChange(e);
    if (isHeatmapActive) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === e.document) {
        updateHeatmapDecorations(editor, cognitiveLoadManager);
      }
    }
  });

  const selectionChangeDisposable =
    vscode.window.onDidChangeTextEditorSelection((e) => {
      cognitiveLoadManager.onSelectionChange(e);
    });

  // Manager will call this whenever dwell time updates significantly
  cognitiveLoadManager.setRepaintCallback(() => {
    if (isHeatmapActive) {
      const editor = vscode.window.activeTextEditor;
      if (editor) updateHeatmapDecorations(editor, cognitiveLoadManager);
    }
  });

  const toggleDisposable = vscode.commands.registerCommand(
    "rewind.toggleHeatmap",
    () => {
      isHeatmapActive = !isHeatmapActive;
      const editor = vscode.window.activeTextEditor;

      if (isHeatmapActive) {
        vscode.window.showInformationMessage("Cognitive Load Heatmap Enabled");
        if (editor) updateHeatmapDecorations(editor, cognitiveLoadManager);
      } else {
        vscode.window.showInformationMessage("Cognitive Load Heatmap Disabled");
        if (editor) updateHeatmapDecorations(editor, null); // passing null clears decorations
      }
    },
  );

  const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor && isHeatmapActive) {
        updateHeatmapDecorations(editor, cognitiveLoadManager);
      }
    },
  );

  context.subscriptions.push(
    docChangeDisposable,
    selectionChangeDisposable,
    toggleDisposable,
    editorChangeDisposable,
  );
}

// This method is called when your extension is deactivated
export function deactivate() {
  if (cognitiveLoadManager) {
    cognitiveLoadManager.dispose();
  }
}
