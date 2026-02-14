import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Project } from "@/lib/schemas/base";

export function useProjects() {
    const queryClient = useQueryClient();

    const projectsQuery = useQuery<Project[]>({
        queryKey: ["projects"],
        queryFn: async () => {
            const res = await fetch("/api/projects");
            if (!res.ok) throw new Error("Failed to fetch projects");
            return res.json();
        },
    });

    const createProjectMutation = useMutation({
        mutationFn: async (newProject: Partial<Project>) => {
            const res = await fetch("/api/projects", {
                method: "POST",
                body: JSON.stringify(newProject),
            });
            if (!res.ok) throw new Error("Failed to create project");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
        },
    });

    return {
        projects: projectsQuery.data ?? [],
        isLoading: projectsQuery.isLoading,
        error: projectsQuery.error,
        createProject: createProjectMutation.mutate,
        isCreating: createProjectMutation.isPending,
    };
}
