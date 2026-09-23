import { describe, expect, it } from "vitest";

import { createExampleSceneData } from "./bootstrapTemplates";

describe("bootstrapTemplates", () => {
    it("creates a usable example scene graph", () => {
        const scene = createExampleSceneData();

        expect(scene.nodes.length).toBe(2);
        expect(scene.connections.length).toBe(1);

        const imageNode = scene.nodes.find((node) => node.type === "image");
        const renderNode = scene.nodes.find((node) => node.type === "render");

        expect(imageNode).toBeDefined();
        expect(renderNode).toBeDefined();

        if (!imageNode || !renderNode) return;

        expect(scene.connections[0].from).toBe(imageNode.id);
        expect(scene.connections[0].to).toBe(renderNode.id);
    });
});
