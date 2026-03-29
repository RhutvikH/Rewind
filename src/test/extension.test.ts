import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start Rewind Integration Tests.');

	test('Rewind commands are registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        const rewindCommands = commands.filter(c => c.startsWith('rewind.'));
        
        assert.ok(rewindCommands.includes('rewind.addIntentMarker'));
        assert.ok(rewindCommands.includes('rewind.toggleHeatmap'));
        assert.ok(rewindCommands.includes('rewind.startGhostRewrite'));
        assert.ok(rewindCommands.includes('rewind.analyzeImpact'));
        assert.ok(rewindCommands.includes('rewind.startRecording'));
        assert.ok(rewindCommands.includes('rewind.showGraph'));
	});

    test('Rewind activates without errors', async () => {
        const extension = vscode.extensions.getExtension('RhutvikH.rewind');
        if (extension) {
            await extension.activate();
            assert.strictEqual(extension.isActive, true);
        }
    });
});
