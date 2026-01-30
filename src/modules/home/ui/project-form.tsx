"use client"

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/src/lib/utils";
import { useState, useRef } from "react";
import { Form, FormField } from "@/components/ui/form";
import TextareaAutosize from 'react-textarea-autosize';
import { Button } from "@/components/ui/button";
import { ArrowUpIcon, Loader2Icon, PaperclipIcon, XIcon, FileTextIcon } from "lucide-react";
import { useTRPC } from "@/src/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PROJECT_TEMPLATES } from "../constants";
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE, readFileAsText, extractTextFromPDF, type FileAttachment, extractTextFromDOCX } from "@/src/lib/file-upload";

const formSchema = z.object({
  value: z.string()
          .min(1, { message: "Value is required!"})
          .max(10000, { message: "Value is too long!"}),
})

export const ProjectForm = () => {
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      value: "",
    },
  });

  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const createProject = useMutation({
    ...trpc.projects.create.mutationOptions(),
    onSuccess: (data) => {
      queryClient.invalidateQueries(
        trpc.projects.getMany.queryOptions()
      );
      router.push(`/project/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create project");
    }
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsProcessingFile(true);

    try {
      const newAttachments: FileAttachment[] = [];

      for (const file of files) {
        // Validate file type
        if (!Object.keys(ALLOWED_FILE_TYPES).includes(file.type)) {
          toast.error(`File type ${file.type} is not supported`);
          continue;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`File ${file.name} is too large (max 10MB)`);
          continue;
        }

        // In handleFileSelect function
        let content = '';
        try {
          if (file.type === 'application/pdf') {
            content = await extractTextFromPDF(file);
          } else if (
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.type === 'application/msword'
          ) {
            content = await extractTextFromDOCX(file); // Use this for DOCX
          } else {
            content = await readFileAsText(file); // Only for .txt, .md
          }
        } catch (err) {
          console.error('Error reading file:', err);
          toast.error(`Failed to read file ${file.name}`);
          continue;
}
        newAttachments.push({
          name: file.name,
          type: file.type,
          size: file.size,
          content,
        });
      }

      setAttachments(prev => [...prev, ...newAttachments]);
      toast.success(`${newAttachments.length} file(s) uploaded`);
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Failed to process files');
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      await createProject.mutateAsync({
        value: data.value,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      form.reset();
      setAttachments([]);
    } catch (error) {
      // Error already handled by onError callback
    }
  }

  const isPending = createProject.isPending;
  const isButtonDisabled = isPending || !form.formState.isValid || isProcessingFile;
  const showUsage = false;

  const onSelectTemplate = (templateValue: string) => {
    form.setValue("value", templateValue, { shouldDirty: true, shouldValidate: true, shouldTouch: true });
  }

  return (
    <Form {...form}>
      <section className="space-y-6">
        <form 
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            "relative border p-4 pt-1 rounded-xl bg-sidebar dark:bg-sidebar transition-all",
            isFocused && "shadow-xs",
            showUsage && "rounded-t-none"
          )}>

          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-3 pb-2">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm"
                >
                  <FileTextIcon className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground truncate max-w-[150px]">
                    {file.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({(file.size / 1024).toFixed(1)}KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    disabled={isPending}
                  >
                    <XIcon className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <FormField 
            control={form.control}
            name="value"
            render={({field}) => (
              <TextareaAutosize
                {...field}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="pt-4 resize-none border-none w-full outline-none bg-transparent"
                minRows={2}
                maxRows={8}
                placeholder="What would you like to build?"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    form.handleSubmit(onSubmit)();
                  }
                }}
                disabled={isPending || isProcessingFile}
              />
            )}
          />

          <div className="flex gap-x-2 items-end justify-between pt-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={Object.values(ALLOWED_FILE_TYPES).join(',')}
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={isPending || isProcessingFile}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending || isProcessingFile}
              >
                {isProcessingFile ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <PaperclipIcon className="size-4" />
                )}
                <span className="ml-1 text-xs hidden sm:inline">Attach</span>
              </Button>

              <div className="text-[10px] text-muted-foreground font-mono">
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center
                gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span>&#8984;</span>Enter
                </kbd>
                &nbsp;to send
              </div>
            </div>

            <Button
              className={cn(
                "size-8 rounded-full",
                isButtonDisabled && "bg-muted-foreground border",
              )}
              disabled={isButtonDisabled}>
                {
                  isPending ? (
                    <Loader2Icon className="size-4 animate-spin"/>
                  ) : (
                    <ArrowUpIcon />
                  )
                }
            </Button>
          </div>
        </form>

        <div className="flex-wrap justify-center gap-2 hidden md:flex max-w-3xl">
          {PROJECT_TEMPLATES.map((template) => (
            <Button 
              key={template.title}
              variant="outline"
              size="sm"
              className="bg-white dark:bg-sidebar"
              onClick={() => onSelectTemplate(template.prompt)}
            >
              {template.emoji} {template.title}
            </Button>
          ))}
        </div>
      </section>
    </Form>
  )
}