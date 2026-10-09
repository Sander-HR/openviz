type RetryAction = () => void;

const retryActions = new Map<string, RetryAction>();

export function registerGenerationRetry(nodeId: string, action: RetryAction): void {
    retryActions.set(nodeId, action);
}

export function getGenerationRetry(nodeId: string): RetryAction | undefined {
    return retryActions.get(nodeId);
}

export function unregisterGenerationRetry(nodeId: string): void {
    retryActions.delete(nodeId);
}