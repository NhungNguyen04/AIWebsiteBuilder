"use client";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/src/components/ui/resizable";
import { useTRPC } from "@/src/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MessagesContainer } from "../components/messages-container";
import { Suspense, useState } from "react";
import { Fragment } from "@/generated/prisma";
import { ProjectHeader } from "../components/project-header";
import { FragmentWeb } from "../components/fragment-web";

interface Props {
  projectId: string;
}

export const ProjectView = ({ projectId }: Props) => {
  const [activeFragment, setActiveFragment] = useState<Fragment | null>(null);

  return (
    <div className="h-screen">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel minSize={200} defaultSize={35} className="flex flex-col min-h-0">
        <Suspense fallback={<div>Loading Project...</div>}>
            <ProjectHeader projectId={projectId} />
          </Suspense>

          <MessagesContainer 
            projectId={projectId}
            activeFragment={activeFragment}
            setActiveFragment={setActiveFragment}
          />
        </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={65} minSize={50}>
        { activeFragment && <FragmentWeb data={activeFragment} /> }
      </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
