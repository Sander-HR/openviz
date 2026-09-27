import React from 'react';
import type { ChangeEvent, RefObject } from 'react';


import { ProjectHeader } from '../common/ProjectHeader';
import { CanvasControls } from '../studio/CanvasControls';
import { WorkbenchToolbar } from './WorkbenchToolbar';
import { PhoneUploadModal } from './PhoneUploadModal';
import { BasicBlocksMenu } from '../nodes/BasicBlocksMenu';
import type { BasicBlocksMenuState } from './hooks/useWorkbenchBlockCreation';
import type { WorkbenchToolType } from '@/types';

interface WorkbenchChromeProps {
    dropdownRef: RefObject<HTMLDivElement>;
    activeTool: WorkbenchToolType;
    freehandColor: string;
    freehandStrokeWidth: number;
    onSelectTool: (tool: WorkbenchToolType) => void;
    onFreehandColorChange: (color: string) => void;
    onFreehandStrokeWidthChange: (width: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    onMediaUpload: () => void;
    onMediaUploadFromPhone: () => void;
    sketchFormats: { label: string; width: number; height: number }[];
    onFormatSelect: (width: number, height: number) => void;
    mediaUploadInputRef: RefObject<HTMLInputElement>;
    onMediaUploadChange: (event: ChangeEvent<HTMLInputElement>) => void;
    isPhoneUploadModalOpen: boolean;
    onClosePhoneUploadModal: () => void;
    onPhoneUploadComplete: (info: { url: string; fileName: string; mimeType: string }) => void;
    zoomLevel: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
    /** Absolute zoom presets (25/50/75/100%) from the percentage popover. */
    onSetZoom?: (zoom: number) => void;
    onFitToScreen: () => void;
    basicBlocksMenu: BasicBlocksMenuState;
    onBlockSelect: (type: 'modify' | 'animate' | 'variate' | 'render') => void;
}

/**
 * Presentational overlay chrome for the Workbench canvas: project header,
 * toolbar, zoom controls, context menu, block-creation menu, hidden media
 * input and phone-upload modal. Extracted from the Workbench view to keep it
 * under the 300-line constitution limit (T028).
 */
export const WorkbenchChrome: React.FC<WorkbenchChromeProps> = ({
    dropdownRef,
    activeTool,
    freehandColor,
    freehandStrokeWidth,
    onSelectTool,
    onFreehandColorChange,
    onFreehandStrokeWidthChange,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onMediaUpload,
    onMediaUploadFromPhone,
    sketchFormats,
    onFormatSelect,
    mediaUploadInputRef,
    onMediaUploadChange,
    isPhoneUploadModalOpen,
    onClosePhoneUploadModal,
    onPhoneUploadComplete,
    zoomLevel,
    onZoomIn,
    onZoomOut,
    onSetZoom,
    onFitToScreen,
    basicBlocksMenu,
    onBlockSelect,
}) => (
    <>
        <input
            ref={mediaUploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onMediaUploadChange}
        />

        <PhoneUploadModal
            open={isPhoneUploadModalOpen}
            onClose={onClosePhoneUploadModal}
            onUploadComplete={onPhoneUploadComplete}
        />

        <div className="absolute top-4 left-4 z-20">
            <ProjectHeader mode="workbench" />
        </div>

        <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
            <div ref={dropdownRef}>
                <WorkbenchToolbar
                    activeTool={activeTool}
                    freehandColor={freehandColor}
                    freehandStrokeWidth={freehandStrokeWidth}
                    onSelectTool={onSelectTool}
                    onFreehandColorChange={onFreehandColorChange}
                    onFreehandStrokeWidthChange={onFreehandStrokeWidthChange}
                    onUndo={onUndo}
                    onRedo={onRedo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onMediaUpload={onMediaUpload}
                    onMediaUploadFromPhone={onMediaUploadFromPhone}
                    sketchFormats={sketchFormats}
                    onFormatSelect={onFormatSelect}
                />
            </div>
        </div>

        <div className="absolute bottom-4 right-4 z-20">
            <CanvasControls
                zoomLevel={zoomLevel}
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                onSetZoom={onSetZoom}
                onFitToScreen={onFitToScreen}
            />
        </div>

        {basicBlocksMenu?.visible && (
            <div
                className="fixed z-50"
                style={{
                    left: basicBlocksMenu.x,
                    top: basicBlocksMenu.y,
                    transform: 'translateY(-50%)',
                }}
            >
                <BasicBlocksMenu onSelect={onBlockSelect} onClose={() => {}} />
            </div>
        )}
    </>
);
