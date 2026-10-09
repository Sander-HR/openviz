import { RenderSettings, ViewName } from '../types';

/**
 * Backend-agnostic generation operations (spec 006 S-5). Each backend
 * implements the operations it supports; availability is reported through
 * `capabilities` so the UI can gate Generate per operation.
 */
export type RenderOperation = 'generate' | 'animate' | 'new-view';

export interface NewViewRequest {
    /** Reference images (base64 data URIs or URLs) of the source product. */
    referenceImages: string[];
    /** Primary source image required by image-conditioned APIs. */
    init_image: string;
    /** Named view to render, e.g. 'Rear Right 3/4 view'. */
    view: ViewName;
    width: number;
    height: number;
}

export interface GenerateRequest extends RenderSettings {
    init_image: string; // base64 data URI (data:image/png;base64,...)
    width: number;
    height: number;
    projectId?: string;
    referenceImages?: string[];
    imageWorkflow?: 'edit' | 'reference';
    referenceResolution?: 512 | 1024 | 2048;
}

export interface GenerateResponse {
    success: boolean;
    images: string[]; // Full URLs to the generated images
    error?: string;
    jobId?: string;
}

export interface AnimateRequest {
    workflowId: string;
    init_image: string; // base64
    end_image?: string; // base64
    prompt?: string;
    width?: number;
    height?: number;
}

export interface RenderService {
    generate(request: GenerateRequest): Promise<GenerateResponse>;
    animate(request: AnimateRequest): Promise<GenerateResponse>;
    /** Render a named view of the product from reference images (spec 006 S-5). */
    newView(request: NewViewRequest): Promise<GenerateResponse>;
    checkConnection(): Promise<boolean>;
    /** Operations this backend supports; used to gate Generate per operation. */
    capabilities(): RenderOperation[];
}
