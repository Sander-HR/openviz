import { RenderSettings } from '../types';

export interface GenerateRequest extends RenderSettings {
    init_image: string; // base64 data URI (data:image/png;base64,...)
    width: number;
    height: number;
}

export interface GenerateResponse {
    success: boolean;
    images: string[]; // Full URLs to the generated images
    error?: string;
}

export interface AnimateRequest {
    workflowId: string;
    init_image: string; // base64
    prompt?: string;
    width?: number;
    height?: number;
}

export interface RenderService {
    generate(request: GenerateRequest): Promise<GenerateResponse>;
    animate(request: AnimateRequest): Promise<GenerateResponse>;
    checkConnection(): Promise<boolean>;
}
