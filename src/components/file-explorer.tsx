import { CopyCheckIcon, CopyIcon, DownloadIcon, Edit2Icon, SaveIcon, XIcon } from "lucide-react";
import { useState, useMemo, useCallback, Fragment } from "react";
import JSZip from 'jszip';

import { Hint } from "@/src/components/ui/hint";
import { Button } from "./ui/button";
import { CodeView } from "./code-view";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "./ui/resizable";
import { convertFilesToTreeItems } from "../lib/utils";
import { TreeView } from "./tree-view";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import Editor from "@monaco-editor/react";

type FileCollection = { [path: string]: string };

function getLanguageFromExtension(fileName: string) {
  const extension = fileName.split('.').pop();
  const languageMap: { [key: string]: string } = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
  };
  return languageMap[extension || ''] || 'plaintext';
}

interface FileExplorerProps {
  files: FileCollection;
  fragmentId?: string;
  onFilesUpdate?: (files: FileCollection) => void;
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

export const FileExplorer = ({ files, fragmentId, onFilesUpdate }: FileExplorerProps) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(() => {
    const fileKeys = Object.keys(files);
    return fileKeys.length > 0 ? fileKeys[0] : null;
  });
  
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const treeData = useMemo(() => {
    return convertFilesToTreeItems(files);
  }, [files]);

  const handleFileSelect = useCallback((filePath: string) => {
    // If in edit mode, warn user
    if (editMode) {
      const confirm = window.confirm('You have unsaved changes. Do you want to discard them?');
      if (!confirm) return;
      setEditMode(false);
    }
    setSelectedFile(filePath);
    setEditedContent(files[filePath]);
  }, [files, editMode]);

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (selectedFile) {
      const contentToCopy = editMode ? editedContent : files[selectedFile];
      navigator.clipboard.writeText(contentToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedFile, files, editMode, editedContent]);

  const handleDownload = useCallback(async () => {
    const zip = new JSZip();
    
    // Add all files to the zip
    Object.entries(files).forEach(([path, content]) => {
      zip.file(path, content);
    });
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'source-code.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [files]);

  const handleEdit = () => {
    if (selectedFile) {
      setEditedContent(files[selectedFile]);
      setEditMode(true);
    }
  };

  const handleCancelEdit = () => {
    const confirm = window.confirm('Are you sure you want to discard your changes?');
    if (confirm) {
      setEditMode(false);
      setEditedContent("");
    }
  };

  const handleSave = async () => {
    if (!selectedFile || !fragmentId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/fragments/${fragmentId}/update-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: selectedFile,
          content: editedContent,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save file');
      }

      const result = await response.json();

      // Update local state
      if (onFilesUpdate && result.files) {
        onFilesUpdate(result.files);
      }

      setEditMode(false);
    } catch (error) {
      console.error('Error saving file:', error);
    } finally {
      setIsSaving(false);
    }
  };

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
                {editMode ? (
                  <>
                    <Hint text="Cancel editing" side="bottom">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        <XIcon className="size-4" />
                      </Button>
                    </Hint>
                    <Hint text="Save changes" side="bottom">
                      <Button 
                        variant="default" 
                        size="icon" 
                        onClick={handleSave}
                        disabled={isSaving || !fragmentId}
                      >
                        <SaveIcon className="size-4" />
                      </Button>
                    </Hint>
                  </>
                ) : (
                  <>
                    <Hint text="Download source code" side="bottom">
                      <Button variant="outline" size="icon" onClick={handleDownload}>
                        <DownloadIcon className="size-4" />
                      </Button>
                    </Hint>
                    <Hint text="Edit file" side="bottom">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={handleEdit}
                        disabled={!fragmentId}
                      >
                        <Edit2Icon className="size-4" />
                      </Button>
                    </Hint>
                    <Hint text="Copy to clipboard" side="bottom">
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={handleCopy}
                      >
                        {copied ? <CopyCheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                      </Button>
                    </Hint>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {editMode ? (
                <Editor
                  height="100%"
                  language={getLanguageFromExtension(selectedFile)}
                  value={editedContent}
                  onChange={(value) => setEditedContent(value || "")}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                  }}
                />
              ) : (
                <div className="overflow-auto h-full">
                  <CodeView 
                    lang={getLanguageFromExtension(selectedFile)}
                    code={files[selectedFile]} 
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No file selected
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}