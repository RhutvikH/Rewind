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
    file: string;
    startLine: number;
    endLine: number;
    originalText: string;
    currentText: string;
    source: string;
    drift: number;
}