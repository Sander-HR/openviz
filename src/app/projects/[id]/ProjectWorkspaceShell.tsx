"use client";

import { usePathname } from "next/navigation";
import { ProjectWorkspace } from "./ProjectWorkspace";

export function ProjectWorkspaceShell({ id }: { id: string }) {
    const pathname = usePathname();
    const activeView = pathname.endsWith("/workbench") ? "WORKBENCH" : "STUDIO";

    return <ProjectWorkspace id={id} activeView={activeView} />;
}