import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { CognitiveLoadManager } from './cognitiveLoadManager';
import { IntentManager } from './intentManager';
import { PasteManager } from './pasteManager';

export class PersistenceManager {
    private jsonDir: string = '';
    private isDirty: boolean = false;

    constructor() {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (workspace) {
            const rewindFolder = path.join(workspace.uri.fsPath, '.rewind');
            if (!fs.existsSync(rewindFolder)) {
                fs.mkdirSync(rewindFolder);
            }
            const dataFolder = path.join(rewindFolder, 'data');
            if (!fs.existsSync(dataFolder)) {
                fs.mkdirSync(dataFolder);
            }
            this.jsonDir = dataFolder;
        }
    }

    public markDirty() {
        this.isDirty = true;
    }

    public async autoSave(
        intentManager: IntentManager, 
        pasteManager: PasteManager,
        cognitiveLoadManager: CognitiveLoadManager
    ): Promise<void> {
        if (!this.isDirty) return;
        await this.saveState(intentManager, pasteManager, cognitiveLoadManager);
        this.isDirty = false;
    }

    private getPath(filename: string): string {
        return path.join(this.jsonDir, filename);
    }

    /**
     * Convert absolute paths to workspace-relative paths for portable JSON storage.
     */
    private toPortableMap<T>(absoluteMap: Record<string, T>): Record<string, T> {
        const portable: Record<string, T> = {};
        for (const [absPath, data] of Object.entries(absoluteMap)) {
            const relPath = vscode.workspace.asRelativePath(absPath, false);
            portable[relPath] = data;
        }
        return portable;
    }

    /**
     * Convert workspace-relative paths loaded from JSON back to absolute paths.
     */
    private toAbsoluteMap<T>(portableMap: Record<string, T>): Record<string, T> {
        const absolute: Record<string, T> = {};
        const workspace = vscode.workspace.workspaceFolders?.[0];
        
        for (const [relPath, data] of Object.entries(portableMap)) {
            if (workspace) {
                const absPath = path.join(workspace.uri.fsPath, relPath);
                // Standardize path separators (handles Windows vs Unix differences when loading)
                const standardizedPath = vscode.Uri.file(absPath).fsPath;
                absolute[standardizedPath] = data;
            } else {
                absolute[relPath] = data; // Fallback
            }
        }
        return absolute;
    }

    public async loadState(
        intentManager: IntentManager, 
        pasteManager: PasteManager,
        cognitiveLoadManager: CognitiveLoadManager
    ): Promise<void> {
        if (!this.jsonDir) return;

        try {
            // Load Intents
            const intentsFile = this.getPath('intents.json');
            if (fs.existsSync(intentsFile)) {
                const data = JSON.parse(fs.readFileSync(intentsFile, 'utf-8'));
                intentManager.hydrate(this.toAbsoluteMap(data));
            }

            // Load Pastes
            const pastesFile = this.getPath('pastes.json');
            if (fs.existsSync(pastesFile)) {
                const data = JSON.parse(fs.readFileSync(pastesFile, 'utf-8'));
                pasteManager.hydrate(this.toAbsoluteMap(data));
            }

            // Load Cognitive Heatmaps
            const cognitiveFile = this.getPath('cognitive.json');
            if (fs.existsSync(cognitiveFile)) {
                const data = JSON.parse(fs.readFileSync(cognitiveFile, 'utf-8'));
                cognitiveLoadManager.hydrate(this.toAbsoluteMap(data));
            }

            console.log('Rewind: Workspace state loaded successfully.');
        } catch (err) {
            console.error('Rewind: Failed to load workspace state', err);
        }
    }

    public async saveState(
        intentManager: IntentManager, 
        pasteManager: PasteManager,
        cognitiveLoadManager: CognitiveLoadManager
    ): Promise<void> {
        if (!this.jsonDir) return;

        try {
            // Save Intents
            const intentsData = this.toPortableMap(intentManager.serialize());
            fs.writeFileSync(this.getPath('intents.json'), JSON.stringify(intentsData), 'utf-8');

            // Save Pastes
            const pastesData = this.toPortableMap(pasteManager.serialize());
            fs.writeFileSync(this.getPath('pastes.json'), JSON.stringify(pastesData), 'utf-8');

            // Save Cognitive Load
            const cognitiveData = this.toPortableMap(cognitiveLoadManager.serialize());
            fs.writeFileSync(this.getPath('cognitive.json'), JSON.stringify(cognitiveData), 'utf-8');

            console.log('Rewind: Workspace state saved successfully.');
        } catch (err) {
            console.error('Rewind: Failed to save workspace state', err);
        }
    }
}
