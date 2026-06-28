import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SquareIcon } from "lucide-react";

const ShimmerMessages = () => {
  const messages = [
    "Thinking...",
    "Loading...",
    "Analyzing request...",
    "Crafting components...",
    "Optimizing layout...",
    "Generating response...",
    "Please wait...",
    "Almost done...",
    "Finalizing..."
  ]

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, 2000);

    return() => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-base text-muted-foreground animate-pulse">
        {messages[currentMessageIndex]}
      </span>
    </div>
  )
};

interface MessageLoadingProps {
  onStop?: () => void;
  isStopping?: boolean;
}

export const MessageLoading = ({ onStop, isStopping }: MessageLoadingProps) => {

  return (
    <div className="flex flex-col group px-2 pb-4">
      <div className="flex items-center gap-2 pl-2 mb-2">
        <Image
          src="/logo.svg"
          alt="Codis"
          width={18}
          height={18}
          className="shrink-0"
        />
        <span className="text-sm font-medium">Codis</span>
      </div>
      <div className="pl-8.5 flex items-center justify-between gap-y-4">
        <ShimmerMessages />
        {onStop && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs shrink-0"
            onClick={onStop}
            disabled={isStopping}
          >
            <SquareIcon className="size-3 fill-current" />
            {isStopping ? "Stopping..." : "Stop"}
          </Button>
        )}
      </div>
    </div>
  )
}