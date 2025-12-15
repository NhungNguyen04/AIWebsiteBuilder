"use client";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/src/components/ui/resizable";
import { useTRPC } from "@/src/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MessagesContainer } from "../components/messages-container";

interface Props {
  projectId: string;
}

export const ProjectView = ({ projectId }: Props) => {
  const trpc = useTRPC();
  // const { data: project } = useSuspenseQuery(trpc.projects.getOne.queryOptions({
  //   id: projectId
  // }));

  return (
    <div className="h-screen">
      <ResizablePanelGroup direction="horizontal">
      <ResizablePanel minSize={200} defaultSize={35} className="flex flex-col min-h-0">
        <MessagesContainer projectId={projectId}/>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={65} minSize={50}>
        TODO: Preview
      </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
