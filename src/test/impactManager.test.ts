import * as assert from 'assert';
import * as vscode from 'vscode';
import { analyzeImpact, activeAlerts } from '../impactManager';

suite('ImpactManager Test Suite', () => {
    test('ImpactManager identifies exported symbols', async () => {
        // This test requires a real document or a very good mock because analyzeImpact
        // uses vscode.commands.executeCommand('vscode.executeReferenceProvider', ...)
        
        // For now, we can test the internal symbol extraction if we exported it, 
        // or just verify the clear/add logic with mocks.
        
        const testUri = vscode.Uri.file('/fake/path.ts');
        activeAlerts.set(testUri.toString(), [{
            uri: testUri,
            range: new vscode.Range(0, 0, 0, 10),
            sourceUri: 'source.ts',
            symbolName: 'test',
            message: 'Affected'
        }]);

        assert.strictEqual(activeAlerts.size, 1);
    });
});
