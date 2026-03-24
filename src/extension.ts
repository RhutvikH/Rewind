import * as vscode from 'vscode';
import { updateDecorations, reloadDecorationStyle } from './decorations';
import { IntentManager } from './intentManager';

let intentManager: IntentManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('Rewind: Activating Intent Markers extension...');

    // 1. Initialize Modules
    intentManager = new IntentManager();

    // 2. Command: Add Intent Marker
    let intentMarkerDisposable = vscode.commands.registerCommand('rewind.addIntentMarker', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const config = vscode.workspace.getConfiguration('rewind');
        const customCategories = config.get<string[]>('customIntentCategories') || [];
        const baseCategories = ['Refactoring', 'Complex Logic', 'Needs Review', 'Hack', 'Bug Fix'];

        // Remove duplicates just in case
        const allCategories = Array.from(new Set([...baseCategories, ...customCategories]));

        const quickPickItems: vscode.QuickPickItem[] = [
            ...allCategories.map(c => ({ label: c })),
            { label: '', kind: vscode.QuickPickItemKind.Separator },
            { label: '➕ Create Custom Intent...' }
        ];

        const selectedOption = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select an intent category'
        });

        if (!selectedOption) {
            return; // User canceled
        }

        let selectedIntent = selectedOption.label;

        if (selectedOption.label === '➕ Create Custom Intent...') {
            const newIntent = await vscode.window.showInputBox({
                prompt: 'Enter your custom intent category (e.g., Performance Tuning)',
                placeHolder: 'My Custom Intent...'
            });

            if (!newIntent || newIntent.trim() === '') return;
            selectedIntent = newIntent.trim();

            // Save to settings globally
            await config.update('customIntentCategories', [...customCategories, selectedIntent], vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Added Custom Intent: ${selectedIntent}`);
        }

        const description = await vscode.window.showInputBox({
            prompt: 'Optional description for this marker (e.g., Try a new approach here...)',
            placeHolder: 'Description...'
        });

        const line = editor.selection.active.line;
        const file = editor.document.fileName;

        intentManager.addMarker(file, line, selectedIntent, description);
        updateDecorations(editor, intentManager);
        vscode.window.showInformationMessage(`Added Intent Marker: ${selectedIntent}`);
    });

    // 3. Command: Remove Intent Marker
    let removeMarkerDisposable = vscode.commands.registerCommand('rewind.removeIntentMarker', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const line = editor.selection.active.line;
        const file = editor.document.fileName;

        const markersOnLine = intentManager.getMarkersForFile(file).filter(m => m.line === line);

        if (markersOnLine.length === 0) {
            vscode.window.showInformationMessage('No intent markers on this line.');
            return;
        }

        if (markersOnLine.length === 1) {
            intentManager.removeMarkersAtLine(file, line, markersOnLine[0].timestamp);
            updateDecorations(editor, intentManager);
            vscode.window.showInformationMessage(`Removed Intent Marker: ${markersOnLine[0].intentLabel}`);
            return;
        }

        // Multiple markers on this line, let user choose
        const quickPickItems = markersOnLine.map(m => ({
            label: m.intentLabel,
            description: m.description,
            marker: m
        }));

        quickPickItems.push({
            label: 'Remove All Markers on this Line',
            description: '',
            marker: null as any
        });

        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select which marker to remove'
        });

        if (!selected) return;

        if (selected.marker === null) {
            // Remove all
            intentManager.removeMarkersAtLine(file, line);
            updateDecorations(editor, intentManager);
            vscode.window.showInformationMessage('Removed all Intent Markers on this line.');
        } else {
            // Remove specific
            intentManager.removeMarkersAtLine(file, line, selected.marker.timestamp);
            updateDecorations(editor, intentManager);
            vscode.window.showInformationMessage(`Removed Intent Marker: ${selected.marker.intentLabel}`);
        }
    });

    // 4. Command: Delete Custom Intent Category
    let deleteCustomCategoryDisposable = vscode.commands.registerCommand('rewind.removeCustomIntentCategory', async () => {
        const config = vscode.workspace.getConfiguration('rewind');
        const customCategories = config.get<string[]>('customIntentCategories') || [];

        if (customCategories.length === 0) {
            vscode.window.showInformationMessage('You have no custom intent categories to delete.');
            return;
        }

        const selectedCategories = await vscode.window.showQuickPick(customCategories, {
            placeHolder: 'Select custom categories to delete',
            canPickMany: true
        });

        if (!selectedCategories || selectedCategories.length === 0) {
            return;
        }

        const updatedCategories = customCategories.filter(c => !selectedCategories.includes(c));
        await config.update('customIntentCategories', updatedCategories, vscode.ConfigurationTarget.Global);

        // Remove existing intent markers across files corresponding to the deleted categories
        intentManager.removeMarkersByCategory(selectedCategories);

        // Update decorations in all visible editors
        for (const editor of vscode.window.visibleTextEditors) {
            updateDecorations(editor, intentManager);
        }

        vscode.window.showInformationMessage(`Deleted ${selectedCategories.length} custom categories and cleaned up existing markers.`);
    });

    // 5. Event Listener: Active Editor Changed
    let activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            updateDecorations(editor, intentManager);
        }
    });

    // 6. Event Listener: Configuration Changed
    let configDisposable = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('rewind.intentMarkerColor')) {
            reloadDecorationStyle();

            // Reapply style in all visible editors
            for (const editor of vscode.window.visibleTextEditors) {
                updateDecorations(editor, intentManager);
            }
        }
    });

    // Register everything
    context.subscriptions.push(
        intentMarkerDisposable,
        removeMarkerDisposable,
        deleteCustomCategoryDisposable,
        activeEditorDisposable,
        configDisposable
    );
}

export function deactivate() { }