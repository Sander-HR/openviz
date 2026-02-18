import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './useStore';
import { Connection } from '../types';

describe('workbenchStore connections', () => {
    beforeEach(() => {
        // Clear store before each test
        const state = useStore.getState();
        // Reset relevant fields
        state.connections = [];
        state.workbenchNodes = [];
    });

    it('should track inbound connections for a node', () => {
        const { addWorkbenchNode, addConnection } = useStore.getState();

        // 1. Setup Nodes
        const nodeA = { id: 'node-a', type: 'image', x: 0, y: 0 } as any;
        const nodeB = { id: 'node-b', type: 'image', x: 200, y: 0 } as any;
        const animateNode = { id: 'node-animate', type: 'animate', x: 400, y: 0 } as any;

        addWorkbenchNode(nodeA);
        addWorkbenchNode(nodeB);
        addWorkbenchNode(animateNode);

        // 2. Connect Node A -> Animate
        addConnection('node-a', 'node-animate');
        
        let state = useStore.getState();
        let animateInbound = state.connections.filter((c: Connection) => c.to === 'node-animate');
        expect(animateInbound.length).toBe(1);
        expect(animateInbound[0].from).toBe('node-a');

        // 3. Connect Node B -> Animate (Second frame)
        addConnection('node-b', 'node-animate');
        
        state = useStore.getState();
        animateInbound = state.connections.filter((c: Connection) => c.to === 'node-animate');
        expect(animateInbound.length).toBe(2);
        expect(animateInbound[1].from).toBe('node-b');
    });

    it('should remove specific connection when handleDisconnect is called', () => {
        const { addWorkbenchNode, addConnection, removeConnection } = useStore.getState();

        const nodeA = { id: 'node-a', type: 'image', x: 0, y: 0 } as any;
        const animateNode = { id: 'node-animate', type: 'animate', x: 400, y: 0 } as any;

        addWorkbenchNode(nodeA);
        addWorkbenchNode(animateNode);
        addConnection('node-a', 'node-animate');

        let state = useStore.getState();
        const connectionId = state.connections[0].id;
        
        // Remove the connection
        removeConnection(connectionId);
        
        state = useStore.getState();
        expect(state.connections.length).toBe(0);
    });
});
