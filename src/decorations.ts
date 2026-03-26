import * as vscode from 'vscode';
import { PasteManager } from './pasteManager';

let pasteDecorationType: vscode.TextEditorDecorationType | undefined;

// Must be called from activate() after VS Code extension host is ready
export function initPasteDecorations() {
    if (pasteDecorationType) pasteDecorationType.dispose();
    pasteDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(0, 255, 0, 0.1)',
        isWholeLine: false,
        border: '1px dashed rgba(0, 255, 0, 0.3)'
    });
}

export function updatePasteDecorations(editor: vscode.TextEditor, pasteManager: PasteManager) {
    if (!editor || !pasteDecorationType) return;

    const file = editor.document.fileName;
    const pastedEvents = pasteManager.getPasteEvents(file);
    const decorations: vscode.DecorationOptions[] = [];

    for (const paste of pastedEvents) {
        const startLine = Math.max(0, paste.startLine);
        const maxEndLine = Math.min(Math.max(0, paste.endLine), editor.document.lineCount - 1);
        if (maxEndLine < startLine) continue;

        const range = new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(maxEndLine, editor.document.lineAt(maxEndLine).text.length)
        );

        const driftPercent = (paste.drift * 100).toFixed(1);
        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.appendMarkdown(`**Source**: ${paste.source}\n\n`);
        hoverMessage.appendMarkdown(`**Drift**: ${driftPercent}%\n\n`);
        if (paste.originalText.trim().length > 0) {
            hoverMessage.appendMarkdown(`**Original text:**\n\n`);
            hoverMessage.appendCodeblock(paste.originalText, editor.document.languageId);
        }

        decorations.push({ range, hoverMessage });
    }

    editor.setDecorations(pasteDecorationType, decorations);
}
