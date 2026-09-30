import React, { useMemo, useState } from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { createLocalComfyTarget } from '@/services/ai/targets/localComfyTarget';
import { createOpenAIImageTarget } from '@/services/ai/targets/openAIImageTarget';
import type { AspectRatio } from '@/types';
import { generateUUID } from '@/utils/uuid';
import { useStore } from '@/store/useStore';
import { useProductGeneration } from './hooks/useProductGeneration';
import { ProductParameterForm } from './ProductParameterForm';
import { ProductVariantGallery } from './ProductVariantGallery';
import { ProductWorkflowPicker } from './ProductWorkflowPicker';

function dimensionsForRatio(ratio: AspectRatio): { width: number; height: number } {
    if (ratio === '4:3') return { width: 1200, height: 900 };
    if (ratio === '3:4') return { width: 900, height: 1200 };
    if (ratio === '16:9') return { width: 1344, height: 768 };
    if (ratio === '9:16') return { width: 768, height: 1344 };
    return { width: 1024, height: 1024 };
}

interface ProductWorkflowPanelProps {
    collapsed?: boolean;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export const ProductWorkflowPanel: React.FC<ProductWorkflowPanelProps> = ({ collapsed, onCollapsedChange }) => {
    const settings = useStore((state) => state.computeSettings);
    const projectId = useStore((state) => state.currentProjectId);
    const upsertProductReference = useStore((state) => state.upsertProductReference);
    const addImageToWorkbench = useStore((state) => state.addImageToWorkbench);
    const [workflowId, setWorkflowId] = useState('product_concept');
    const [prompt, setPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [batchSize, setBatchSize] = useState(4);
    const [formError, setFormError] = useState<string | undefined>();
    const [internalCollapsed, setInternalCollapsed] = useState(false);
    const isCollapsed = collapsed ?? internalCollapsed;
    const setCollapsed = (nextCollapsed: boolean) => {
        onCollapsedChange?.(nextCollapsed);
        if (collapsed === undefined) setInternalCollapsed(nextCollapsed);
    };
    const dimensions = dimensionsForRatio(aspectRatio);
    const adapter = useMemo(() => {
        if (settings.protocol === 'openai-image' && settings.imageApiEndpoint) {
            return createOpenAIImageTarget({
                id: 'image-api',
                endpoint: settings.imageApiEndpoint,
                model: settings.imageApiModel,
                apiKey: settings.imageApiKey,
                keyless: settings.imageApiKeyless,
                size: settings.imageApiSize,
            });
        }
        return settings.targetKind === 'local' && settings.localEndpoint
            ? createLocalComfyTarget({ id: 'local', endpoint: settings.localEndpoint })
            : null;
    }, [settings]);
    const generation = useProductGeneration({ adapter, targetKind: settings.targetKind, targetId: settings.targetKind, projectId: projectId ?? undefined });
    const jobs = Object.values(generation.jobs).filter((job) => job.workflowId === workflowId);

    async function handleSubmit() {
        if (!prompt.trim()) {
            setFormError('Describe the product before generating.');
            return;
        }
        if (workflowId !== 'product_concept') {
            setFormError('This workflow is selected in the registry and its dedicated form is coming next.');
            return;
        }
        setFormError(undefined);
        try {
            await generation.generateConcept({ prompt, negativePrompt, aspectRatio, ...dimensions, batchSize });
        } catch (error) {
            setFormError(error instanceof Error ? error.message : 'Unable to start generation.');
        }
    }

    return (
        <aside className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-[14px] bg-[#0d0d12] text-zinc-300" aria-label="Product workflow panel">
            <header className="flex h-10 shrink-0 items-center justify-between rounded-t-[14px] bg-neutral-800 px-3 text-white">
                <button type="button" aria-expanded={!isCollapsed} aria-controls="studio-product-content" onClick={() => setCollapsed(!isCollapsed)} className="flex h-full items-center gap-2 text-left">
                    <ChevronDown size={14} className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`} aria-hidden="true" />
                    <h2 className="text-[11px] font-semibold">Generate</h2>
                </button>
                <button type="button" aria-label="Generate menu" className="flex h-10 w-10 items-center justify-center text-white/80 hover:text-white"><MoreHorizontal size={17} aria-hidden="true" /></button>
            </header>
            {!isCollapsed && <div id="studio-product-content" className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4 custom-scrollbar">
                <ProductWorkflowPicker selectedWorkflowId={workflowId} onChange={setWorkflowId} />
                <ProductParameterForm prompt={prompt} negativePrompt={negativePrompt} batchSize={batchSize} aspectRatio={aspectRatio} isSubmitting={generation.isGenerating} error={formError ?? generation.error ?? undefined} onPromptChange={setPrompt} onNegativePromptChange={setNegativePrompt} onBatchSizeChange={setBatchSize} onAspectRatioChange={setAspectRatio} onSubmit={() => void handleSubmit()} />
                <ProductVariantGallery jobs={jobs} onSelectReference={(job, output) => {
                    upsertProductReference({ id: generateUUID(), assetId: output.assetId ?? output.url, projectId: projectId ?? undefined, sourceJobId: job.id, width: output.width, height: output.height, contentType: output.contentType, role: 'selected-concept', createdAt: Date.now() });
                    addImageToWorkbench(output.url);
                }} />
            </div>}
        </aside>
    );
};
