import { RenderSettings } from '../types';

export interface GenerateRequest extends RenderSettings {
    init_image: string; // base64 data URI (data:image/png;base64,...)
}

export interface GenerateResponse {
    success: boolean;
    images: string[]; // Full URLs to the generated images
    error?: string;
}

export interface RenderService {
    generate(request: GenerateRequest): Promise<GenerateResponse>;
    checkConnection(): Promise<boolean>;
}
