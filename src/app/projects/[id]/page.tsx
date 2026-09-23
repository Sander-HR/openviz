import { redirect } from "next/navigation";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    // Studio is the default view; workbench lives at /projects/[id]/workbench.
    redirect(`/projects/${id}/studio`);
}
