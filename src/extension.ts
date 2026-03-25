import * as vscode from 'vscode';
import { startGhostRewrite, acceptGhostRewrite, discardGhostRewrite, guardGhostBranchEdits, syncGhostBlocksCache } from './ghostBranchManager';
import { initGhostDecorations, updateGhostDecorations } from './decorations';

export function activate(context: vscode.ExtensionContext) {
    console.log('Rewind: Timeline Forking active!');

    initGhostDecorations(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('rewind.startGhostRewrite', () => {
            if (vscode.window.activeTextEditor) {
                startGhostRewrite(vscode.window.activeTextEditor);
            }
        }),
        vscode.commands.registerCommand('rewind.acceptGhostRewrite', () => {
            if (vscode.window.activeTextEditor) {
                acceptGhostRewrite(vscode.window.activeTextEditor);
            }
        }),
        vscode.commands.registerCommand('rewind.discardGhostRewrite', () => {
            if (vscode.window.activeTextEditor) {
                discardGhostRewrite(vscode.window.activeTextEditor);
            }
        })
    );

    vscode.workspace.onDidChangeTextDocument(e => {
        if (guardGhostBranchEdits(e)) {
            return;
        }

        if (vscode.window.activeTextEditor && e.document === vscode.window.activeTextEditor.document) {
            updateGhostDecorations(vscode.window.activeTextEditor);
            syncGhostBlocksCache(e.document);
        }
    });

    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            updateGhostDecorations(editor);
            syncGhostBlocksCache(editor.document);
        }
    });

    if (vscode.window.activeTextEditor) {
        updateGhostDecorations(vscode.window.activeTextEditor);
        syncGhostBlocksCache(vscode.window.activeTextEditor.document);
    }
}

export function deactivate() {}
