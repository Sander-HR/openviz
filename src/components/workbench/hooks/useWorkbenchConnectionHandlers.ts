import { useCallback, useRef } from 'react';
import {
    Connection,
    OnConnect,
    OnConnectEnd,
    OnConnectStart,
} from '@xyflow/react';

import type { Connection as WorkbenchConnection, WorkbenchNode } from '@/types';
import type { SceneConnectionJson } from '@/types/collab.types';
import type { SceneDocCommands } from '@/services/collab/sceneDocCommands';
import { addConnectionWithPolicy } from '@/services/workbench/connectionPolicy';

import { requestImmediateSceneSave } from '@/services/workbench/sceneSyncBus';
import {
    ConnectionStartRef,
    getCanonicalConnectionFromDrop,
} from './workbenchConnectionLogic';

type UseWorkbenchConnectionHandlersOptions = {
    workbenchNodes: WorkbenchNode[];
    connections: WorkbenchConnection[];
    commands?: SceneDocCommands | null;
    removeConnectionFromStore: (id: string) => void;
    addConnection: (
        fromId: string,
        toId: string,
        sourceHandle?: string | null,
        targetHandle?: string | null
    ) => void;
};

export function useWorkbenchConnectionHandlers({
    workbenchNodes,
    connections,
    commands,
    removeConnectionFromStore,
    addConnection,
}: UseWorkbenchConnectionHandlersOptions) {
    const applyConnection = useCallback((fromId: string, toId: string, sourceHandle?: string | null, targetHandle?: string | null) => {
        if (!commands) {
            addConnection(fromId, toId, sourceHandle, targetHandle);
            return;
        }
        const next = addConnectionWithPolicy(connections, workbenchNodes, fromId, toId, sourceHandle, targetHandle);
        const currentIds = new Set(connections.map(({ id }) => id));
        const nextIds = new Set(next.map(({ id }) => id));
        const created = next.find(({ id }) => !currentIds.has(id));
        const documentConnection: SceneConnectionJson | null = created
            ? {
                  id: created.id,
                  from: created.from,
                  to: created.to,
                  sourceHandle: created.sourceHandle ?? null,
                  targetHandle: created.targetHandle ?? null,
              }
            : null;
        const deleted = connections.filter(({ id }) => !nextIds.has(id)).map(({ id }) => id);
        if (documentConnection || deleted.length > 0) commands.applyConnectionChanges(documentConnection, deleted);
    }, [addConnection, commands, connections, workbenchNodes]);

    const removeConnection = useCallback((id: string) => {
        if (commands) commands.applyConnectionChanges(null, [id]);
        else {
            removeConnectionFromStore(id);
            requestImmediateSceneSave();
        }
    }, [commands, removeConnectionFromStore]);
    const connectionStart = useRef<ConnectionStartRef>(null);

    const logEdgeDebug = useCallback((event: string, payload: Record<string, unknown>) => {
        if (process.env.NODE_ENV === 'production') {
            return;
        }
        console.log(`[WorkbenchEdge] ${event}`, payload);
    }, []);

    const handleConnect: OnConnect = useCallback((params: Connection) => {
        logEdgeDebug('onConnect.received', {
            source: params.source,
            sourceHandle: params.sourceHandle ?? null,
            target: params.target,
            targetHandle: params.targetHandle ?? null,
        });

        if (params.source && params.target) {
            logEdgeDebug('onConnect.addConnection', {
                fromId: params.source,
                toId: params.target,
                sourceHandle: params.sourceHandle ?? null,
                targetHandle: params.targetHandle ?? null,
            });
            applyConnection(
                params.source,
                params.target,
                params.sourceHandle ?? null,
                params.targetHandle ?? null,
            );
            if (!commands) requestImmediateSceneSave();
        } else {
            logEdgeDebug('onConnect.ignored', {
                reason: 'missing source or target',
                source: params.source,
                target: params.target,
            });
        }
    }, [applyConnection, commands, logEdgeDebug]);

    const onConnectStart: OnConnectStart = useCallback((_, { nodeId, handleType }) => {
        if (!nodeId || !handleType) {
            logEdgeDebug('onConnectStart.ignored', { nodeId: nodeId ?? null, handleType: handleType ?? null });
            return;
        }
        connectionStart.current = { nodeId, handleType };
        logEdgeDebug('onConnectStart.recorded', { nodeId, handleType });
    }, [logEdgeDebug]);

    const onConnectEnd: OnConnectEnd = useCallback((event) => {
        if (!connectionStart.current) {
            logEdgeDebug('onConnectEnd.ignored', { reason: 'missing connection start' });
            return;
        }

        const target = event.target;
        if (!(target instanceof Element)) {
            logEdgeDebug('onConnectEnd.ignored', {
                reason: 'event target is not an Element',
                connectionStart: connectionStart.current,
            });
            connectionStart.current = null;
            return;
        }

        const nodeElement = target.closest('.react-flow__node');
        const targetNodeId = nodeElement?.getAttribute('data-id') ?? null;
        logEdgeDebug('onConnectEnd.targetResolved', {
            connectionStart: connectionStart.current,
            targetNodeId,
        });

        if (nodeElement) {
            const canonical = getCanonicalConnectionFromDrop(connectionStart.current, targetNodeId, workbenchNodes);
            if (canonical) {
                logEdgeDebug('onConnectEnd.addCanonicalConnection', canonical);
                applyConnection(
                    canonical.fromId,
                    canonical.toId,
                    canonical.sourceHandle ?? null,
                    canonical.targetHandle ?? null,
                );
                if (!commands) requestImmediateSceneSave();
            } else {
                logEdgeDebug('onConnectEnd.noCanonicalConnection', {
                    connectionStart: connectionStart.current,
                    targetNodeId,
                });
            }
        }

        connectionStart.current = null;
    }, [workbenchNodes, applyConnection, commands, logEdgeDebug]);

    return {
        createConnection: applyConnection,
        handleConnect,
        removeConnection,
        onConnectStart,
        onConnectEnd,
    };
}
