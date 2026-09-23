import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';

import type { ImageNode } from '@/types';
import { buildImageNode, isImageFile, resolveCenterFlowPoint } from '@/services/workbench/mediaUploadLogic';

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
            const file = event.target.files?.[0];
            // FR-012: image-only validation lives in the pure module (T023).
            if (!file || !isImageFile(file)) {
                return;
            }

            const objectUrl = URL.createObjectURL(file);
            const centerPoint = resolveCenterFlowPoint(
                flowWrapperRef.current?.getBoundingClientRect(),
                screenToFlowPosition
            );

            makeOneShotNode(buildImageNode({ src: objectUrl, fileName: file.name, mimeType: file.type, centerPoint }));
            event.target.value = '';
        },
        [flowWrapperRef, makeOneShotNode, screenToFlowPosition]
    );

    return {
        mediaUploadInputRef,
        isPhoneUploadModalOpen,
        closePhoneUploadModal,
        handleMediaUpload,
        handleMediaUploadFromPhone,
        handlePhoneUploadComplete,
        handleMediaUploadChange,
    };
}
