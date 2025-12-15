"use client"

import { useMutation } from "@tanstack/react-query";
import { Button } from "../components/ui/button"
import { useTRPC } from "../trpc/client"
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

function Page() {
  const trpc = useTRPC();
  const [value, setValue] = useState('');
  const router = useRouter();
  const createdProject = useMutation(trpc.projects.create.mutationOptions({
    onError: (error) => { toast.error(error.message); },
    onSuccess: (data) => { 
      toast.success("Project created successfully!");
      router.push(`/project/${data.id}`);
    }
  }));
  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <div className="max-w-7xl max mx-auto flex items-center flex-col gap-4 justify-center">
        <Input value={value} onChange={(e) => setValue(e.target.value)} />
        <Button disabled={createdProject.isPending} onClick={() => {createdProject.mutate({value: value})}} className="mt-4">
          Submit
        </Button>
      </div>
    </div>
  )
}

export default Page
