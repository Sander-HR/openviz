import React from "react";
import { ProjectWorkspaceShell } from "./ProjectWorkspaceShell";

export default async function ProjectLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}>) {
    const { id } = await params;

    return (
        <>
            <ProjectWorkspaceShell id={id} />
            {children}
        </>
    );
}