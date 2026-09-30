import type { PreflightResult, TargetCapabilities } from '@/types/executionTarget.types';
import { getProductWorkflow } from './productWorkflowRegistry';

function hasDependency(capabilities: TargetCapabilities, name: string): boolean {
    const normalizedName = name.toLowerCase();
    return capabilities.availableModels.some((model) => model.toLowerCase().includes(normalizedName)) ||
        capabilities.availableNodeTypes.some((node) => node.toLowerCase().includes(normalizedName)) ||
        capabilities.customNodes.some((node) => node.toLowerCase().includes(normalizedName));
}

export function runDependencyPreflight(
    workflowId: string,
    capabilities: TargetCapabilities
): PreflightResult {
    const workflow = getProductWorkflow(workflowId);
    if (!workflow) {
        return {
            ready: false,
            status: 'incompatible',
            issues: [{ code: 'unknown-workflow', message: `Unknown product workflow: ${workflowId}.` }],
        };
    }

    const issues = workflow.dependencies
        .filter((dependency) => dependency.required && !hasDependency(capabilities, dependency.name))
        .map((dependency) => ({
            code: 'missing-dependency',
            message: `Missing required ${dependency.kind}: ${dependency.name}.`,
            dependency: dependency.name,
            licenseUrl: dependency.licenseUrl,
        }));

    const licenseIssues = workflow.dependencies
        .filter((dependency) => dependency.licenseUrl)
        .map((dependency) => ({
            code: 'license-review',
            message: `Review the license for ${dependency.name} before commercial use.`,
            dependency: dependency.name,
            licenseUrl: dependency.licenseUrl,
        }));

    const allIssues = [...issues, ...licenseIssues];
    return {
        ready: issues.length === 0,
        status: issues.length > 0 ? 'missing' : licenseIssues.length > 0 ? 'degraded' : 'ready',
        issues: allIssues,
        explanation: issues.length === 0
            ? 'All required workflow dependencies are available.'
            : 'Install the missing dependencies before queueing this workflow.',
    };
}
