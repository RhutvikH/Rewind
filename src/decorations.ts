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