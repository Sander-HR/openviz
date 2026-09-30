# Dependency Preflight Contract

Before queueing, the adapter checks target capabilities and workflow dependencies. The result is one of:

- `ready`: all required dependencies and capabilities are present.
- `missing`: identifies model/custom-node names and install locations.
- `incompatible`: identifies the capability mismatch, such as insufficient VRAM, unsupported precision, resolution, or video support.
- `degraded`: optional dependencies are missing and the workflow can run with reduced behavior.

The UI must show license links for restricted model families and must not silently substitute another checkpoint.
