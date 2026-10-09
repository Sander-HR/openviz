import { WorkbenchNode } from '../types';

interface PositioningParams {
    startX: number;
    startY: number;
    nodeWidth: number;
    nodeHeight: number;
    existingNodes: WorkbenchNode[];
    columns?: number;
    gap?: number;
    margin?: number;
}

interface Position {
    x: number;
    y: number;
}

/**
 * Finds a non-overlapping position for a new node using a grid-based algorithm.
 * Iterates through grid positions starting from (startX, startY) until a free spot is found.
 */
export function findNonOverlappingPosition({
    startX,
    startY,
    nodeWidth,
    nodeHeight,
    existingNodes,
    columns = 4,
    gap = 20,
    margin = 20
}: PositioningParams): Position {
    // Safety check to prevent infinite loops if dimensions are 0
    const safeWidth = Math.max(nodeWidth, 50);
    const safeHeight = Math.max(nodeHeight, 50);

    let slotIndex = 0;
    
    while (true) {
        const col = slotIndex % columns;
        const row = Math.floor(slotIndex / columns);
        
        const currentX = startX + (col * (safeWidth + gap));
        const currentY = startY + (row * (safeHeight + gap));

        // Check for overlap with existing nodes
        const isOverlapping = existingNodes.some(n => 
            currentX < n.x + (n.width ?? 0) + margin &&
            currentX + safeWidth + margin > n.x &&
            currentY < n.y + (n.height ?? 0) + margin &&
            currentY + safeHeight + margin > n.y
        );

        if (!isOverlapping) {
            return { x: currentX, y: currentY };
        }
        
        slotIndex++;
        
        // Prevent infinite loops if something goes wrong
        if (slotIndex > 1000) {
            return { x: startX + (slotIndex * 10), y: startY };
        }
    }
}
