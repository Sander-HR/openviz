import { RenderService } from './types';
import { mockRenderService } from './mockRenderService';
import { useStore } from '@/store/useStore';
import { comfyRenderService } from './comfyuiRenderService';
import { openAIImageRenderService } from './openAIImageRenderService';

export { comfyRenderService } from './comfyuiRenderService';
export { imageApiQueue, normalizeImageApiSize, downscaleImageApiDimensions } from './openAIImageRenderService';

/**
 * Generic render facade. Mock mode is an explicit environment override;
 * otherwise the active protocol is selected from the persisted AI settings.
 */
const useMock = process.env.NEXT_PUBLIC_USE_MOCK_RENDER === 'true' || process.env.VITE_USE_MOCK_RENDER === 'true';

export const renderService: RenderService = useMock ? mockRenderService : {
    generate: (request) => useStore.getState().computeSettings.protocol === 'openai-image'
        ? openAIImageRenderService.generate(request)
        : comfyRenderService.generate(request),
    animate: (request) => useStore.getState().computeSettings.protocol === 'openai-image'
        ? openAIImageRenderService.animate(request)
        : comfyRenderService.animate(request),
    checkConnection: () => useStore.getState().computeSettings.protocol === 'openai-image'
        ? openAIImageRenderService.checkConnection()
        : comfyRenderService.checkConnection(),
};










