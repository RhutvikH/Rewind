import * as assert from 'assert';
import * as vscode from 'vscode';
import { Recorder } from '../recorder';

suite('Recorder Test Suite', () => {
    test('Recorder tracks events during recording', () => {
        const context: any = { asAbsolutePath: (p: string) => p };
        const recorder = new Recorder(context as vscode.ExtensionContext);
        
        // Manually trigger some internal state for testing
        // Note: startRecording() spawns a process, so we might want to mock spawn
        // or just test the event accumulation logic.
        
        (recorder as any).isRecording = true;
        (recorder as any).recordingStartTime = Date.now();
        
        const event: any = {
            document: { uri: vscode.Uri.file('test.ts') },
            contentChanges: [{ range: new vscode.Range(0, 0, 0, 0), text: 'a' }]
        };
        
        recorder.trackChange(event as vscode.TextDocumentChangeEvent);
        assert.strictEqual((recorder as any).sessionEvents.length, 1);
    });
});
