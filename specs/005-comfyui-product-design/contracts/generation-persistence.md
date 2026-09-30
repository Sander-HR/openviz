# Generation Persistence Contract

Every generation request must be recoverable and attributable to its source reference.

## Persisted job data

- project ID and user ID
- workflow ID/version and model family/tier
- execution target ID and capability decision
- prompt, negative prompt, seed, dimensions, aspect ratio, batch parameters
- reference asset IDs, annotation/mask asset IDs, and variant-set ID
- dependency snapshot and license metadata
- status, progress, terminal error, retry linkage, timestamps
- output asset IDs, output index, dimensions, content type, and source job ID

## Lifecycle

A job is created before queue submission, so failed preflight and submission errors retain inputs. Terminal states are `completed`, `partial`, `failed`, and `cancelled`. Retrying creates a new job linked to the original rather than mutating history.

## Persistence implementation

Reuse the existing generation/project asset persistence when it supports these fields. Otherwise add a generated Drizzle migration and typed service/API boundary; do not store durable lineage only in Zustand or browser memory.
