import * as vscode from 'vscode';
import { getGhostBlocks } from './ghostBranchManager';

let originalDeco: vscode.TextEditorDecorationType;
let ghostDeco: vscode.TextEditorDecorationType;
let markerDeco: vscode.TextEditorDecorationType;

export function initGhostDecorations(context: vscode.ExtensionContext) {
    originalDeco = vscode.window.createTextEditorDecorationType({
        opacity: '0.4',
        isWholeLine: true,
        textDecoration: 'line-through'
    });
    
    ghostDeco = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(0, 255, 128, 0.08)',
        isWholeLine: true
    });

    markerDeco = vscode.window.createTextEditorDecorationType({
        color: '#888888',
        fontStyle: 'italic',
        fontWeight: 'bold',
        isWholeLine: true,
        backgroundColor: 'rgba(0,0,0,0.1)'
    });
}

export function updateGhostDecorations(editor: vscode.TextEditor) {
    if (!editor) return;

    const blocks = getGhostBlocks(editor.document);
    
    const origOptions: vscode.DecorationOptions[] = [];
    const ghostOptions: vscode.DecorationOptions[] = [];
    const markerOptions: vscode.DecorationOptions[] = [];

    for (const block of blocks) {
        // Markers
        markerOptions.push({ range: editor.document.lineAt(block.origStartLine).range });
        markerOptions.push({ range: editor.document.lineAt(block.ghostStartLine).range });
        markerOptions.push({ range: editor.document.lineAt(block.ghostEndLine).range });

        // Original body
        if (block.ghostStartLine - block.origStartLine > 1) {
            const startPos = editor.document.lineAt(block.origStartLine + 1).range.start;
            const endPos = editor.document.lineAt(block.ghostStartLine - 1).range.end;
            origOptions.push({ range: new vscode.Range(startPos, endPos) });
        }

        // Ghost body
        if (block.ghostEndLine - block.ghostStartLine > 1) {
            const startPos = editor.document.lineAt(block.ghostStartLine + 1).range.start;
            const endPos = editor.document.lineAt(block.ghostEndLine - 1).range.end;
            ghostOptions.push({ range: new vscode.Range(startPos, endPos) });
        }
    }

    editor.setDecorations(originalDeco, origOptions);
    editor.setDecorations(ghostDeco, ghostOptions);
    editor.setDecorations(markerDeco, markerOptions);
}
