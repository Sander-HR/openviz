import { redirect } from "next/navigation";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    // Workbench is the default view; Studio remains available at /projects/[id]/studio.
    redirect(`/projects/${id}/workbench`);
}
