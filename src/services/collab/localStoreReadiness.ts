export const DEFAULT_LOCAL_STORE_TIMEOUT_MS = 5_000;

export function waitForLocalDocumentReadiness(
    readiness: Promise<void> | undefined,
    timeoutMs = DEFAULT_LOCAL_STORE_TIMEOUT_MS,
): Promise<void> {
    if (!readiness) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Local document restore timed out')), timeoutMs);
        readiness.then(
            () => {
                clearTimeout(timeout);
                resolve();
            },
            (error: unknown) => {
                clearTimeout(timeout);
                reject(error);
            },
        );
    });
}
