## Plan: Instant Workbench-to-Studio Transition

Implement a coordinated route transition for studio-capable workbench nodes. On image/media double-click, zoom React Flow toward the node, slide workbench chrome away, warm the selected project assets, reveal an already-mounted or readying Studio surface, then navigate after the handoff so Konva opens focused on the selected node while Studio chrome slides in. Preserve route-as-source-of-truth and existing media behavior.

An image node already owns a `Project`: the switch should reuse that project and its layer data rather than fetch a second project by node id. Workbench normally renders `project.thumbnail`; Studio renders `project.layers[].image` plus editable strokes/transforms. The transition must therefore distinguish project readiness from browser image/decode readiness and use a temporary visual handoff surface when the DOM image and Konva scene are not yet identical.

**Steps**
1. **Discovery and transition contract**
   - Define a transition state/action in the shared Zustand layer or a dedicated transition hook: idle, entering-studio, exiting-studio; selected node/project id; duplicate-invocation guard.
   - Keep URL navigation authoritative; do not rely on `setViewMode` alone to replace the rendered view.
   - Add typed transition callbacks for workbench zoom completion, route navigation, and Studio-ready/focus completion.

2. **Workbench handoff**
   - Extend the existing `handleNodeDoubleClick` path in `src/components/workbench/hooks/useWorkbenchNodeHandlers.ts` (which already gates remote locks and handles `image`/`media`) so it delegates to a transition-aware `openNodeInStudio` flow rather than navigating immediately.
   - In `src/components/workbench/workbench.tsx` / a new nearby hook, calculate the selected React Flow node bounds and animate `setCenter`/viewport zoom toward its center with a short, fixed duration and capped target zoom.
   - During the same transition state, animate `WorkbenchChrome` and related workbench overlays out using Framer Motion; keep pointer input disabled and ignore a second double-click.
   - Ensure the existing `openNodeInStudio(id)` store action remains responsible for selecting/restoring the node project, but delay route navigation until the visual handoff has completed.

3. **Shared route transition, asset readiness, and keep-alive surfaces**
   - Add a transition boundary/coordinator around the mode switch in `src/app/projects/[id]/ProjectWorkspace.tsx` or a dedicated component/hook. It should coordinate workbench exit, project/focus preparation, critical asset readiness, route navigation, and Studio entrance without changing the URL before the requested animation completes.
   - Treat the hydrated `imageNode.project` as the project source. Do not add a node-id asset fetch during the switch. The existing project scene fetch already supplies the node and its project; `openNodeInStudio` should install that project synchronously in Zustand.
   - Preload the dynamic Studio module during Workbench idle time (or when the node becomes a transition candidate) so the route change does not wait on a cold dynamic import. Preserve SSR-disabled behavior.
   - Add a typed critical-asset preloader/readiness registry for the selected project: deduplicate visible `layer.image` URLs, preload/decode them, and report readiness by node/project id. Data URLs are immediately available; remote URLs may use the browser cache. Preload the node thumbnail or a transition snapshot separately for the visual handoff. Do not block the transition on secondary render-history or panel-only assets.
   - Keep Workbench and Studio surfaces mounted in a persistent workspace shell after hydration, preferably mounting Studio in the background during idle time. Use full-screen stacked layers rather than `display: none`, so React Flow viewport state, Konva stage state, panel state, and loaded images survive a mode switch. The inactive surface must be visually hidden, pointer-inert, and `aria-hidden` without receiving shortcuts or starting duplicate side effects.
   - Thread an explicit active/inactive signal through Workbench, Studio, shortcut hooks, resize/fit effects, collaboration effects, and save/navigation handlers. Keeping both trees mounted must not create duplicate global listeners, collaboration sessions, saves, or navigation.
   - Use `AnimatePresence`/motion only at the shared chrome/transition boundary if needed; avoid duplicating independent timers in Workbench and Studio. The workbench and studio chrome should have aligned ~300–400 ms durations and opposing directions.
   - Keep the route path `/projects/:id/studio` as the final source of truth; ensure the transition does not leave Zustand in a stale `STUDIO` state if navigation is interrupted.

4. **Instant Konva focus and asset-backed visual handoff**
   - Extend `openNodeInStudio`/Studio initialization with a typed focus intent for the selected image/media node, rather than relying only on existing center-on-return behavior. Include the selected node id, project id, source drawable bounds, and a transition generation/abort token.
   - In `src/components/Studio.tsx`, `src/components/studio/CanvasViewport.tsx`, and/or a focused new Studio hook, consume that intent after the Konva Stage and critical layer images are ready, fit the selected project canvas immediately, and clear the intent after focus is applied.
   - Reuse existing `fitToScreen`/canvas transform conventions and avoid new global `window as any` bridges. If the node project already contains the desired canvas transform, preserve it; otherwise apply the selected-node focus only on entry.
   - Implement a temporary typed transition overlay because Workbench's DOM thumbnail and Studio's Konva scene are different render trees. Animate the node's drawable-canvas rectangle to the Studio drawing-board rectangle, using the thumbnail or a fresh raster snapshot as the source, then crossfade to the live editable Konva canvas only after critical images are decoded. The overlay must not include node chrome, handles, or the surrounding viewport.
   - Keep Studio toolbar/panel state mounted behind the transition where practical, then animate from hidden/offscreen to visible when the canvas is ready. Avoid rendering a blank flash or treating component mount alone as Studio readiness.
   - Preserve remote-image exportability: Studio currently loads layer images with `useImage(src, "anonymous")`; verify asset responses provide compatible CORS headers so thumbnail capture, transition snapshots, and `toDataURL()` continue to work.

5. **Studio-to-Workbench symmetry and regression fix**
   - Refactor `useCanvasViewport`/`CanvasViewport` exit handling into a dedicated transition hook so the existing Konva zoom-out, thumbnail save, `setExitingStudio`, and `router.push('/workbench')` are sequenced consistently.
   - Fix the current known defect where `handleExitStudio()` changes Zustand mode but does not navigate the URL, leaving Studio mounted because `ProjectWorkspace` treats the URL as authoritative.
   - Preserve background double-click exit semantics, object double-click semantics, save-before-navigation behavior, and current toolbar actions.

6. **Tests and verification**
   - Add unit tests for the transition coordinator/hook: one invocation only, remote lock rejection, image/media acceptance, viewport zoom target, delayed navigation, interruption cleanup, and route/store consistency.
   - Add unit tests for the critical asset preloader: data URLs require no network, duplicate URLs are decoded once, remote assets resolve from the browser cache when available, stale transition generations are ignored, and secondary assets do not block the handoff.
   - Add interaction tests for `CanvasViewport`: stage/background double-click invokes exit; object/layer double-click does not; route navigation occurs after the animation/save sequence; critical Konva images are ready before the live-canvas crossfade.
   - Add `ProjectWorkspace`/integration coverage that URL mode controls the active surface, both mode surfaces remain mounted after warm-up, inactive surfaces do not handle input or register duplicate effects, and dynamic Studio readiness does not block or reset the selected project.
   - Add visual/geometry coverage for exact drawable-canvas corner mapping, aspect-ratio preservation, stale-thumbnail fallback to a raster snapshot, and media assets with non-default dimensions.
   - Run `pnpm exec tsc --noEmit`, `pnpm run lint`, targeted Vitest tests, and `pnpm test`/`pnpm run test:ci` as appropriate. Manually verify cold-load and warm-load transitions, reduced-motion behavior, locked remote nodes, image and media nodes, browser back/forward, data-URL and remote assets, CORS-safe rasterization, browser cache hits, and slow-network dynamic import/image behavior.

**Relevant files**
- `/Users/FuturiaWorks/dev/openviz/src/components/workbench/hooks/useWorkbenchNodeHandlers.ts` — existing image/media double-click and remote-lock gate.
- `/Users/FuturiaWorks/dev/openviz/src/components/workbench/hooks/useWorkbench.ts` — current `openNodeInStudioAndNavigate` flow and store/router boundary.
- `/Users/FuturiaWorks/dev/openviz/src/components/workbench/workbench.tsx` — React Flow viewport APIs, `WorkbenchChrome` mount, node double-click wiring, and transition overlay insertion point.
- `/Users/FuturiaWorks/dev/openviz/src/components/workbench/WorkbenchChrome.tsx` — workbench chrome composition to animate as one unit.
- `/Users/FuturiaWorks/dev/openviz/src/components/Studio.tsx` — Studio chrome motion variants and CanvasViewport mount.
- `/Users/FuturiaWorks/dev/openviz/src/components/studio/hooks/useStudioTransitions.ts` — existing motion vocabulary/durations to reuse and extend.
- `/Users/FuturiaWorks/dev/openviz/src/components/studio/CanvasViewport.tsx` — Konva stage readiness and background double-click detection.
- `/Users/FuturiaWorks/dev/openviz/src/components/hooks/useCanvasViewport.ts` — current Konva transforms, thumbnail capture, and flawed exit sequence.
- `/Users/FuturiaWorks/dev/openviz/src/app/projects/[id]/ProjectWorkspace.tsx` — URL-authoritative mode rendering and dynamic imports; shared transition boundary/preload location.
- `/Users/FuturiaWorks/dev/openviz/src/store/slices/workbenchSlice.ts` and `/Users/FuturiaWorks/dev/openviz/src/store/useStore.ts` — mode, selected node, project restoration, and transition/focus intent state.
- `/Users/FuturiaWorks/dev/openviz/src/components/workbench/hooks/useWorkbenchCenterOnReturn.ts` — existing node-centering-on-return behavior to reconcile with the new focus intent.
- `/Users/FuturiaWorks/dev/openviz/src/components/workbench/hooks/useWorkbenchNodeHandlers.test.ts` — existing double-click and remote-lock test patterns.

**Verification**
1. Run typecheck first: `pnpm exec tsc --noEmit`.
2. Run targeted transition, Workbench node-handler, CanvasViewport, and ProjectWorkspace tests.
3. Run `pnpm run lint` and the full Vitest suite; use `pnpm run test:ci` for the CI-equivalent check.
4. Manually measure the sequence: double-click image/media -> node zooms -> Workbench chrome slides out -> URL changes -> Konva canvas is visible/focused -> Studio chrome slides in, with no blank frame or duplicate navigation.
5. Verify Studio background double-click reverses the sequence and actually reaches `/workbench`; test warm/cold dynamic imports, browser navigation, remote locks, reduced motion, and slow network.

**Decisions**
- Apply to both `image` and existing `media` nodes.
- Use both effects: a Workbench zoom handoff and a focused Studio canvas.
- The node's drawable canvas defines the Studio drawing-board bounds; the viewport is not treated as the canvas.
- The node canvas and Studio canvas must preserve exactly the same 1:1 dimensions/aspect ratio, with no stretching or independent fit-to-viewport scaling.
- The transition target is an exact node-to-canvas mapping: the node's four drawable-canvas corners become the Studio canvas's four drawing-board corners.
- Use the image node's embedded `Project` and layer asset references; do not fetch a second project by node id during the switch.
- Critical visible layer images must be warmed and decoded before the live Konva canvas replaces the transition overlay. Thumbnail/render-history assets may remain lazy.
- Keep Workbench and Studio mounted in a shared keep-alive shell after hydration, with the inactive surface frozen and input-inert.
- Delay URL navigation until the handoff animation completes.
- Use a shared transition coordinator/layer rather than independent route-local animations.
- Preserve exact canvas aspect ratio and use CORS-compatible image loading for rasterization/export.
- Keep scope limited to studio/workbench transition performance, asset readiness, and focus; do not redesign node rendering, persistence, or unrelated toolbar behavior.

**Further Considerations**
1. The implementation should choose a single owner for navigation and transition cleanup; recommendation: a dedicated transition hook/coordinator, with node handlers remaining pure event gates.
2. `CanvasViewport` and `useCanvasViewport` currently contain broad responsibilities and `any` usage; isolate new transition logic in small typed hooks rather than expanding those files.
3. The current Workbench preview uses `project.thumbnail`, while Studio uses `layer.image`; do not assume they are pixel-identical. Prefer a fresh project snapshot for the handoff when the thumbnail is stale or missing.
4. Local desktop uploads are stored as data URLs and remote/phone uploads as URLs. Confirm the chosen persistence path is durable across reloads; object URLs or transient browser-only references must not be used as the only source for a persisted image node.
5. The current media materialization path uses a default `1024x768` canvas. Derive canvas dimensions from the source asset or preserve an explicit aspect ratio before enforcing exact node-to-canvas corner mapping.
6. Persistent mounting improves warm-switch latency but increases memory and background work. Add explicit active-state gates before enabling the keep-alive shell in production.
