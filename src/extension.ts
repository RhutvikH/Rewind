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

export function deactivate() {}
