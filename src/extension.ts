import * as vscode from 'vscode';
import { 
    initImpactDecorations, 
    updateImpactDecorations, 
    initGhostDecorations, 
    updateGhostDecorations, 
    initHeatmapDecorations, 
    updateHeatmapDecorations, 
    updateDecorations as updateIntentDecorations, 
    reloadDecorationStyle, 
    initPasteDecorations, 
    updatePasteDecorations 
} from './decorations';

import { 
    analyzeImpact, 
    clearAllAlerts, 
    onAnalysisComplete, 
    AnalysisSummary 
} from './impactManager';

import { 
    showImpactResultsPanel, 
    refreshResultsPanel 
} from './resultsPanel';

import { 
    startGhostRewrite, 
    acceptGhostRewrite, 
    discardGhostRewrite, 
    guardGhostBranchEdits, 
    syncGhostBlocksCache 
} from './ghostBranchManager';

import { CognitiveLoadManager } from "./cognitiveLoadManager";
import { IntentManager } from './intentManager';
import { PasteManager } from './pasteManager';

// --- State Managers ---
let pasteManager: PasteManager;
let intentManager: IntentManager;
let cognitiveLoadManager: CognitiveLoadManager;
let isHeatmapActive = false;

/**
 * Extension entry point.
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Rewind: Activating all systems...');

    // 1. Shared Managers & Decorations
    pasteManager = new PasteManager();
    intentManager = new IntentManager();
    cognitiveLoadManager = new CognitiveLoadManager();

    initImpactDecorations();
    initGhostDecorations(context);
    initHeatmapDecorations();
    initPasteDecorations();
    reloadDecorationStyle();

    // 2. Feature Registration
    const statusBar = createImpactStatusBar(context);
    
    registerChangeImpact(context, statusBar);
    registerGhostRewrite(context);
    registerCognitiveLoad(context);
    registerIntentMarkers(context);
    registerPasteGenealogy(context);

    // 3. Global Event Handlers (Consolidated)
    registerGlobalListeners(context);

    // 4. Initial Trigger
    if (vscode.window.activeTextEditor) {
        const editor = vscode.window.activeTextEditor;
        updateImpactDecorations(editor);
        updateGhostDecorations(editor);
        syncGhostBlocksCache(editor.document);
        updatePasteDecorations(editor, pasteManager);
        updateIntentDecorations(editor, intentManager);
        if (isHeatmapActive) {
            updateHeatmapDecorations(editor, cognitiveLoadManager);
        }
    }

    console.log('Rewind: Extension fully activated.');
}

/**
 * Cleanup on deactivation.
 */
export function deactivate() {
    if (cognitiveLoadManager) {
        cognitiveLoadManager.dispose();
    }
}

// --- Feature Registration Functions ---

function createImpactStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.command = 'rewind.showImpactResults';
    statusBar.tooltip = 'Rewind: Open Impact Analysis Results';
    context.subscriptions.push(statusBar);
    return statusBar;
}

function updateStatusBar(statusBar: vscode.StatusBarItem, summary: AnalysisSummary | null) {
    if (summary && summary.affectedCount > 0) {
        const locWord = summary.affectedCount === 1 ? 'impact' : 'impacts';
        statusBar.text = `$(warning) Rewind: ${summary.affectedCount} ${locWord}`;
        statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBar.show();
    } else {
        statusBar.hide();
    }
}

function registerChangeImpact(context: vscode.ExtensionContext, statusBar: vscode.StatusBarItem) {
    context.subscriptions.push(
        vscode.commands.registerCommand('rewind.analyzeImpact', async () => {
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
        }),

        vscode.commands.registerCommand('rewind.showImpactResults', () => {
            showImpactResultsPanel(context);
        }),

        vscode.commands.registerCommand('rewind.clearImpactAlerts', () => {
            clearAllAlerts();
            vscode.window.showInformationMessage('Rewind: All impact alerts cleared.');
        }),

        onAnalysisComplete((summary) => {
            updateStatusBar(statusBar, summary);
            refreshResultsPanel();
        })
    );
}

function registerGhostRewrite(context: vscode.ExtensionContext) {
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
}

function registerCognitiveLoad(context: vscode.ExtensionContext) {
    cognitiveLoadManager.setRepaintCallback(() => {
        if (isHeatmapActive && vscode.window.activeTextEditor) {
            updateHeatmapDecorations(vscode.window.activeTextEditor, cognitiveLoadManager);
        }
    });

    context.subscriptions.push(
        vscode.commands.registerCommand("rewind.toggleHeatmap", async () => {
            isHeatmapActive = !isHeatmapActive;
            const editor = vscode.window.activeTextEditor;

            if (isHeatmapActive) {
                vscode.window.showInformationMessage("Cognitive Load Heatmap Enabled");
                if (editor) {updateHeatmapDecorations(editor, cognitiveLoadManager);}
            } else {
                if (editor) {updateHeatmapDecorations(editor, null);} // passing null clears decorations
            }
        })
    );
}

function registerIntentMarkers(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('rewind.addIntentMarker', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {return;}

            const config = vscode.workspace.getConfiguration('rewind');
            const customCategories = config.get<string[]>('customIntentCategories') || [];
            const baseCategories = ['Refactoring', 'Complex Logic', 'Needs Review', 'Hack', 'Bug Fix'];
            const allCategories = Array.from(new Set([...baseCategories, ...customCategories]));

            const quickPickItems: vscode.QuickPickItem[] = [
                ...allCategories.map(c => ({ label: c })),
                { label: '', kind: vscode.QuickPickItemKind.Separator },
                { label: '➕ Create Custom Intent...' }
            ];

            const selectedOption = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Select an intent category'
            });

            if (!selectedOption) {return;}

            let selectedIntent = selectedOption.label;
            if (selectedOption.label === '➕ Create Custom Intent...') {
                const newIntent = await vscode.window.showInputBox({
                    prompt: 'Enter your custom intent category (e.g., Performance Tuning)',
                    placeHolder: 'My Custom Intent...'
                });

                if (!newIntent || newIntent.trim() === '') {return;}
                selectedIntent = newIntent.trim();

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
            updateIntentDecorations(editor, intentManager);
            vscode.window.showInformationMessage(`Added Intent Marker: ${selectedIntent}`);
        }),

        vscode.commands.registerCommand('rewind.removeIntentMarker', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {return;}

            const line = editor.selection.active.line;
            const file = editor.document.fileName;
            const markersOnLine = intentManager.getMarkersForFile(file).filter(m => m.line === line);

            if (markersOnLine.length === 0) {
                vscode.window.showInformationMessage('No intent markers on this line.');
                return;
            }

            if (markersOnLine.length === 1) {
                intentManager.removeMarkersAtLine(file, line, markersOnLine[0].timestamp);
                updateIntentDecorations(editor, intentManager);
                vscode.window.showInformationMessage(`Removed Intent Marker: ${markersOnLine[0].intentLabel}`);
                return;
            }

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

            if (!selected) {return;}

            if (selected.marker === null) {
                intentManager.removeMarkersAtLine(file, line);
                updateIntentDecorations(editor, intentManager);
                vscode.window.showInformationMessage('Removed all Intent Markers on this line.');
            } else {
                intentManager.removeMarkersAtLine(file, line, selected.marker.timestamp);
                updateIntentDecorations(editor, intentManager);
                vscode.window.showInformationMessage(`Removed Intent Marker: ${selected.marker.intentLabel}`);
            }
        }),

        vscode.commands.registerCommand('rewind.removeCustomIntentCategory', async () => {
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

            if (!selectedCategories || selectedCategories.length === 0) {return;}

            const updatedCategories = customCategories.filter(c => !selectedCategories.includes(c));
            await config.update('customIntentCategories', updatedCategories, vscode.ConfigurationTarget.Global);

            intentManager.removeMarkersByCategory(selectedCategories);

            for (const editor of vscode.window.visibleTextEditors) {
                updateIntentDecorations(editor, intentManager);
            }

            vscode.window.showInformationMessage(`Deleted ${selectedCategories.length} custom categories and cleaned up existing markers.`);
        }),

        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('rewind.intentMarkerColor')) {
                reloadDecorationStyle();
                for (const editor of vscode.window.visibleTextEditors) {
                    updateIntentDecorations(editor, intentManager);
                }
            }
        })
    );
}

function registerPasteGenealogy(context: vscode.ExtensionContext) {
    const recentlyTracked = new Set<string>();
    const stripWS = (s: string) => s.replace(/\s+/g, '');

    context.subscriptions.push(
        vscode.commands.registerCommand('rewind.markAsPasted', async () => {
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
        }),

        vscode.workspace.onDidChangeTextDocument(async (e) => {
            for (const change of e.contentChanges) {
                if (change.text.length < 10) {continue;}

                const insertedText = change.text;
                const startLine = change.range.start.line;
                const endLine = startLine + (insertedText.split('\n').length - 1);
                const docRef = e.document;

                const trackKey = `${docRef.fileName}:${startLine}:${endLine}`;
                if (recentlyTracked.has(trackKey)) {continue;}

                try {
                    const cbText = await vscode.env.clipboard.readText();
                    if (!cbText || cbText.trim().length < 10) {continue;}
                    if (stripWS(insertedText) !== stripWS(cbText)) {continue;}

                    recentlyTracked.add(trackKey);
                    setTimeout(() => recentlyTracked.delete(trackKey), 2000);

                    // Wait for formatOnPaste to settle
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

                    if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document === docRef) {
                        updatePasteDecorations(vscode.window.activeTextEditor, pasteManager);
                    }
                    vscode.window.showInformationMessage(`Paste tracked from: ${source || 'External Clipboard'}`);
                } catch (err) {
                    console.error('Rewind: Error tracking paste:', err);
                }
            }
        })
    );
}

function registerGlobalListeners(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        // 1. Text Document Changes (Consolidated for non-paste features)
        vscode.workspace.onDidChangeTextDocument(e => {
            // Cognitive Load
            cognitiveLoadManager.onDocumentChange(e);
            if (isHeatmapActive && vscode.window.activeTextEditor && vscode.window.activeTextEditor.document === e.document) {
                updateHeatmapDecorations(vscode.window.activeTextEditor, cognitiveLoadManager);
            }

            // Ghost Rewrite
            if (!guardGhostBranchEdits(e)) {
                if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
                    updateGhostDecorations(vscode.window.activeTextEditor);
                    syncGhostBlocksCache(e.document);
                }
            }

            // Paste Genealogy (Position updates only)
            pasteManager.onDocumentChange(e);
            if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document === e.document) {
                updatePasteDecorations(vscode.window.activeTextEditor, pasteManager);
            }
        }),

        // 2. Selection Changes
        vscode.window.onDidChangeTextEditorSelection(e => {
            cognitiveLoadManager.onSelectionChange(e);
        }),

        // 3. Active Editor Changes
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                updateImpactDecorations(editor);
                updateGhostDecorations(editor);
                syncGhostBlocksCache(editor.document);
                updatePasteDecorations(editor, pasteManager);
                updateIntentDecorations(editor, intentManager);
                if (isHeatmapActive) {
                    updateHeatmapDecorations(editor, cognitiveLoadManager);
                }
            }
        }),

        // 4. Document Save
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            const supported = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];
            if (document.uri.scheme === 'file' && supported.includes(document.languageId)) {
                await analyzeImpact(document);
            }
        })
    );
}