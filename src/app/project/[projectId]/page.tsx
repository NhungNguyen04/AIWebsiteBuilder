import { ProjectView } from "@/src/modules/projects/ui/views/project-view";
import { getQueryClient, trpc } from "@/src/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

interface ProjectPageProps {
  params: Promise<{ 
    projectId: string 
  }>;
}

const ProjectPage = async ({ params }: ProjectPageProps) => {
  const { projectId } = await params;

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.messages.getMany.queryOptions({
    projectId
  }));
  await queryClient.prefetchQuery(trpc.projects.getOne.queryOptions({
    id: projectId
  }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<div>Loading project...</div>}>
        <ProjectView projectId={projectId} />
      </Suspense>
    </HydrationBoundary>
  );
}

export default ProjectPage;