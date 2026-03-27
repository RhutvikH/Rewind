import * as vscode from 'vscode';
import { activeAlerts } from './impactManager';

let impactDeco: vscode.TextEditorDecorationType | undefined;

export function initImpactDecorations(): vscode.TextEditorDecorationType {
    impactDeco = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 165, 0, 0.18)', // Soft orange warning glow
        borderWidth: '0 0 2px 0',
        borderColor: 'rgba(255, 140, 0, 0.85)',
        borderStyle: 'solid',
        overviewRulerColor: 'rgba(255, 140, 0, 0.8)',
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        isWholeLine: false
    });
    return impactDeco;
}

export function updateImpactDecorations(editor: vscode.TextEditor) {
    if (!editor || !impactDeco) { return; }

    const uriStr = editor.document.uri.toString();
    const alerts = activeAlerts.get(uriStr) || [];

    const options: vscode.DecorationOptions[] = alerts.map(alert => ({
        range: alert.range,
        hoverMessage: new vscode.MarkdownString(
            `**Change Impact Alert**\n\n` +
            `Symbol \`${alert.symbolName}\` was modified.\n\n` +
            `${alert.message}\n\n` +
            `*Run **Rewind: Show Impact Analysis Results** for details.*`
        )
    }));

    editor.setDecorations(impactDeco, options);
}

