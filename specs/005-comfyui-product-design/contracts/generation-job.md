# Generation Job Contract

A job request contains:

- `workflowId` and `workflowVersion`
- `projectId`
- `executionTargetId` and selected/automatic `modelTier`
- prompt, negative prompt, seed, batch size, dimensions, and workflow parameters
- references and optional mask asset IDs

The service returns a job ID and emits/polls normalized states:

```text
queued → running → completed
                 ↘ partial
                 ↘ failed
queued/running → cancelled
```

Inputs are retained for retry. Outputs include asset ID, dimensions, content type, source job ID, and index within the batch. Partial completion is not treated as total failure.
