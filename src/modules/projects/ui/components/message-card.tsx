import { Card } from "@/src/components/ui/card";
import { Fragment, MessageRole, MessageType } from "@/generated/prisma";
import { cn } from "@/src/lib/utils";
import { format } from "date-fns";
import Image from "next/image";
import { ChevronRightIcon, Code2Icon, FileTextIcon } from "lucide-react";

interface UserMessageProps {
  content: string;
  attachments?: Array<{
    name: string;
    type: string;
    size: number;
    url?: string;
  }>;
}

interface AssistantMessageProps {
  content: string;
  fragment: Fragment | null;
  isActiveFragment: boolean;
  onFragmentClick: (fragment: Fragment) => void;
  createdAt: Date;
  type: MessageType;
}

interface FragmentCardProps {
  fragment: Fragment;
  isActiveFragment: boolean;
  onFragmentClick: (fragment: Fragment) => void;
}

const FragmentCard = ({
  fragment,
  isActiveFragment,
  onFragmentClick
}: FragmentCardProps) => {
  return (
    <button
      className={cn(
        "flex items-start text-start gap-2 border rounded-lg bg-muted w-fit p-3 hover:bg-secondary transition-colors",
        isActiveFragment && "bg-primary text-primary-foreground border-primary hover:bg-primary"
      )}
      onClick={() => onFragmentClick(fragment)}
    >
      <Code2Icon className="size-4 mt-0.5" />
      <div className="flex flex-col flex-1">
        <span className="text-sm font-medium line-clamp-1">
          {fragment.title}
        </span>
        <span className="text-sm">
          Preview
        </span>
      </div>
      <div className="flex items-center justify-center mt-0.5">
        <ChevronRightIcon className="size-4" />
      </div>
    </button>
  )
};

const UserMessage = ({ content, attachments }: UserMessageProps) => {
  return (
    <div className="flex justify-end pb-4 pr-2 pl-10">
      <Card className="rounded-lg bg-muted p-3 shadow-none border-none max-w-[80%] break-words">
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2 mb-2 border-b border-border/50">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-2 py-1 bg-background rounded text-xs"
              >
                <FileTextIcon className="size-3 text-muted-foreground" />
                <span className="text-muted-foreground truncate max-w-[120px]">
                  {file.name}
                </span>
                <span className="text-muted-foreground">
                  ({(file.size / 1024).toFixed(1)}KB)
                </span>
              </div>
            ))}
          </div>
        )}
        {content}
      </Card>
    </div>
  );
}

const AssistantMessage = ({
  content,
  fragment,
  isActiveFragment,
  onFragmentClick,
  createdAt,
  type
}: AssistantMessageProps) => {
  return (
    <div className={cn(
      "flex flex-col group px-2 pb-4",
      type === "ERROR" && "text-red-700 dark:text-red-500"
    )}>
      <div className="flex items-center gap-2 pl-2 mb-2">
        <Image
          src="/logo.svg"
          alt="Codis Logo"
          width={18}
          height={18}
         />
        <span className="text-sm font-medium">
          Codis
        </span>
        <span className="text-xs text-muted-foreground opacity-0 transition-opacity
          group-hover:opacity-100">
          {format(createdAt, "HH:mm 'on' MMM dd, yyyy")}
        </span>
      </div>
      <div className="pl-8.5 flex flex-col gap-y-4">
        <span>
          {content}
        </span>
        {fragment && (
          <FragmentCard 
            fragment={fragment}
            isActiveFragment={isActiveFragment}
            onFragmentClick={onFragmentClick}
          />
        )}
      </div>
    </div>
  )
};

interface MessageCardProps {
  content: string;
  role: MessageRole;
  fragment: Fragment | null;
  createdAt: Date;
  isActiveFragment: boolean;
  type: MessageType;
  onFragmentClick: (fragment: Fragment) => void;
  attachments?: Array<{
    name: string;
    type: string;
    size: number;
    url?: string;
  }>;
}

export const MessageCard = ({
  content,
  role,
  fragment,
  createdAt,
  isActiveFragment,
  type,
  onFragmentClick,
  attachments
}: MessageCardProps) => {

  console.log("Rendering MessageCard with role:", role);

  if (role === "ASSISTANT") {
    return (
      <AssistantMessage 
        content={content}
        fragment={fragment}
        isActiveFragment={isActiveFragment}
        onFragmentClick={onFragmentClick}
        createdAt={createdAt}
        type={type}
      />
    )
  }

  return (
    <UserMessage content={content} attachments={attachments} />
  );
}