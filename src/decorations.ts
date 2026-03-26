import * as vscode from 'vscode';
import { IntentManager } from './intentManager';

let intentDecorationType: vscode.TextEditorDecorationType;

export function reloadDecorationStyle() {
    if (intentDecorationType) {
        intentDecorationType.dispose();
    }
    const color = vscode.workspace.getConfiguration('rewind').get<string>('intentMarkerColor') || 'rgba(255, 255, 0, 0.2)';
    intentDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: color,
        isWholeLine: true,
        after: {
            margin: '0 0 0 3em',
            color: '#888',
            fontStyle: 'italic'
        }
    });
}

// Initial load
reloadDecorationStyle();

export function updateDecorations(editor: vscode.TextEditor, intentManager: IntentManager) {
    if (!editor || !intentDecorationType) {
        return;
    }

    const file = editor.document.fileName;
    const markers = intentManager.getMarkersForFile(file);

    // Group markers by line to prevent stacking overlapping decorations
    const markersByLine = new Map<number, typeof markers>();
    for (const marker of markers) {
        if (!markersByLine.has(marker.line)) markersByLine.set(marker.line, []);
        markersByLine.get(marker.line)!.push(marker);
    }

    const decorations: vscode.DecorationOptions[] = [];

    for (const [line, lineMarkers] of markersByLine.entries()) {
        const range = new vscode.Range(line, 0, line, 0);
        
        let hoverText = '';
        const labels = lineMarkers.map(m => m.intentLabel).join(', ');

        for (const marker of lineMarkers) {
            hoverText += `**Intent**: ${marker.intentLabel}\n\n`;
            if (marker.description) {
                hoverText += `*${marker.description}*\n\n`;
            }
            hoverText += `---\n\n`;
        }

        decorations.push({
            range,
            hoverMessage: new vscode.MarkdownString(hoverText),
            renderOptions: {
                after: {
                    contentText: `# ${labels}`
                }
            }
        });
    }

    editor.setDecorations(intentDecorationType, decorations);
}

export function clearDecorations(editor: vscode.TextEditor) {
    if (!editor || !intentDecorationType) return;
    editor.setDecorations(intentDecorationType, []);
}
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
