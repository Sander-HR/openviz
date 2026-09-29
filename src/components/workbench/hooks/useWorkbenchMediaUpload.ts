import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';

import type { ImageNode } from '@/types';
import { buildImageNode, isImageFile, resolveCenterFlowPoint } from '@/services/workbench/mediaUploadLogic';
import { fileToDataUrl } from '@/services/imageSource';

interface UseWorkbenchMediaUploadOptions {
    flowWrapperRef: RefObject<HTMLDivElement | null>;
    screenToFlowPosition: (point: { x: number; y: number }) => { x: number; y: number };
    makeOneShotNode: (node: ImageNode) => void;
}

/**
 * Media upload flows (FR-012, FR-014): desktop image picker + phone QR modal.
 * Node building/validation live in the pure mediaUploadLogic module (T023);
 * object-URL revocation happens in the store on removal (T024).
 */
export function useWorkbenchMediaUpload({ flowWrapperRef, screenToFlowPosition, makeOneShotNode }: UseWorkbenchMediaUploadOptions) {
    const mediaUploadInputRef = useRef<HTMLInputElement>(null);
    const [isPhoneUploadModalOpen, setIsPhoneUploadModalOpen] = useState(false);

    const handleMediaUpload = useCallback(() => {
        mediaUploadInputRef.current?.click();
    }, []);

    const handleMediaUploadFromPhone = useCallback(() => {
        setIsPhoneUploadModalOpen(true);
    }, []);

    const addImageFile = useCallback(async (file: File | undefined) => {
        if (!file || !isImageFile(file)) return;
        const dataUrl = await fileToDataUrl(file);
        const centerPoint = resolveCenterFlowPoint(flowWrapperRef.current?.getBoundingClientRect(), screenToFlowPosition);
        makeOneShotNode(buildImageNode({ src: dataUrl, fileName: file.name, mimeType: file.type, centerPoint }));
    }, [flowWrapperRef, makeOneShotNode, screenToFlowPosition]);

    const closePhoneUploadModal = useCallback(() => {
        setIsPhoneUploadModalOpen(false);
    }, []);

    const handlePhoneUploadComplete = useCallback(
        (info: { url: string; fileName: string; mimeType: string }) => {
            const centerPoint = resolveCenterFlowPoint(
                flowWrapperRef.current?.getBoundingClientRect(),
                screenToFlowPosition
            );

            makeOneShotNode(buildImageNode({ src: info.url, fileName: info.fileName, mimeType: info.mimeType, centerPoint }));
            setIsPhoneUploadModalOpen(false);
        },
        [flowWrapperRef, makeOneShotNode, screenToFlowPosition]
    );

    const handleMediaUploadChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            void addImageFile(event.target.files?.[0]);
            event.target.value = '';
        },
        [addImageFile]
    );

    return {
        mediaUploadInputRef,
        isPhoneUploadModalOpen,
        closePhoneUploadModal,
        handleMediaUpload,
        handleMediaUploadFromPhone,
        handlePhoneUploadComplete,
        handleMediaUploadChange,
        addImageFile,
    };
}
