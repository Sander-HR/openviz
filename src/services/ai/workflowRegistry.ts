import photorealistic from './workflows/render-photorealistic.json';
import sketch from './workflows/render-sketch.json';
import cyberpunk from './workflows/render-cyberpunk.json';
import minimalist from './workflows/render-minimalist.json';
import product from './workflows/render-product.json';
import carInterior from './workflows/render-car-interior.json';
import carExterior from './workflows/render-car-exterior.json';
import videoStandard from './workflows/video-standard.json';
import animateFromTo from './workflows/animate-from-to-api.json';

export interface WorkflowDefinition {
    id: string;
    name: string;
    type: 'render' | 'video';
    description: string;
    template: any; // The JSON object
    
    // Mapping specific concepts to Node IDs in this specific workflow
    nodes: {
        prompt?: string;       // Node ID for positive prompt
        negative_prompt?: string; // Node ID for negative prompt
        seed?: string;         // Node ID for KSampler
        image_input?: string;  // Node ID for LoadImage
        image_input_end?: string; // Node ID for second LoadImage (From-To)
        image_output?: string; // Node ID for SaveImage
        video_output?: string; // Node ID for VideoCombine
        
        // ControlNet specific
        controlnet_strength?: string;
    };
    
    defaults?: {
        negative_prompt?: string;
        cfg?: number;
        steps?: number;
    };
}

export const WORKFLOWS: Record<string, WorkflowDefinition> = {
    'photorealistic': {
        id: 'photorealistic',
        name: 'Photorealistic',
        type: 'render',
        description: 'High quality photorealistic rendering',
        template: photorealistic,
        nodes: {
            prompt: "6",
            negative_prompt: "50",
            seed: "3",
            image_input: "45",
            image_output: "9",
            controlnet_strength: "51"
        },
        defaults: {
            negative_prompt: "blurry, low quality, distortion, watermark, text"
        }
    },
    'sketch': {
        id: 'sketch',
        name: 'Sketch / Line Art',
        type: 'render',
        description: 'Artistic sketch style',
        template: sketch,
        nodes: {
            prompt: "6",
            negative_prompt: "50",
            seed: "3",
            image_input: "45",
            image_output: "9",
            controlnet_strength: "51"
        }
    },
    'cyberpunk': {
        id: 'cyberpunk',
        name: 'Cyberpunk / Neon',
        type: 'render',
        description: 'Futuristic neon aesthetics',
        template: cyberpunk,
        nodes: {
            prompt: "6",
            negative_prompt: "50",
            seed: "3",
            image_input: "45",
            image_output: "9",
            controlnet_strength: "51"
        }
    },
    'minimalist': {
        id: 'minimalist',
        name: 'Minimalist',
        type: 'render',
        description: 'Clean, simple, geometric',
        template: minimalist,
        nodes: {
            prompt: "6",
            negative_prompt: "50",
            seed: "3",
            image_input: "45",
            image_output: "9",
            controlnet_strength: "51"
        }
    },
    'product': {
        id: 'product',
        name: 'Product Render',
        type: 'render',
        description: 'Studio lighting product photography',
        template: product,
        nodes: {
            prompt: "6",
            negative_prompt: "50",
            seed: "3",
            image_input: "45",
            image_output: "9",
            controlnet_strength: "51"
        }
    },
    'car_interior': {
        id: 'car_interior',
        name: 'Car Interior',
        type: 'render',
        description: 'Automotive interior design',
        template: carInterior,
        nodes: {
            prompt: "6",
            negative_prompt: "50",
            seed: "3",
            image_input: "45",
            image_output: "9",
            controlnet_strength: "51"
        }
    },
    'car_exterior': {
        id: 'car_exterior',
        name: 'Car Exterior',
        type: 'render',
        description: 'Automotive exterior visualization',
        template: carExterior,
        nodes: {
            prompt: "6",
            negative_prompt: "50",
            seed: "3",
            image_input: "45",
            image_output: "9",
            controlnet_strength: "51"
        }
    },
    'video_standard': {
        id: 'video_standard',
        name: 'Standard Video',
        type: 'video',
        description: 'Standard video generation from image',
        template: videoStandard,
        nodes: {
            prompt: "6",
            negative_prompt: "7",
            image_input: "45",
            video_output: "90",
            seed: "3"
        }
    },
    'animate_from_to': {
        id: 'animate_from_to',
        name: 'Animate From-To',
        type: 'video',
        description: 'Animate between two keyframes',
        template: animateFromTo,
        nodes: {
            prompt: "22",
            image_input: "14",
            image_input_end: "21",
            video_output: "37",
            seed: "2"
        }
    }
};

export const getWorkflow = (id: string): WorkflowDefinition | undefined => {
    return WORKFLOWS[id];
};

// Helper to map old style names to new IDs
export const mapStyleToId = (styleName: string): string => {
    const map: Record<string, string> = {
        'Photorealistic': 'photorealistic',
        'Sketch / Line Art': 'sketch',
        'Cyberpunk / Neon': 'cyberpunk',
        'Minimalist': 'minimalist',
        'Watercolor': 'sketch', // Fallback
        '3D Render': 'product', // Fallback
        'Product Render': 'product',
        'Car Interior': 'car_interior',
        'Car Exterior': 'car_exterior'
    };
    return map[styleName] || 'photorealistic';
};

export const getRenderStyles = () => Object.values(WORKFLOWS).filter(w => w.type === 'render');
export const getVideoStyles = () => Object.values(WORKFLOWS).filter(w => w.type === 'video');
