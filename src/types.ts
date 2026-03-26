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
// The fundamental unit of time in Rewind
export interface RewindEvent {
    timestamp: number; // Unix timestamp
    type: 'intent_marker'; 
}

// 1. Intent Markers
export interface IntentMarkerEvent extends RewindEvent {
    type: 'intent_marker';
    file: string; // Absolute path
    line: number; // 0-indexed line number
    intentLabel: string; // e.g., "Refactoring", "Complex Logic"
    description?: string;
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
    drift: number; // 0.0 – 1.0, where 0 = no change and 1 = completely different
}