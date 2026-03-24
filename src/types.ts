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
    drift: number; // 0.0 – 1.0, where 0 = no change and 1 = completely different
}