import * as assert from 'assert';
import { IntentManager } from '../intentManager';

suite('IntentManager Test Suite', () => {
    test('IntentManager correctly adds and removes markers', () => {
        const manager = new IntentManager();
        const file = '/abs/path/file.ts';
        
        manager.addMarker(file, 10, 'Refactoring', 'Cleaning up');
        let markers = manager.getMarkersForFile(file);
        assert.strictEqual(markers.length, 1);
        assert.strictEqual(markers[0].intentLabel, 'Refactoring');

        manager.removeMarkersAtLine(file, 10);
        markers = manager.getMarkersForFile(file);
        assert.strictEqual(markers.length, 0);
    });

    test('IntentManager removes markers by category', () => {
        const manager = new IntentManager();
        const file = '/abs/path/file.ts';
        
        manager.addMarker(file, 5, 'Refactoring');
        manager.addMarker(file, 10, 'Bug Fix');
        
        manager.removeMarkersByCategory(['Refactoring']);
        const markers = manager.getMarkersForFile(file);
        assert.strictEqual(markers.length, 1);
        assert.strictEqual(markers[0].intentLabel, 'Bug Fix');
    });
});
