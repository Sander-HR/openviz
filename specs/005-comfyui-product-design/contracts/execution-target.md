# Execution Target Contract

```ts
interface ExecutionTargetAdapter {
  health(): Promise<TargetHealth>;
  capabilities(): Promise<TargetCapabilities>;
  preflight(request: GenerationRequest): Promise<PreflightResult>;
  submit(request: GenerationRequest): Promise<SubmittedJob>;
  getStatus(jobId: string): Promise<JobStatus>;
  cancel(jobId: string): Promise<void>;
  getOutputs(jobId: string): Promise<GenerationOutput[]>;
}
```

Adapters must normalize local ComfyUI, hosted ComfyUI-compatible endpoints, and hybrid routing into the same lifecycle. Authentication, endpoint URLs, and provider errors remain inside the adapter/service layer. Components consume hook/store state only.
