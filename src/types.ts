import * as vscode from 'vscode';

export interface ImpactAlert {
    uri: vscode.Uri;
    range: vscode.Range;
    sourceUri: string;    // URI string of the file whose save triggered this alert
    symbolName: string;   // Exported symbol name that changed (e.g. "myFunction")
    message: string;
}

export const MARKER_ORIG_START = '// [Rewind: Original Start]';
export const MARKER_GHOST_START = '// [Rewind: Ghost Branch]';
export const MARKER_GHOST_END = '// [Rewind: End Ghost Branch]';

export interface LineMetrics {
    deletions: number;
    editCount: number;
    dwellTimeMs: number;
    totalScore: number;
}

export interface RewindEvent {
    type: string;
}

export interface PasteEvent extends RewindEvent {
    type: 'paste_event';
    timestamp: number;
}

    // The fundamental unit of time in Rewind
export interface RewindEvent {
    timestamp: number; // Unix timestamp
    type: string; 
}

// 1. Intent Markers
export interface IntentMarkerEvent extends RewindEvent {
    type: 'intent_marker';
    file: string; // Absolute path
    line: number; // 0-indexed line number
    intentLabel: string; // e.g., "Refactoring", "Complex Logic"
    description?: string;
}

// Base event type
export interface RewindEvent {
    timestamp: number;
    type: string;
}

// Paste Genealogy
export interface PasteEvent extends RewindEvent {
    type: 'paste_event';
    file: string;
    startLine: number;
    endLine: number;
    originalText: string;
    currentText: string;
    source: string;
    drift: number;
}
