import { describe, expect, it } from 'vitest';
import {
    composeStylePrompt,
    getStylePromptLayer,
    getStylePromptLayers,
    resolveStylePromptId,
} from './stylePromptRegistry';

describe('stylePromptRegistry', () => {
    it('defines a prompt layer for every render style', () => {
        const styles = getStylePromptLayers();

        expect(styles.map((style) => style.id)).toEqual([
            'photorealistic',
            'sketch',
            'cyberpunk',
            'minimalist',
            'product',
            'car_interior',
            'car_exterior',
        ]);
        styles.forEach((style) => expect(style.promptLayer.length).toBeGreaterThan(20));
    });

    it('resolves stable IDs and legacy display names', () => {
        expect(resolveStylePromptId('sketch')).toBe('sketch');
        expect(resolveStylePromptId('Sketch / Line Art')).toBe('sketch');
        expect(resolveStylePromptId('3D Render')).toBe('product');
        expect(resolveStylePromptId('unknown-style')).toBe('photorealistic');
    });

    it('composes the user prompt before the style layer', () => {
        expect(composeStylePrompt('A desk lamp', 'cyberpunk')).toBe(
            'A desk lamp\n\nStyle direction: A futuristic cyberpunk/neon aesthetic with vivid magenta and electric-blue lighting, luminous accents, high contrast, and a dramatic night atmosphere.',
        );
    });

    it('leaves an empty or missing style prompt unchanged', () => {
        expect(composeStylePrompt('  A desk lamp  ', undefined)).toBe('A desk lamp');
        expect(composeStylePrompt('  A desk lamp  ', '')).toBe('A desk lamp');
        expect(getStylePromptLayer('not-a-style')?.id).toBe('photorealistic');
    });
});
