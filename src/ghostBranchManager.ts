import * as vscode from 'vscode';
import { MARKER_ORIG_START, MARKER_GHOST_START, MARKER_GHOST_END } from './types';
import { updateGhostDecorations } from './decorations';

export interface GhostBlock {
    origStartLine: number;
    ghostStartLine: number;
    ghostEndLine: number;
}

let isExtensionAction = false;
const blockCache = new Map<string, GhostBlock[]>();

export function syncGhostBlocksCache(document: vscode.TextDocument) {
    blockCache.set(document.uri.toString(), getGhostBlocks(document));
}

export function getGhostBlocks(document: vscode.TextDocument): GhostBlock[] {
    const blocks: GhostBlock[] = [];
    let origStartLine = -1;
    let ghostStartLine = -1;

    for (let i = 0; i < document.lineCount; i++) {
        const text = document.lineAt(i).text.trim();
        if (text === MARKER_ORIG_START) {
            origStartLine = i;
        } else if (text === MARKER_GHOST_START && origStartLine !== -1) {
            ghostStartLine = i;
        } else if (text === MARKER_GHOST_END && ghostStartLine !== -1) {
            blocks.push({
                origStartLine,
                ghostStartLine,
                ghostEndLine: i
            });
            origStartLine = -1;
            ghostStartLine = -1;
        }
    }
    return blocks;
}

export function startGhostRewrite(editor: vscode.TextEditor) {
    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showWarningMessage('Rewind: Please select a block of code to fork into a Ghost Branch.');
        return;
    }

    const startLine = selection.start.line;
    const endLine = selection.end.line;
    
    // Expand selection to entire lines for clean marker placement
    const startPos = new vscode.Position(startLine, 0);
    const endPos = editor.document.lineAt(endLine).rangeIncludingLineBreak.end;
    const fullSelection = new vscode.Range(startPos, endPos);
    
    const originalText = editor.document.getText(fullSelection);
    // Ensure terminal newline
    const textToInsert = originalText.endsWith('\n') ? originalText : originalText + '\n';

    const payload = `${MARKER_ORIG_START}\n${textToInsert}${MARKER_GHOST_START}\n${textToInsert}${MARKER_GHOST_END}\n`;
    
    isExtensionAction = true;
    editor.edit(editBuilder => {
        editBuilder.replace(fullSelection, payload);
    }).then(success => {
        isExtensionAction = false;
        if (success) {
            syncGhostBlocksCache(editor.document);
            updateGhostDecorations(editor);
        }
    });
}

function getActiveBlock(editor: vscode.TextEditor): GhostBlock | null {
    const blocks = getGhostBlocks(editor.document);
    const activeLine = editor.selection.active.line;
    return blocks.find(b => activeLine >= b.origStartLine && activeLine <= b.ghostEndLine) || null;
}

export function acceptGhostRewrite(editor: vscode.TextEditor) {
    const block = getActiveBlock(editor);
    if (!block) {
        vscode.window.showWarningMessage('Rewind: Your cursor must be inside an active Ghost Branch to accept it.');
        return;
    }

    isExtensionAction = true;
    editor.edit(editBuilder => {
        // Delete original block and central marker
        const startPos = editor.document.lineAt(block.origStartLine).range.start;
        const endPos = editor.document.lineAt(block.ghostStartLine).rangeIncludingLineBreak.end;
        editBuilder.delete(new vscode.Range(startPos, endPos));

        // Delete trailing marker
        const endLineRange = editor.document.lineAt(block.ghostEndLine).rangeIncludingLineBreak;
        editBuilder.delete(endLineRange);
    }).then(() => {
        isExtensionAction = false;
        syncGhostBlocksCache(editor.document);
        updateGhostDecorations(editor);
    });
}

export function discardGhostRewrite(editor: vscode.TextEditor) {
    const block = getActiveBlock(editor);
    if (!block) {
        vscode.window.showWarningMessage('Rewind: Your cursor must be inside an active Ghost Branch to discard it.');
        return;
    }

    isExtensionAction = true;
    editor.edit(editBuilder => {
        // Delete top marker
        const origLineRange = editor.document.lineAt(block.origStartLine).rangeIncludingLineBreak;
        editBuilder.delete(origLineRange);

        // Delete ghost block and trailing marker
        const startPos = editor.document.lineAt(block.ghostStartLine).range.start;
        const endPos = editor.document.lineAt(block.ghostEndLine).rangeIncludingLineBreak.end;
        editBuilder.delete(new vscode.Range(startPos, endPos));
    }).then(() => {
        isExtensionAction = false;
        syncGhostBlocksCache(editor.document);
        updateGhostDecorations(editor);
    });
}

export function guardGhostBranchEdits(e: vscode.TextDocumentChangeEvent): boolean {
    if (isExtensionAction) return false;

    const oldBlocks = blockCache.get(e.document.uri.toString()) || [];
    if (oldBlocks.length === 0) return false;

    let shouldUndo = false;
    for (const change of e.contentChanges) {
        for (const block of oldBlocks) {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;

            // They touched top zone? (Original code or top markers)
            if (endLine >= block.origStartLine && startLine <= block.ghostStartLine) {
                shouldUndo = true; break;
            }
            // They touched bottom zone? (Trailing marker)
            if (endLine >= block.ghostEndLine && startLine <= block.ghostEndLine) {
                shouldUndo = true; break;
            }
        }
        if (shouldUndo) break;
    }

    if (shouldUndo) {
        isExtensionAction = true;
        vscode.commands.executeCommand('undo').then(() => {
            isExtensionAction = false;
            vscode.window.showWarningMessage('Rewind Ghost Rewrite: The original code and markers are read-only! Please only edit the Ghost body.');
            syncGhostBlocksCache(e.document);
        });
        return true;
    }
    return false;
}
