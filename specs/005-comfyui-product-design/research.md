# Research: ComfyUI Product Design Workflows

## Decision 1: Use task-oriented workflows instead of style presets

**Decision**: Model workflows as `product_concept`, `product_edit`, `material_study`, `sketch_to_render`, `product_background`, and `product_animation`.

**Rationale**: Product design is an iterative process. Reference preservation, masks, structure strength, and output lineage matter more than a generic style label. Existing OpenViz presets are mostly duplicate SD3.5/Canny graphs and do not express these task contracts.

**Alternatives considered**: Keep the existing style registry and add more checkpoints; rejected because it hides inputs, preservation behavior, and dependencies from the user and makes workflow-specific validation difficult.

## Decision 2: Prioritize Qwen Image 2.1 and Qwen Image Edit 2511

**Decision**: Qwen Image 2.1 is the default concept model; Qwen Image Edit 2511 is the default reference-edit model. Use official Comfy-Org repackaged files and official workflow templates as the baseline.

**Rationale**: Live Hugging Face listings show active ComfyUI repackaged repositories with FP8, mixed-precision, and lower-memory variants. Qwen Image Edit provides official material-replacement, multiple-angle, relight, and inpainting-oriented workflow examples that map directly to product-design interactions.

**Sources**:
- https://huggingface.co/Comfy-Org/Qwen-Image-2.1
- https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI
- https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI
- https://github.com/Comfy-Org/workflow_templates

**Alternatives considered**: SD3.5 Large; rejected as the default because the repository's current product graph already uses it and its generic Canny graph does not provide the strongest current reference-editing path. SDXL/SD1.5 Civitai product checkpoints remain optional legacy/style resources.

## Decision 3: Add FLUX.1 Kontext-dev as an alternative editing engine

**Decision**: Support FLUX Kontext-dev behind the same product-edit contract, with license metadata surfaced in dependency details.

**Rationale**: Kontext is designed for instruction-based image editing and is a useful alternative when identity-preserving edits perform better than Qwen on a particular reference. The Comfy-Org repackaged repository provides an official basic edit workflow.

**Sources**:
- https://huggingface.co/Comfy-Org/flux1-kontext-dev_ComfyUI
- https://docs.comfy.org/tutorials/flux/flux-1-kontext-dev

**Alternatives considered**: FLUX.1 Dev plus separate ControlNet/IP-Adapter composition; rejected as the first edit path because it requires more graph-specific controls and is less direct for instruction editing. Kontext-dev's non-commercial license must not be hidden.

## Decision 4: Support Wan 2.2 for product animation

**Decision**: Generate a still hero/reference image first, then pass it to a Wan 2.2 image-to-video workflow for turntables and camera motion.

**Rationale**: Separating still design from motion reduces product identity drift and matches the user's product-design workflow. Official ComfyUI repackaged Wan 2.2 artifacts and quantized variants are available.

**Sources**:
- https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI
- https://huggingface.co/QuantStack/Wan2.2-I2V-A14B-GGUF

**Alternatives considered**: Continue the existing Wan wrapper JSON without a product-specific contract; rejected because it does not expose source-image lineage, motion parameters, or hardware capability requirements clearly.

## Decision 5: Use Civitai for optional LoRAs/workflows, not primary checkpoints

**Decision**: Permit validated optional LoRAs and workflow imports from Civitai. Start with Flux Product Design v3.0 IC_CONSIS, Flux 3D Product Design Prototype, Flux Industrial Design for Electronic Products, Real Scenes FLUX, and Flux Fill/Redux product background workflows.

**Rationale**: Civitai search results are useful for domain-specific adapters, but quality and licenses vary. Current product-design results include many older SD1.5/SDXL assets, so they should be optional and base-model-compatible rather than hard dependencies.

**Sources**:
- https://civitai.com/models/933026
- https://civitai.com/models/890993
- https://civitai.com/models/708410
- https://civitai.com/models/706090
- https://civitai.com/models/985126

**Alternatives considered**: Make a Civitai checkpoint the default; rejected because download popularity does not guarantee current quality, compatibility, or commercial licensing.

## Decision 6: Abstract execution targets and select model tiers by capabilities

**Decision**: Define a typed execution-target adapter with local, hosted, and hybrid implementations. Select a compatible workflow tier using capabilities (VRAM, precision, model family, resolution, video support), not hard-coded machine names.

**Rationale**: The user requires all three execution options and hardware-agnostic behavior. Local ComfyUI remains the canonical workflow protocol; hosted targets can expose a ComfyUI-compatible endpoint through the same adapter.

**Tier policy**:
- 12–16 GB: FP8/quantized image workflows; small/quantized video where available.
- 24 GB: FP8 image workflows and some larger workflows with offloading.
- 48 GB+: BF16 and larger video workflows where supported.
- Unknown capability: require configured profile or prefer hosted target; never silently submit a known-incompatible graph.

**Alternatives considered**: Provider-specific APIs in UI components; rejected because it violates service boundaries and makes workflow portability poor. Always use cloud; rejected because local execution is required.

## Decision 7: Use dependency manifests and preflight validation

**Decision**: Each workflow carries a typed dependency manifest and the execution adapter performs a `/object_info`/capability preflight before queueing.

**Rationale**: ComfyUI JSON often fails late when a checkpoint, custom node, or text encoder is missing. A preflight lets the UI give actionable installation guidance and prevents incompatible substitutions.

**Alternatives considered**: Let ComfyUI return errors after submission; rejected because it wastes queue time and creates confusing failures.

## Decision 8: Preserve generation lineage as first-class data

**Decision**: Store workflow ID/version, target, tier, prompt, references, masks, seed, parameters, outputs, and dependency snapshot for every job.

**Rationale**: Product iteration requires reproducibility and comparison. Existing image output alone is insufficient to understand why a variant differs.

**Alternatives considered**: Store only the final image URL; rejected because it prevents retry, comparison, and debugging.
