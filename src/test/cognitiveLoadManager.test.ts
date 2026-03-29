import * as assert from 'assert';
import * as vscode from 'vscode';
import { CognitiveLoadManager } from '../cognitiveLoadManager';
import { CognitiveLoadStrategy } from '../strategies/CognitiveLoadStrategy';
import { LineMetrics } from '../types';

class MockStrategy implements CognitiveLoadStrategy {
    calculateScore(metrics: LineMetrics): number {
        return metrics.deletions * 10 + metrics.editCount;
    }
}

suite('CognitiveLoadManager Test Suite', () => {
    test('CognitiveLoadManager correctly tracks edits and deletions', async () => {
        const manager = new CognitiveLoadManager(new MockStrategy());
        const fileName = 'test.ts';
        
        // Mock a document change event
        const event: any = {
            document: {
                fileName: fileName,
                lineCount: 10
            },
            contentChanges: [
                {
                    range: new vscode.Range(0, 0, 0, 5),
                    rangeLength: 5,
                    text: 'hello'
                }
            ]
        };

        manager.onDocumentChange(event as vscode.TextDocumentChangeEvent);
        
        const metrics = manager.getMetrics(fileName);
        assert.strictEqual(metrics.length, 10);
        assert.strictEqual(metrics[0].deletions, 1);
        assert.strictEqual(metrics[0].editCount, 1);
        assert.strictEqual(metrics[0].totalScore, 11); // 1*10 + 1
    });

    test('CognitiveLoadManager handles line additions', async () => {
        const manager = new CognitiveLoadManager(new MockStrategy());
        const fileName = 'test.ts';
        
        const event1: any = {
            document: { fileName, lineCount: 1 },
            contentChanges: [{ range: new vscode.Range(0, 0, 0, 0), rangeLength: 0, text: 'line1' }]
        };
        manager.onDocumentChange(event1);

        const event2: any = {
            document: { fileName, lineCount: 2 },
            contentChanges: [{ range: new vscode.Range(0, 5, 0, 5), rangeLength: 0, text: '\nline2' }]
        };
        manager.onDocumentChange(event2);

        const metrics = manager.getMetrics(fileName);
        assert.strictEqual(metrics.length, 2);
    });
});
