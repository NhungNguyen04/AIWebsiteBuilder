import { CopyCheckIcon, CopyIcon, DownloadIcon } from "lucide-react";
import { useState, useMemo, useCallback, Fragment } from "react";
import JSZip from 'jszip';

import { Hint } from "@/src/components/ui/hint";
import { Button } from "./ui/button";
import { CodeView } from "./code-view";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "./ui/resizable";
import { convertFilesToTreeItems } from "../lib/utils";
import { TreeView } from "./tree-view";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

type FileCollection = { [path: string]: string };

function getLanguageFromExtension(fileName: string) {
  const extension = fileName.split('.').pop();
  return extension || 'txt';
}

interface FileExplorerProps {
  files: FileCollection;
}

interface FileBreadcrumbProps {
  filePath: string;
}

const FileBreadcrumb = ({ filePath }: FileBreadcrumbProps) => {
  const pathSegments = filePath.split("/");
  const maxSegments = 4;

  return pathSegments.map((segment, index) => {
    const isLast = index === pathSegments.length - 1;

    const renderBreadcrumbItems = () => {

      if (pathSegments.length <= maxSegments) {
        const isLast = index === pathSegments.length - 1;

        return (
          <Fragment key={index}>
            <BreadcrumbItem>
              { isLast ? (
                <BreadcrumbPage className="font-medium">
                  {segment}
                </BreadcrumbPage>
              ): (
                <span className="text-muted-foreground">
                  {segment}
                </span>
              )}
            </BreadcrumbItem>
            { !isLast && (<BreadcrumbSeparator />) }
          </Fragment>
        )
      } else {
        const firstSegment = pathSegments[0];
        const lastTwoSegments = pathSegments.slice(-2);

        return (
          <>
            <BreadcrumbItem>
              <span className="text-muted-foreground">
                {firstSegment}
              </span>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <span className="text-muted-foreground">...</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </BreadcrumbItem>
            {lastTwoSegments.map((seg, idx) => {
              const isLast = idx === lastTwoSegments.length - 1;
              return (
                <Fragment key={idx}>
                  <BreadcrumbItem>
                    { isLast ? (
                      <BreadcrumbPage className="font-medium">
                        {seg}
                      </BreadcrumbPage>
                    ) : (
                      <span className="text-muted-foreground">
                        {seg}
                      </span>
                    )}
                  </BreadcrumbItem>
                  { !isLast && (<BreadcrumbSeparator />) }
                </Fragment>
              )
            })}
          </>
        )
      }
    }

    return (
      <Breadcrumb>
        <BreadcrumbList>
          {renderBreadcrumbItems()}
        </BreadcrumbList>
      </Breadcrumb>
    )
  });
}

export const FileExplorer = ({ files }: FileExplorerProps) => {

  const [selectedFile, setSelectedFile] = useState<string | null>(() => {
    const fileKeys = Object.keys(files);
    return fileKeys.length > 0 ? fileKeys[0] : null;
  });
  const treeData = useMemo(() => {
    return convertFilesToTreeItems(files);
  }, [files]);

  const handleFileSelect = useCallback((filePath: string) => {
    setSelectedFile(filePath);
  }, [files]);
  const [ copied, setCopied ] = useState(false);

  const handleCopy = useCallback(() => {
    if (selectedFile) {
      navigator.clipboard.writeText(files[selectedFile]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedFile, files]);

  const handleDownload = useCallback(async () => {
    const zip = new JSZip();
    
    // Add all files to the zip
    Object.entries(files).forEach(([path, content]) => {
      zip.file(path, content);
    });
    
    // Generate the zip file
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // Create a download link and trigger download
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'source-code.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [files]);

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={30} minSize={30} className="bg-sidebar">
        <TreeView 
          data={treeData}
          value={selectedFile}
          onSelect={handleFileSelect}
        />
      </ResizablePanel>
      <ResizableHandle className="hover:bg-primary transition-colors"/>
      <ResizablePanel defaultSize={70} minSize={50}>
        { selectedFile && files[selectedFile] ? (
          <div className="w-full h-full flex flex-col">
            <div className="border-b bg-sidebar px-4 py-2 flex justify-between items-center gap-x-2">
              <FileBreadcrumb filePath={selectedFile} />
              <div className="flex gap-x-2">
                <Hint text="Download source code" side="bottom">
                  <Button variant="outline" size="icon" onClick={handleDownload}>
                    <DownloadIcon className="size-4" />
                  </Button>
                </Hint>
                <Hint text="Copy to clipboard" side="bottom">
                  <Button variant="outline" size="icon"
                    className="ml-auto" onClick={handleCopy}
                    disabled={false}>
                     {copied ? <CopyCheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                  </Button>
                </Hint>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <CodeView 
                lang={getLanguageFromExtension(selectedFile)}
                code={files[selectedFile]} />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No file selected
          </div>) }
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}