"use client"

import { useMutation } from "@tanstack/react-query";
import { Button } from "../components/ui/button"
import { useTRPC } from "../trpc/client"
import { toast } from "sonner";

function page() {
  const trpc = useTRPC();
  const invoke = useMutation(trpc.invoke.mutationOptions({
    onSuccess: () => {
      toast.success("Background job invoked successfully!");
    }
  }));
  return (
    <div className="p-4 max-w-7xl mx-auto">
      <Button disabled={invoke.isPending} onClick={() => {invoke.mutate({text: 'Nhugn'})}}>
        Invoke Background Job
      </Button>
    </div>
  )
}

export default page
