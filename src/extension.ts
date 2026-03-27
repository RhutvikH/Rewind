import * as vscode from 'vscode';
import { initImpactDecorations, updateImpactDecorations } from './decorations';
import { analyzeImpact, clearAllAlerts, onAnalysisComplete, AnalysisSummary } from './impactManager';
import { showImpactResultsPanel, refreshResultsPanel } from './resultsPanel';

export function activate(context: vscode.ExtensionContext) {
    console.log('Rewind: Change Impact Alert System active!');

    // Initialise decorations — add to subscriptions for proper disposal
    const decoType = initImpactDecorations();
    context.subscriptions.push(decoType);

    // ── Status bar item ──────────────────────────────────────────────────────
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.command = 'rewind.showImpactResults';
    statusBar.tooltip = 'Rewind: Open Impact Analysis Results';
    context.subscriptions.push(statusBar);

    function updateStatusBar(summary: AnalysisSummary | null) {
        if (summary && summary.affectedCount > 0) {
            const locWord = summary.affectedCount === 1 ? 'impact' : 'impacts';
            statusBar.text = `$(warning) Rewind: ${summary.affectedCount} ${locWord}`;
            statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            statusBar.show();
        } else {
            statusBar.hide();
        }
    }

    // React to every completed analysis (success or clear)
    context.subscriptions.push(
        onAnalysisComplete((summary) => {
            updateStatusBar(summary);
            refreshResultsPanel();
        })
    );

    // ── Commands ─────────────────────────────────────────────────────────────

    const analyzeCmd = vscode.commands.registerCommand('rewind.analyzeImpact', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Rewind: Open a TypeScript/JavaScript file first.');
            return;
        }
        const supported = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];
        if (!supported.includes(editor.document.languageId)) {
            vscode.window.showWarningMessage('Rewind: Change Impact only works on TypeScript/JavaScript files.');
            return;
        }
        await analyzeImpact(editor.document);
    });
    context.subscriptions.push(analyzeCmd);

    const showResultsCmd = vscode.commands.registerCommand('rewind.showImpactResults', () => {
        showImpactResultsPanel(context);
    });
    context.subscriptions.push(showResultsCmd);

    const clearCmd = vscode.commands.registerCommand('rewind.clearImpactAlerts', () => {
        clearAllAlerts();
        vscode.window.showInformationMessage('Rewind: All impact alerts cleared.');
    });
    context.subscriptions.push(clearCmd);

    // ── Auto-run on every TS/JS file save ────────────────────────────────────
    const saveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
        const supported = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];
        if (document.uri.scheme === 'file' && supported.includes(document.languageId)) {
            await analyzeImpact(document);
        }
    });
    context.subscriptions.push(saveListener);

    // ── Repaint decorations when switching editors ───────────────────────────
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) { updateImpactDecorations(editor); }
    });
    context.subscriptions.push(editorChangeListener);

    if (vscode.window.activeTextEditor) {
        updateImpactDecorations(vscode.window.activeTextEditor);
    }
}

import { startGhostRewrite, acceptGhostRewrite, discardGhostRewrite, guardGhostBranchEdits, syncGhostBlocksCache } from './ghostBranchManager';
import { initGhostDecorations, updateGhostDecorations } from './decorations';

export function activate(context: vscode.ExtensionContext) {
    console.log('Rewind: Timeline Forking active!');

    initGhostDecorations(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('rewind.startGhostRewrite', () => {
            if (vscode.window.activeTextEditor) {
                startGhostRewrite(vscode.window.activeTextEditor);
            }
        }),
        vscode.commands.registerCommand('rewind.acceptGhostRewrite', () => {
            if (vscode.window.activeTextEditor) {
                acceptGhostRewrite(vscode.window.activeTextEditor);
            }
        }),
        vscode.commands.registerCommand('rewind.discardGhostRewrite', () => {
            if (vscode.window.activeTextEditor) {
                discardGhostRewrite(vscode.window.activeTextEditor);
            }
        })
    );

    vscode.workspace.onDidChangeTextDocument(e => {
        if (guardGhostBranchEdits(e)) {
            return;
        }

        if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
            updateGhostDecorations(vscode.window.activeTextEditor);
            syncGhostBlocksCache(e.document);
        }
    });

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            updateGhostDecorations(editor);
            syncGhostBlocksCache(editor.document);
        }
    });

    if (vscode.window.activeTextEditor) {
        updateGhostDecorations(vscode.window.activeTextEditor);
        syncGhostBlocksCache(vscode.window.activeTextEditor.document);
    }
}

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
import * as vscode from 'vscode';
import { updateDecorations, reloadDecorationStyle } from './decorations';
import { IntentManager } from './intentManager';

let intentManager: IntentManager;

export function activate(context: vscode.ExtensionContext) {
  console.log('Rewind: Activating Intent Markers extension...');
  
      // 1. Initialize Modules
      intentManager = new IntentManager();
  
      // 2. Command: Add Intent Marker
      let intentMarkerDisposable = vscode.commands.registerCommand('rewind.addIntentMarker', async () => {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
              return;
          }
  
          const config = vscode.workspace.getConfiguration('rewind');
          const customCategories = config.get<string[]>('customIntentCategories') || [];
          const baseCategories = ['Refactoring', 'Complex Logic', 'Needs Review', 'Hack', 'Bug Fix'];
  
          // Remove duplicates just in case
          const allCategories = Array.from(new Set([...baseCategories, ...customCategories]));
  
          const quickPickItems: vscode.QuickPickItem[] = [
              ...allCategories.map(c => ({ label: c })),
              { label: '', kind: vscode.QuickPickItemKind.Separator },
              { label: '➕ Create Custom Intent...' }
          ];
  
          const selectedOption = await vscode.window.showQuickPick(quickPickItems, {
              placeHolder: 'Select an intent category'
          });
  
          if (!selectedOption) {
              return; // User canceled
          }
  
          let selectedIntent = selectedOption.label;
  
          if (selectedOption.label === '➕ Create Custom Intent...') {
              const newIntent = await vscode.window.showInputBox({
                  prompt: 'Enter your custom intent category (e.g., Performance Tuning)',
                  placeHolder: 'My Custom Intent...'
              });
  
              if (!newIntent || newIntent.trim() === '') return;
              selectedIntent = newIntent.trim();
  
              // Save to settings globally
              await config.update('customIntentCategories', [...customCategories, selectedIntent], vscode.ConfigurationTarget.Global);
              vscode.window.showInformationMessage(`Added Custom Intent: ${selectedIntent}`);
          }
  
          const description = await vscode.window.showInputBox({
              prompt: 'Optional description for this marker (e.g., Try a new approach here...)',
              placeHolder: 'Description...'
          });
  
          const line = editor.selection.active.line;
          const file = editor.document.fileName;
  
          intentManager.addMarker(file, line, selectedIntent, description);
          updateDecorations(editor, intentManager);
          vscode.window.showInformationMessage(`Added Intent Marker: ${selectedIntent}`);
      });
  
      // 3. Command: Remove Intent Marker
      let removeMarkerDisposable = vscode.commands.registerCommand('rewind.removeIntentMarker', async () => {
          const editor = vscode.window.activeTextEditor;
          if (!editor) return;
  
          const line = editor.selection.active.line;
          const file = editor.document.fileName;
  
          const markersOnLine = intentManager.getMarkersForFile(file).filter(m => m.line === line);
  
          if (markersOnLine.length === 0) {
              vscode.window.showInformationMessage('No intent markers on this line.');
              return;
          }
  
          if (markersOnLine.length === 1) {
              intentManager.removeMarkersAtLine(file, line, markersOnLine[0].timestamp);
              updateDecorations(editor, intentManager);
              vscode.window.showInformationMessage(`Removed Intent Marker: ${markersOnLine[0].intentLabel}`);
              return;
          }
  
          // Multiple markers on this line, let user choose
          const quickPickItems = markersOnLine.map(m => ({
              label: m.intentLabel,
              description: m.description,
              marker: m
          }));
  
          quickPickItems.push({
              label: 'Remove All Markers on this Line',
              description: '',
              marker: null as any
          });
  
          const selected = await vscode.window.showQuickPick(quickPickItems, {
              placeHolder: 'Select which marker to remove'
          });
  
          if (!selected) return;
  
          if (selected.marker === null) {
              // Remove all
              intentManager.removeMarkersAtLine(file, line);
              updateDecorations(editor, intentManager);
              vscode.window.showInformationMessage('Removed all Intent Markers on this line.');
          } else {
              // Remove specific
              intentManager.removeMarkersAtLine(file, line, selected.marker.timestamp);
              updateDecorations(editor, intentManager);
              vscode.window.showInformationMessage(`Removed Intent Marker: ${selected.marker.intentLabel}`);
          }
      });
  
      // 4. Command: Delete Custom Intent Category
      let deleteCustomCategoryDisposable = vscode.commands.registerCommand('rewind.removeCustomIntentCategory', async () => {
          const config = vscode.workspace.getConfiguration('rewind');
          const customCategories = config.get<string[]>('customIntentCategories') || [];
  
          if (customCategories.length === 0) {
              vscode.window.showInformationMessage('You have no custom intent categories to delete.');
              return;
          }
  
          const selectedCategories = await vscode.window.showQuickPick(customCategories, {
              placeHolder: 'Select custom categories to delete',
              canPickMany: true
          });
  
          if (!selectedCategories || selectedCategories.length === 0) {
              return;
          }
  
          const updatedCategories = customCategories.filter(c => !selectedCategories.includes(c));
          await config.update('customIntentCategories', updatedCategories, vscode.ConfigurationTarget.Global);
  
          // Remove existing intent markers across files corresponding to the deleted categories
          intentManager.removeMarkersByCategory(selectedCategories);
  
          // Update decorations in all visible editors
          for (const editor of vscode.window.visibleTextEditors) {
              updateDecorations(editor, intentManager);
          }
  
          vscode.window.showInformationMessage(`Deleted ${selectedCategories.length} custom categories and cleaned up existing markers.`);
      });
  
      // 5. Event Listener: Active Editor Changed
      let activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
          if (editor) {
              updateDecorations(editor, intentManager);
          }
      });
  
      // 6. Event Listener: Configuration Changed
      let configDisposable = vscode.workspace.onDidChangeConfiguration(e => {
          if (e.affectsConfiguration('rewind.intentMarkerColor')) {
              reloadDecorationStyle();
  
              // Reapply style in all visible editors
              for (const editor of vscode.window.visibleTextEditors) {
                  updateDecorations(editor, intentManager);
              }
          }
      });
  
  
  
      // Register everything
      context.subscriptions.push(
          intentMarkerDisposable,
          removeMarkerDisposable,
          deleteCustomCategoryDisposable,
          activeEditorDisposable,
          configDisposable
      );
}

export function deactivate() {}
import { initPasteDecorations, updatePasteDecorations } from './decorations';
import { PasteManager } from './pasteManager';

let pasteManager: PasteManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('Rewind: Activating Paste Genealogy extension...');

    // Must be called first while extension host is ready
    initPasteDecorations();
    pasteManager = new PasteManager();

    const stripWS = (s: string) => s.replace(/\s+/g, '');

    // Guard against duplicate detection prompts (e.g. formatOnPaste fires a 2nd event)
    const recentlyTracked = new Set<string>();

    const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
        // Step 1: always update coordinates + repaint existing tracked blocks
        pasteManager.onDocumentChange(e);
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document === e.document) {
            updatePasteDecorations(activeEditor, pasteManager);
        }

        // Step 2: check each content change for a clipboard match
        for (const change of e.contentChanges) {
            // Skip small changes (single keystrokes, spaces, etc.)
            if (change.text.length < 10) continue;

            // Capture everything we need from the synchronous event before going async
            const insertedText = change.text;
            const startLine = change.range.start.line;
            const endLine = startLine + (insertedText.split('\n').length - 1);
            const docRef = e.document;

            // De-duplicate: key = file + startLine + endLine
            const trackKey = `${docRef.fileName}:${startLine}:${endLine}`;
            if (recentlyTracked.has(trackKey)) continue;

            // Read clipboard immediately — async IIFE so we don't block the event
            (async () => {
                try {
                    const cbText = await vscode.env.clipboard.readText();
                    if (!cbText || cbText.trim().length < 10) return;
                    if (stripWS(insertedText) !== stripWS(cbText)) return;

                    // It's a paste — prevent duplicates for 2 seconds
                    recentlyTracked.add(trackKey);
                    setTimeout(() => recentlyTracked.delete(trackKey), 2000);

                    // Wait a tick for formatOnPaste to settle before reading final text
                    await new Promise(resolve => setTimeout(resolve, 400));

                    const range = new vscode.Range(
                        new vscode.Position(startLine, 0),
                        new vscode.Position(Math.min(endLine + 1, docRef.lineCount), 0)
                    );
                    const rawBlock = docRef.getText(range);

                    const source = await vscode.window.showInputBox({
                        prompt: 'Where did you paste this from? (Optional)',
                        placeHolder: 'e.g., StackOverflow, GitHub, External Repo'
                    });

                    if (source === undefined) {
                        // User cancelled — remove the de-dup guard so they can re-track
                        recentlyTracked.delete(trackKey);
                        return;
                    }

                    pasteManager.addPasteEvent(
                        docRef.fileName,
                        startLine,
                        endLine,
                        rawBlock,
                        rawBlock,
                        source || 'External Clipboard'
                    );

                    const editor = vscode.window.activeTextEditor;
                    if (editor && editor.document.fileName === docRef.fileName) {
                        updatePasteDecorations(editor, pasteManager);
                    }
                    vscode.window.showInformationMessage(
                        `Paste tracked from: ${source || 'External Clipboard'}`
                    );
                } catch { /* ignore clipboard/document errors */ }
            })();
        }
    });

    // Manual command: select any code → mark it as pasted
    const markPastedDisposable = vscode.commands.registerCommand('rewind.markAsPasted', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select the text to mark as pasted.');
            return;
        }

        const selection = editor.selection;
        const range = new vscode.Range(
            new vscode.Position(selection.start.line, 0),
            new vscode.Position(selection.end.line + 1, 0)
        );
        const text = editor.document.getText(range);

        const source = await vscode.window.showInputBox({
            prompt: 'Where did you paste this from? (Optional)',
            placeHolder: 'e.g., StackOverflow, External Repo'
        });

        pasteManager.addPasteEvent(
            editor.document.fileName,
            selection.start.line,
            selection.end.line,
            text,
            text,
            source || 'Manual Assignment'
        );

        updatePasteDecorations(editor, pasteManager);
        vscode.window.showInformationMessage('Selection marked as pasted.');
    });

    // Repaint highlights when switching files
    const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) updatePasteDecorations(editor, pasteManager);
    });

    context.subscriptions.push(
        documentChangeDisposable,
        markPastedDisposable,
        activeEditorDisposable
    );
}

export function deactivate() { }
