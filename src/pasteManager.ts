import * as vscode from 'vscode';
import { PasteEvent } from './types';
import * as levenshtein from 'fast-levenshtein';

export class PasteManager {
    // Map of file paths to their tracked pasted blocks
    private pastedBlocks: Map<string, PasteEvent[]> = new Map();

    public addPasteEvent(file: string, startLine: number, endLine: number, originalText: string, currentText: string, source: string) {
        if (!this.pastedBlocks.has(file)) {
            this.pastedBlocks.set(file, []);
        }
        
        const pasteEvent: PasteEvent = {
            type: 'paste_event',
            timestamp: Date.now(),
            file,
            startLine,
            endLine,
            originalText,
            currentText,
            source,
            drift: 0 // initially 0
        };
        
        this.pastedBlocks.get(file)!.push(pasteEvent);
    }

    public getPasteEvents(file: string): PasteEvent[] {
        return this.pastedBlocks.get(file) || [];
    }

    // Called when the document changes to update coordinates and drift for pasted blocks
    public onDocumentChange(event: vscode.TextDocumentChangeEvent) {
        const file = event.document.fileName;
        const blocks = this.pastedBlocks.get(file);
        if (!blocks || blocks.length === 0) return;

        // Process changes uniformly for coordinates first
        for (const change of event.contentChanges) {
            const startLineChange = change.range.start.line;
            const endLineChange = change.range.end.line;
            const textLines = change.text.split('\n').length - 1;
            const lineDelta = textLines - (endLineChange - startLineChange);

            for (const block of blocks) {
                // If change happens entirely before the block, shift the block
                if (endLineChange < block.startLine) {
                    block.startLine += lineDelta;
                    block.endLine += lineDelta;
                }
                // If change happens within or overlaps the block
                else if (startLineChange <= block.endLine && endLineChange >= block.startLine) {
                    // Guard: if the change starts at the end of the block's last line and
                    // removes only the trailing newline (merging with the next line), don't touch
                    // endLine — the block's actual content hasn't changed.
                    const changeStartsAtEndOfBlock =
                        startLineChange === block.endLine &&
                        change.range.start.character > 0 &&
                        change.text === '' &&
                        lineDelta < 0;

                    // Also guard: Enter pressed at end of block should not expand (already handled)
                    const changeNewlineAtEndOfBlock =
                        startLineChange === block.endLine &&
                        change.text.startsWith('\n');

                    if (!changeStartsAtEndOfBlock && !changeNewlineAtEndOfBlock) {
                        block.endLine += lineDelta;
                    }

                    if (startLineChange < block.startLine) {
                        block.startLine = startLineChange + textLines;
                    }
                }
            }
        }
        
        // Now calculate drift for all updated coordinates based on final document state
        for (const block of blocks) {
            block.startLine = Math.max(0, block.startLine);
            block.endLine = Math.max(0, block.endLine);

            if (block.endLine >= block.startLine) {
                try {
                    const range = new vscode.Range(
                        new vscode.Position(block.startLine, 0),
                        new vscode.Position(block.endLine + 1, 0)
                    );
                    
                    const currentText = event.document.getText(range);
                    block.currentText = currentText;
                    
                    const distance = levenshtein.get(block.originalText, block.currentText);
                    const maxLen = Math.max(block.originalText.length, block.currentText.length);
                    block.drift = maxLen === 0 ? 0 : distance / maxLen;
                } catch (err) {
                    console.error("PasteManager error getting text range:", err);
                    block.currentText = "";
                    block.drift = 1.0;
                }
            } else {
                // Block completely deleted
                block.currentText = "";
                block.drift = 1.0;
            }
        }

        // Remove blocks that are fully deleted
        this.pastedBlocks.set(file, blocks.filter(b => b.startLine <= b.endLine && b.currentText.trim() !== ''));
    }
}
