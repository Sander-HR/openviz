import { useCallback, useRef } from 'react';
import {
    Connection,
    OnConnect,
    OnConnectEnd,
    OnConnectStart,
} from '@xyflow/react';

import { WorkbenchNode } from '@/types';

import { requestImmediateSceneSave } from '@/services/workbench/sceneSyncBus';
import {
    ConnectionStartRef,
    getCanonicalConnectionFromDrop,
} from './workbenchConnectionLogic';

type UseWorkbenchConnectionHandlersOptions = {
    workbenchNodes: WorkbenchNode[];
    addConnection: (
        fromId: string,
        toId: string,
        sourceHandle?: string | null,
        targetHandle?: string | null
    ) => void;
};

export function useWorkbenchConnectionHandlers({
    workbenchNodes,
    addConnection,
}: UseWorkbenchConnectionHandlersOptions) {
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
            addConnection(
                params.source,
                params.target,
                params.sourceHandle ?? null,
                params.targetHandle ?? null
            );
            // Connection was just dropped (mouse released) - sync immediately.
            requestImmediateSceneSave();
        } else {
            logEdgeDebug('onConnect.ignored', {
                reason: 'missing source or target',
                source: params.source,
                target: params.target,
            });
        }
    }, [addConnection, logEdgeDebug]);

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
                addConnection(
                    canonical.fromId,
                    canonical.toId,
                    canonical.sourceHandle ?? null,
                    canonical.targetHandle ?? null
                );
                // Reverse-drag connection was just dropped (mouse released) - sync immediately.
                requestImmediateSceneSave();
            } else {
                logEdgeDebug('onConnectEnd.noCanonicalConnection', {
                    connectionStart: connectionStart.current,
                    targetNodeId,
                });
            }
        }

        connectionStart.current = null;
    }, [workbenchNodes, addConnection, logEdgeDebug]);

    return {
        handleConnect,
        onConnectStart,
        onConnectEnd,
    };
}
