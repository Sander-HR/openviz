import type { SceneData, ImageNode, RenderNode, Connection, Project } from "@/types";

export const DEFAULT_WORKSPACE_NAME = "Default Workspace";
export const DEFAULT_WORKSPACE_SLUG_PREFIX = "default";
export const DEFAULT_EXAMPLE_PROJECT_NAME = "Welcome to OpenViz";
export const DEFAULT_EXAMPLE_PROJECT_DESCRIPTION =
    "An example project with a starter graph to help you begin.";

const EXAMPLE_IMAGE_NODE_ID = "example-image-node";
const EXAMPLE_RENDER_NODE_ID = "example-render-node";

function createExampleImageProject(): Project {
    const now = Date.now();

    return {
        id: EXAMPLE_IMAGE_NODE_ID,
        name: "Starter Canvas",
        createdAt: now,
        lastModifiedAt: now,
        canvas: {
            width: 1024,
            height: 1024,
            aspectRatio: "square",
            zoomLevel: 1,
            panX: 0,
            panY: 0,
            backgroundColor: "#ffffff",
        },
        layers: [
            {
                id: "bg-layer",
                name: "Background",
                type: "sketch",
                visible: true,
                locked: false,
                opacity: 100,
                blendMode: "normal",
                strokes: [],
                order: 0,
                created: now,
                modified: now,
            },
            {
                id: "layer-1",
                name: "Layer 1",
                type: "sketch",
                visible: true,
                locked: false,
                opacity: 100,
                blendMode: "normal",
                strokes: [],
                order: 1,
                created: now,
                modified: now,
            },
        ],
    };
}

export function createExampleSceneData(): SceneData {
    const imageNode: ImageNode = {
        id: EXAMPLE_IMAGE_NODE_ID,
        type: "image",
        name: "Starter Canvas",
        x: 160,
        y: 180,
        width: 256,
        height: 256,
        scale: 0.25,
        project: createExampleImageProject(),
    };

    const renderNode: RenderNode = {
        id: EXAMPLE_RENDER_NODE_ID,
        type: "render",
        x: 520,
        y: 150,
        width: 320,
        height: 500,
        data: {
            prompt: "A photoreal product render with soft studio lighting",
            stylePreset: "Photorealistic",
            drawingInfluence: 0.65,
            numImages: 1,
        },
    };

    const connection: Connection = {
        id: "example-connection-1",
        from: EXAMPLE_IMAGE_NODE_ID,
        to: EXAMPLE_RENDER_NODE_ID,
        sourceHandle: "image-source",
        targetHandle: "render-target-visible",
    };

    return {
        nodes: [imageNode, renderNode],
        connections: [connection],
    };
}
