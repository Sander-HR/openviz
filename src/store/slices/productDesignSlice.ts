import type { StateCreator } from 'zustand';
import type { GenerationJob } from '@/types/generationJob.types';
import type { ProductReference, ProductVariantSet } from '@/types';
import type { AppState } from '../storeTypes';

export interface ProductDesignSlice {
    productJobs: Record<string, GenerationJob>;
    productReferences: Record<string, ProductReference>;
    productVariantSets: Record<string, ProductVariantSet>;
    activeProductReferenceId: string | null;
    upsertProductJob: (job: GenerationJob) => void;
    updateProductJob: (jobId: string, updates: Partial<GenerationJob>) => void;
    removeProductJob: (jobId: string) => void;
    upsertProductReference: (reference: ProductReference) => void;
    setActiveProductReference: (referenceId: string | null) => void;
    upsertProductVariantSet: (variantSet: ProductVariantSet) => void;
}

export const createProductDesignSlice: StateCreator<AppState, [], [], ProductDesignSlice> = (set) => ({
    productJobs: {},
    productReferences: {},
    productVariantSets: {},
    activeProductReferenceId: null,
    upsertProductJob: (job) => set((state) => ({ productJobs: { ...state.productJobs, [job.id]: job } })), 
    updateProductJob: (jobId, updates) => set((state) => {
        const current = state.productJobs[jobId];
        if (!current) return state;
        return { productJobs: { ...state.productJobs, [jobId]: { ...current, ...updates, updatedAt: Date.now() } } };
    }),
    removeProductJob: (jobId) => set((state) => {
        const { [jobId]: _removed, ...remaining } = state.productJobs;
        return { productJobs: remaining };
    }),
    upsertProductReference: (reference) => set((state) => ({
        productReferences: { ...state.productReferences, [reference.id]: reference },
        activeProductReferenceId: reference.id,
    })),
    setActiveProductReference: (referenceId) => set({ activeProductReferenceId: referenceId }),
    upsertProductVariantSet: (variantSet) => set((state) => ({ productVariantSets: { ...state.productVariantSets, [variantSet.id]: variantSet } })),
});
