import * as vscode from 'vscode';
import { initImpactDecorations, updateImpactDecorations } from './decorations';
import { analyzeImpact } from './impactManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('Rewind: Change Impact Alert System active!');

    initImpactDecorations(context);

    // Run dependency analysis silently on save
    vscode.workspace.onDidSaveTextDocument(async (document) => {
        // Run deep impact resolution only on typical source files explicitly linked into ASTs
        if (document.uri.scheme === 'file' && 
           (document.languageId === 'typescript' || document.languageId === 'javascript')) {
            await analyzeImpact(document);
        }
    });

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            updateImpactDecorations(editor);
        }
    });

    if (vscode.window.activeTextEditor) {
        updateImpactDecorations(vscode.window.activeTextEditor);
    }
}

export function deactivate() {}
