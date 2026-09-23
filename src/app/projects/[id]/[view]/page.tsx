import { notFound } from "next/navigation";
import { ProjectWorkspace } from "../ProjectWorkspace";

/**
 * Single route handling both project views: /projects/[id]/studio and
 * /projects/[id]/workbench. Adding a future view (e.g. "present") only
 * requires a new key here plus the matching workspace mode.
 */
const VIEW_MODES = {
    studio: "STUDIO",
    workbench: "WORKBENCH",
} as const;

type ViewSegment = keyof typeof VIEW_MODES;

function isViewSegment(value: string): value is ViewSegment {
    return value in VIEW_MODES;
}

export default async function ProjectViewPage({ params }: { params: Promise<{ id: string; view: string }> }) {
    const { id, view } = await params;

    if (!isViewSegment(view)) {
        // Unknown view segment (e.g. /projects/[id]/foo) → 404
        notFound();
    }

    return <ProjectWorkspace id={id} mode={VIEW_MODES[view]} />;
}
