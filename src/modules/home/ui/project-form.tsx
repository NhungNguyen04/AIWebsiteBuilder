"use client"

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/src/lib/utils";
import { useState } from "react";
import { Form, FormField } from "@/components/ui/form";
import TextareaAutosize from 'react-textarea-autosize';
import { Button } from "@/components/ui/button";
import { ArrowUpIcon, Loader2Icon } from "lucide-react";
import { useTRPC } from "@/src/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PROJECT_TEMPLATES } from "../constants";

const formSchema = z.object({
  value: z.string()
          .min(1, { message: "Value is required!"})
          .max(10000, { message: "Value is too long!"}),
})

export const ProjectForm = () => {
  const [isFocused, setIsFocused] = useState(false);
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
      queryClient.invalidateQueries (
        trpc.projects.getMany.queryOptions()
      );
      router.push(`/project/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create project");
    }
  });
  
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      await createProject.mutateAsync({
        value: data.value
      });
      form.reset();
    } catch (error) {
      // Error already handled by onError callback
    }
  }

  const isPending = createProject.isPending;
  const isButtonDisabled = isPending || !form.formState.isValid;
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
                disabled={isPending}
              />
            )}
          />
          <div className="flex gap-x-2 items-end justify-between pt-2">
            <div className="text-[10px] text-muted-foreground font-mono">
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center
              gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span>&#8984;</span>Enter
              </kbd>
              &nbsp;to send
            </div>
            <Button
              className={cn(
                "size-8 rounded-full",
                isButtonDisabled && "bg-muted-foreground border",
              )}
              disabled={isButtonDisabled}>
                {
                  isPending ? (
                    <Loader2Icon  className="size-4 animate-spin"/>
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