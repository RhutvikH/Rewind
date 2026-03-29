import * as assert from 'assert';
import * as vscode from 'vscode';
import { getGhostBlocks } from '../ghostBranchManager';
import { MARKER_ORIG_START, MARKER_GHOST_START, MARKER_GHOST_END } from '../types';

suite('GhostBranchManager Test Suite', () => {
    test('GhostBranchManager identifies ghost blocks by markers', async () => {
        const docText = [
            'some code',
            MARKER_ORIG_START,
            'original code',
            MARKER_GHOST_START,
            'ghost rewrite',
            MARKER_GHOST_END,
            'more code'
        ].join('\n');

        const doc: any = {
            lineCount: 7,
            lineAt: (i: number) => ({ text: docText.split('\n')[i] }),
            uri: vscode.Uri.file('/fake/file.ts')
        };

        const blocks = getGhostBlocks(doc as vscode.TextDocument);
        assert.strictEqual(blocks.length, 1);
        assert.strictEqual(blocks[0].origStartLine, 1);
        assert.strictEqual(blocks[0].ghostStartLine, 3);
        assert.strictEqual(blocks[0].ghostEndLine, 5);
    });
});
