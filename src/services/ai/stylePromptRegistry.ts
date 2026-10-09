export const renderStyleIds = [
    'photorealistic',
    'cinematic',
    'ultra_realistic',
    'sketch',
    'cyberpunk',
    'minimalist',
    'product',
    'car_interior',
    'car_exterior',
] as const;

export type RenderStyleId = (typeof renderStyleIds)[number];

export interface StylePromptLayer {
    id: RenderStyleId;
    promptLayer: string;
}

const STYLE_PROMPT_LAYERS: Record<RenderStyleId, StylePromptLayer> = {
    photorealistic: {
        id: 'photorealistic',
        promptLayer: 'A highly photorealistic render with physically accurate materials, natural proportions, realistic textures, soft studio lighting, and crisp fine detail.',
    },
    cinematic: {
        id: 'cinematic',
        promptLayer: 'A cinematic render with dramatic directional lighting, shallow depth of field, filmic color grading, and a moody atmospheric mood.',
    },
    ultra_realistic: {
        id: 'ultra_realistic',
        promptLayer: 'An ultra realistic render with hyper-detailed physically based materials, true-to-life textures, micro-surface detail, and natural light response.',
    },
    sketch: {
        id: 'sketch',
        promptLayer: 'A refined hand-drawn concept sketch with expressive confident linework, visible construction details, subtle graphite shading, and a clean white paper presentation.',
    },
    cyberpunk: {
        id: 'cyberpunk',
        promptLayer: 'A futuristic cyberpunk/neon aesthetic with vivid magenta and electric-blue lighting, luminous accents, high contrast, and a dramatic night atmosphere.',
    },
    minimalist: {
        id: 'minimalist',
        promptLayer: 'A clean minimalist design with simple geometric forms, restrained details, balanced negative space, a limited neutral palette, and soft controlled lighting.',
    },
    product: {
        id: 'product',
        promptLayer: 'A premium product photography render with precise industrial-design proportions, seamless studio backdrop, softbox lighting, realistic materials, and a polished commercial presentation.',
    },
    car_interior: {
        id: 'car_interior',
        promptLayer: 'A premium automotive interior visualization with realistic upholstery, refined trim, ergonomic proportions, integrated technology, and cinematic yet practical cabin lighting.',
    },
    car_exterior: {
        id: 'car_exterior',
        promptLayer: 'A high-end automotive exterior visualization with precise body surfacing, realistic paint and glass, accurate reflections, dramatic studio lighting, and a polished commercial presentation.',
    },
};

const STYLE_NAME_ALIASES: Record<string, RenderStyleId> = {
    Photorealistic: 'photorealistic',
    Cinematic: 'cinematic',
    'Ultra Realistic': 'ultra_realistic',
    'Sketch / Line Art': 'sketch',
    Cyberpunk: 'cyberpunk',
    'Cyberpunk / Neon': 'cyberpunk',
    Minimalist: 'minimalist',
    Watercolor: 'sketch',
    '3D Render': 'product',
    'Product Render': 'product',
    'Car Interior': 'car_interior',
    'Car Exterior': 'car_exterior',
};

export function resolveStylePromptId(style: string | undefined): RenderStyleId {
    if (style && Object.prototype.hasOwnProperty.call(STYLE_PROMPT_LAYERS, style)) {
        return style as RenderStyleId;
    }
    return STYLE_NAME_ALIASES[style ?? ''] ?? 'photorealistic';
}

export function getStylePromptLayer(style: string | undefined): StylePromptLayer | undefined {
    if (!style?.trim()) return undefined;
    return STYLE_PROMPT_LAYERS[resolveStylePromptId(style)];
}

export function getStylePromptLayers(): StylePromptLayer[] {
    return renderStyleIds.map((id) => STYLE_PROMPT_LAYERS[id]);
}

export function composeStylePrompt(userPrompt: string, style: string | undefined): string {
    const prompt = userPrompt.trim();
    const styleLayer = getStylePromptLayer(style);
    if (!prompt || !styleLayer) return prompt;
    return `${prompt}\n\nStyle direction: ${styleLayer.promptLayer}`;
}

/**
 * Build the prompt for a named-view render (spec 006 S-5 `new-view`). The
 * reference images carry the subject's geometry — a product, an animal, or
 * any other object; the prompt only pins the camera angle so the model keeps
 * the subject's appearance and proportions.
 */
export function composeNewViewPrompt(view: string): string {
    return `Render the ${view} of this exact subject, keeping its appearance, details and proportions identical to the reference images.`;
}
