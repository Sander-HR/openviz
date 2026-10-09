/**
 * Shared dynamic imports for the two project views (Studio + Workbench).
 *
 * Both promises are created at module scope, so importing this module starts
 * downloading the view chunks immediately — whoever loads it first wins.
 * `ProjectWorkspace` builds its `next/dynamic` components from these same
 * promises (no duplicate chunk requests), and `AppAssetPreloader` calls
 * {@link preloadViewAssets} during browser idle time so the chunks are warm
 * before the user navigates into a project.
 */

export const studioModule = import("@/components/Studio");
export const workbenchModule = import("@/components/workbench/workbench");

/**
 * Reference both module promises so bundlers keep them and the underlying
 * chunks start loading as soon as this module is evaluated.
 */
export function preloadViewAssets(): void {
    void studioModule;
    void workbenchModule;
}
