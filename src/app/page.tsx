"use client"

import { useMutation } from "@tanstack/react-query";
import { Button } from "../components/ui/button"
import { useTRPC } from "../trpc/client"
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import React, { useState } from "react";

function page() {
  const trpc = useTRPC();
  const [value, setValue] = useState('');
  const createdMessage = useMutation(trpc.messages.create.mutationOptions({
    onSuccess: () => {
      toast.success("Message created!");
    }
  }));
  return (
    <div className="p-4 max-w-7xl mx-auto">
      <Input value={value} onChange={(e) => setValue(e.target.value)} />
      <Button disabled={createdMessage.isPending} onClick={() => {createdMessage.mutate({value: value})}} className="mt-4">
        Invoke Background Job
      </Button>
    </div>
  )
}

export default page
