import * as vscode from 'vscode';
import { initPasteDecorations, updatePasteDecorations } from './decorations';
import { PasteManager } from './pasteManager';

let pasteManager: PasteManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('Rewind: Activating Paste Genealogy extension...');

    // Must be called first while extension host is ready
    initPasteDecorations();
    pasteManager = new PasteManager();

    const stripWS = (s: string) => s.replace(/\s+/g, '');

    // Guard against duplicate detection prompts (e.g. formatOnPaste fires a 2nd event)
    const recentlyTracked = new Set<string>();

    const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
        // Step 1: always update coordinates + repaint existing tracked blocks
        pasteManager.onDocumentChange(e);
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document === e.document) {
            updatePasteDecorations(activeEditor, pasteManager);
        }

        // Step 2: check each content change for a clipboard match
        for (const change of e.contentChanges) {
            // Skip small changes (single keystrokes, spaces, etc.)
            if (change.text.length < 10) continue;

            // Capture everything we need from the synchronous event before going async
            const insertedText = change.text;
            const startLine = change.range.start.line;
            const endLine = startLine + (insertedText.split('\n').length - 1);
            const docRef = e.document;

            // De-duplicate: key = file + startLine + endLine
            const trackKey = `${docRef.fileName}:${startLine}:${endLine}`;
            if (recentlyTracked.has(trackKey)) continue;

            // Read clipboard immediately — async IIFE so we don't block the event
            (async () => {
                try {
                    const cbText = await vscode.env.clipboard.readText();
                    if (!cbText || cbText.trim().length < 10) return;
                    if (stripWS(insertedText) !== stripWS(cbText)) return;

                    // It's a paste — prevent duplicates for 2 seconds
                    recentlyTracked.add(trackKey);
                    setTimeout(() => recentlyTracked.delete(trackKey), 2000);

                    // Wait a tick for formatOnPaste to settle before reading final text
                    await new Promise(resolve => setTimeout(resolve, 400));

                    const range = new vscode.Range(
                        new vscode.Position(startLine, 0),
                        new vscode.Position(Math.min(endLine + 1, docRef.lineCount), 0)
                    );
                    const rawBlock = docRef.getText(range);

                    const source = await vscode.window.showInputBox({
                        prompt: 'Where did you paste this from? (Optional)',
                        placeHolder: 'e.g., StackOverflow, GitHub, External Repo'
                    });

                    if (source === undefined) {
                        // User cancelled — remove the de-dup guard so they can re-track
                        recentlyTracked.delete(trackKey);
                        return;
                    }

                    pasteManager.addPasteEvent(
                        docRef.fileName,
                        startLine,
                        endLine,
                        rawBlock,
                        rawBlock,
                        source || 'External Clipboard'
                    );

                    const editor = vscode.window.activeTextEditor;
                    if (editor && editor.document.fileName === docRef.fileName) {
                        updatePasteDecorations(editor, pasteManager);
                    }
                    vscode.window.showInformationMessage(
                        `Paste tracked from: ${source || 'External Clipboard'}`
                    );
                } catch { /* ignore clipboard/document errors */ }
            })();
        }
    });

    // Manual command: select any code → mark it as pasted
    const markPastedDisposable = vscode.commands.registerCommand('rewind.markAsPasted', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select the text to mark as pasted.');
            return;
        }

        const selection = editor.selection;
        const range = new vscode.Range(
            new vscode.Position(selection.start.line, 0),
            new vscode.Position(selection.end.line + 1, 0)
        );
        const text = editor.document.getText(range);

        const source = await vscode.window.showInputBox({
            prompt: 'Where did you paste this from? (Optional)',
            placeHolder: 'e.g., StackOverflow, External Repo'
        });

        pasteManager.addPasteEvent(
            editor.document.fileName,
            selection.start.line,
            selection.end.line,
            text,
            text,
            source || 'Manual Assignment'
        );

        updatePasteDecorations(editor, pasteManager);
        vscode.window.showInformationMessage('Selection marked as pasted.');
    });

    // Repaint highlights when switching files
    const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) updatePasteDecorations(editor, pasteManager);
    });

    context.subscriptions.push(
        documentChangeDisposable,
        markPastedDisposable,
        activeEditorDisposable
    );
}

export function deactivate() { }