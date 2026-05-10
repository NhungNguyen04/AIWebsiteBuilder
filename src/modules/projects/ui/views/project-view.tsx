"use client";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/src/components/ui/resizable";
import { MessagesContainer } from "../components/messages-container";
import { Suspense, useState } from "react";
import { Fragment } from "@prisma/client";
import { ProjectHeader } from "../components/project-header";
import { FragmentWeb } from "../components/fragment-web";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2Icon, CrownIcon, EyeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileExplorer } from "@/src/components/file-explorer";

interface Props {
  projectId: string;
}

export const ProjectView = ({ projectId }: Props) => {
  const [activeFragment, setActiveFragment] = useState<Fragment | null>(null);
  const [tabState, setTabState] = useState<"preview" | "code">("preview");
  const [currentFiles, setCurrentFiles] = useState<{ [path: string]: string } | null>(null);

  const handleFilesUpdate = (newFiles: { [path: string]: string }) => {
    setCurrentFiles(newFiles);
    
    // Also update activeFragment to reflect changes
    if (activeFragment) {
      setActiveFragment({
        ...activeFragment,
        files: newFiles
      });
    }
  };

  return (
    <div className="h-screen">
      <ResizablePanelGroup>
        <ResizablePanel minSize={200} defaultSize={35} className="flex flex-col min-h-0">
          <Suspense fallback={<div>Loading Project...</div>}>
            <ProjectHeader projectId={projectId} />
          </Suspense>

          <MessagesContainer 
            projectId={projectId}
            activeFragment={activeFragment}
            setActiveFragment={(fragment) => {
              setActiveFragment(fragment);
              setCurrentFiles(fragment?.files as { [path: string]: string } | null);
            }}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={65} minSize={50}>
          <Tabs
            className="h-full gap-y-0"
            defaultValue="preview"
            value={tabState}
            onValueChange={(value) => setTabState(value as "preview" | "code")}>
            <div className="w-full flex items-center p-2 border-b gap-x-2">
              <TabsList className="h-8 p-0 border rounded-md">
                <TabsTrigger value="preview" className="rounded-md">
                  <EyeIcon /> <span>Demo</span>
                </TabsTrigger>
                <TabsTrigger value="code" className="rounded-md">
                  <Code2Icon /> <span>Code</span>
                </TabsTrigger>
              </TabsList>
              <div className="ml-auto flex items-center gap-x-2">
                <Button asChild size="sm" variant="default">
                  <Link href="/pricing">
                    <CrownIcon /> Upgrade
                  </Link>
                </Button>
              </div>
            </div>
            <TabsContent value="preview">
              {activeFragment && (
                <FragmentWeb 
                  data={activeFragment} 
                  onFilesUpdate={handleFilesUpdate}
                />
              )}
            </TabsContent>
            <TabsContent value="code" className="min-h-0">
              {(currentFiles || activeFragment?.files) && (
                <FileExplorer 
                  files={(currentFiles || activeFragment?.files) as { [path: string]: string }}
                  fragmentId={activeFragment?.id}  // Add this
                  onFilesUpdate={handleFilesUpdate}
                />
              )}
        </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}