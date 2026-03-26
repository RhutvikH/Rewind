import * as vscode from 'vscode';
import { activeAlerts } from './impactManager';

let impactDeco: vscode.TextEditorDecorationType;

export function initImpactDecorations(context: vscode.ExtensionContext) {
    impactDeco = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 165, 0, 0.2)', // Soft orange warning glow
        borderWidth: '0 0 2px 0',
        borderColor: 'rgba(255, 140, 0, 0.8)',
        borderStyle: 'solid',
        isWholeLine: false
    });
}

export function updateImpactDecorations(editor: vscode.TextEditor) {
    if (!editor) return;

    const uriStr = editor.document.uri.toString();
    const alerts = activeAlerts.get(uriStr) || [];

    const options: vscode.DecorationOptions[] = alerts.map(alert => ({
        range: alert.range,
        hoverMessage: new vscode.MarkdownString(`**⚠️ Change Impact Alert**\n\n${alert.message}`)
    }));

    editor.setDecorations(impactDeco, options);
}
