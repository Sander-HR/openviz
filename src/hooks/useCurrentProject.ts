import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Project } from "@/lib/schemas/base";

export function useCurrentProject(projectId: string | null) {
    const queryClient = useQueryClient();

    const projectQuery = useQuery<Project>({
        queryKey: ["project", projectId],
        queryFn: async () => {
            if (!projectId) throw new Error("No project ID provided");
            const res = await fetch(`/api/projects/${projectId}`);
            if (!res.ok) throw new Error("Failed to fetch project");
            return res.json();
        },
        enabled: !!projectId,
    });

    const updateProjectMutation = useMutation({
        mutationFn: async ({ name }: { name: string }) => {
            if (!projectId) throw new Error("No project ID provided");
            const res = await fetch(`/api/projects/${projectId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            if (!res.ok) throw new Error("Failed to update project");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["project", projectId] });
            queryClient.invalidateQueries({ queryKey: ["projects"] });
        },
    });

    return {
        project: projectQuery.data,
        isLoading: projectQuery.isLoading,
        error: projectQuery.error,
        updateProjectName: (name: string) => updateProjectMutation.mutate({ name }),
        isUpdating: updateProjectMutation.isPending,
    };
}
