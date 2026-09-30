import type { ExecutionTarget, ExecutionTargetAdapter, TargetCapabilities } from '@/types/executionTarget.types';

export interface TargetSettingsRepository {
    list: () => Promise<ExecutionTarget[]>;
    get: (id: string) => Promise<ExecutionTarget | undefined>;
    save: (target: ExecutionTarget) => Promise<ExecutionTarget>;
    update: (id: string, updates: Partial<ExecutionTarget>) => Promise<void>;
}

export interface TargetSettingsServiceOptions {
    repository: TargetSettingsRepository;
    adapterFactory: (target: ExecutionTarget) => ExecutionTargetAdapter;
}

export interface TargetSettingsService {
    listTargets: () => Promise<ExecutionTarget[]>;
    saveTarget: (target: ExecutionTarget) => Promise<ExecutionTarget>;
    testConnection: (targetId: string) => Promise<ExecutionTarget>;
    refreshCapabilities: (targetId: string) => Promise<TargetCapabilities>;
}

function validateEndpoint(endpoint: string): string {
    const value = endpoint.trim();
    if (value.startsWith('/')) return value.replace(/\/$/, '') || '/';
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error('Target endpoint must be an HTTP URL or an application-relative path.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Target endpoint must use HTTP or HTTPS.');
    if (parsed.username || parsed.password) throw new Error('Target endpoint cannot contain credentials.');
    return parsed.toString().replace(/\/$/, '');
}

async function requireTarget(repository: TargetSettingsRepository, targetId: string): Promise<ExecutionTarget> {
    const target = await repository.get(targetId);
    if (!target) throw new Error(`Execution target ${targetId} was not found.`);
    return target;
}

export function createTargetSettingsService(options: TargetSettingsServiceOptions): TargetSettingsService {
    return {
        listTargets: () => options.repository.list(),
        async saveTarget(target) {
            const endpoint = validateEndpoint(target.endpoint);
            return options.repository.save({
                ...target,
                endpoint,
                status: target.status ?? 'unknown',
                authState: target.authState ?? 'unknown',
                capabilities: target.capabilities ?? null,
            });
        },
        async testConnection(targetId) {
            const target = await requireTarget(options.repository, targetId);
            const health = await options.adapterFactory(target).health();
            const authState = health.status === 'auth-required' ? 'missing' : target.authState;
            await options.repository.update(targetId, { status: health.status, capabilities: health.capabilities, authState });
            return (await options.repository.get(targetId)) ?? { ...target, status: health.status, capabilities: health.capabilities, authState };
        },
        async refreshCapabilities(targetId) {
            const target = await requireTarget(options.repository, targetId);
            const capabilities = await options.adapterFactory(target).capabilities();
            await options.repository.update(targetId, { capabilities, status: 'ready' });
            return capabilities;
        },
    };
}

export { validateEndpoint };
