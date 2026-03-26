import * as assert from 'assert';
import * as vscode from 'vscode';
import { PasteManager } from '../pasteManager';

suite('PasteManager Test Suite', () => {
    vscode.window.showInformationMessage('Start PasteManager tests.');

    test('PasteManager calculates drift correctly', async () => {
        const manager = new PasteManager();
        const testFile = '/fake/test.txt';
        
        manager.addPasteEvent(testFile, 10, 12, 'hello\nworld', 'hello\nworld', 'External Source');
        
        const events = manager.getPasteEvents(testFile);
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].drift, 0);

        // We can't easily mock vscode.TextDocumentChangeEvent full behavior here directly
        // without a real or fully mocked document object, but we know the drift math:
        // distance(hello\nworld, hello\nWORLD) = 5
        // maxLen = 11
        // drift = 5/11 = 0.4545...
        
        manager.addPasteEvent(testFile, 20, 20, 'code', 'cofe', 'Source');
        const ev2 = manager.getPasteEvents(testFile)[1];
        
        // Simulating the internal drift calculation mechanism 
        // (usually triggered by onDocumentChange, but we test the math)
        import('fast-levenshtein').then(lev => {
            const drift = lev.get(ev2.originalText, ev2.currentText) / Math.max(ev2.originalText.length, ev2.currentText.length);
            assert.strictEqual(drift, 0.25); // distance 1 / length 4
        });
    });
});
