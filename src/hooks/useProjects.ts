import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Project } from "@/lib/schemas/base";
import { useWorkspace } from "@/context/WorkspaceContext";

export function useProjects() {
    const queryClient = useQueryClient();
    const { currentWorkspace } = useWorkspace();

    const projectsQuery = useQuery<Project[]>({
        queryKey: ["projects", currentWorkspace?.id],
        queryFn: async () => {
            if (!currentWorkspace?.id) return [];
            const res = await fetch(`/api/projects?workspaceId=${currentWorkspace.id}`);
            if (!res.ok) throw new Error("Failed to fetch projects");
            return res.json();
        },
        enabled: !!currentWorkspace?.id,
    });

    const createProjectMutation = useMutation({
        mutationFn: async (newProject: Partial<Project>) => {
            const projectWithWorkspace = {
                ...newProject,
                workspaceId: currentWorkspace?.id,
            };
            const res = await fetch("/api/projects", {
                method: "POST",
                body: JSON.stringify(projectWithWorkspace),
            });
            if (!res.ok) throw new Error("Failed to create project");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects", currentWorkspace?.id] });
        },
    });

    const updateProjectMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Project> }) => {
            // We need a PATCH endpoint for this, assuming one exists or we create it.
            // For now, I'll assume PUT/PATCH on /api/projects/[id]
            const res = await fetch(`/api/projects/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to update project");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects", currentWorkspace?.id] });
        },
    });

    const deleteProjectMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/projects/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete project");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects", currentWorkspace?.id] });
        },
    });

    return {
        projects: projectsQuery.data ?? [],
        isLoading: projectsQuery.isLoading,
        error: projectsQuery.error,
        createProject: createProjectMutation.mutate,
        isCreating: createProjectMutation.isPending,
        updateProject: updateProjectMutation.mutate,
        deleteProject: deleteProjectMutation.mutate,
    };
}
