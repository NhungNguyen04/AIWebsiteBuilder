
"use client"
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/src/trpc/client"
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2Icon } from "lucide-react";

export const ProjectsList = () => {
  const trpc = useTRPC();
  const router = useRouter();
  const { data: projects, isLoading } = useQuery(trpc.projects.getMany.queryOptions());
  const [navigatingToId, setNavigatingToId] = useState<string | null>(null);

  const handleProjectClick = (projectId: string) => {
    setNavigatingToId(projectId);
    router.push(`/project/${projectId}`);
  };

  return (
    <div className="w-full bg-white dark:bg-sidebar rounded-xl p-8 border flex flex-col gap-y-6 sm:gap-y-4">
      <h2 className="text-2xl font-semibold">
        Codis code this
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {isLoading ? (
          <>
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </>
        ) : projects?.length === 0 ? (
          <div className="col-span-full text-center">
            <p className="text-sm text-muted-foreground">
              No projects found
            </p>
          </div>
        ) : (
          projects?.map((project) => (
            <Button
              key={project.id}
              variant="outline"
              className="font-normal h-auto justify-start w-full text-start p-4 relative"
              onClick={() => handleProjectClick(project.id)}
              disabled={navigatingToId !== null}
            >
              {navigatingToId === project.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
                  <Loader2Icon className="size-5 animate-spin text-primary" />
                </div>
              )}
              <div className="flex items-center gap-x-4">
                <Image
                  src="/logo.svg"
                  alt="Codis"
                  width={32}
                  height={32}
                  className="object-contain"
                />
                <div className="flex flex-col">
                  <h3 className="truncate font-medium">{project.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(project.updatedAt, {
                      addSuffix: true
                    })}
                  </p>
                </div>
              </div>
            </Button>
          ))
        )}
      </div>
    </div>
  )
}