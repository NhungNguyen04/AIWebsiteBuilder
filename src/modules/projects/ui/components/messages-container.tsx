import { useTRPC } from "@/src/trpc/client"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { MessageCard } from "./message-card";
import { MessageForm } from "./message-form";
import { useEffect, useRef } from "react";
import { Fragment } from "@prisma/client";
import { MessageLoading } from "./message-loading";
import { toast } from "sonner";

interface ProjectProps {
    projectId: string;
    activeFragment: Fragment | null;
    setActiveFragment: (fragment: Fragment | null) => void;
}
export const MessagesContainer = ({ projectId, activeFragment, setActiveFragment }: ProjectProps) => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const messagesQueryOptions = trpc.messages.getMany.queryOptions({
        projectId: projectId,
    }, {
        //TODO: temporary live message update
        refetchInterval: 5000
    });

    const { data: messages } = useSuspenseQuery(messagesQueryOptions);

    const bottomRef = useRef<HTMLDivElement>(null);
    const lastAssistantMessageIdRef = useRef<string | null>(null);

    const invalidateMessages = () => {
        queryClient.invalidateQueries({ queryKey: messagesQueryOptions.queryKey });
    };

    const stopJob = useMutation({
        ...trpc.messages.stop.mutationOptions(),
        onSuccess: invalidateMessages,
        onError: (error) => {
            toast.error(error.message || "Failed to stop generation");
        },
    });

    const retryJob = useMutation({
        ...trpc.messages.retry.mutationOptions(),
        onSuccess: invalidateMessages,
        onError: (error) => {
            toast.error(error.message || "Failed to retry");
        },
    });

    useEffect(() => {
        const lastAssistantMessage = messages.findLast(
            msg => msg.role === 'ASSISTANT');

        if (lastAssistantMessage?.fragment && lastAssistantMessage.id !== lastAssistantMessageIdRef.current) {
            setActiveFragment(lastAssistantMessage.fragment);
            lastAssistantMessageIdRef.current = lastAssistantMessage.id;
        }
    }, [messages]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    // Every USER message carries its own latest attempt in jobs[0] (see
    // messages.getMany). A retry adds a new Job row to an *earlier* USER
    // message rather than appending a new trailing message, so the
    // "is something running" check has to scan all USER messages' latest
    // jobs — not just whichever message happens to be last in the list.
    const userMessagesWithJobs = messages.filter(
        (msg): msg is typeof msg & { jobs: NonNullable<typeof msg.jobs> } =>
            msg.role === 'USER' && !!msg.jobs?.length
    );

    const activeJob = userMessagesWithJobs
        .map(msg => msg.jobs[0])
        .find(job => job.status === 'QUEUED' || job.status === 'RUNNING');

    const isJobActive = !!activeJob;

    // The message to attach the Retry button to: the most recent USER
    // message whose latest attempt ended in CANCELLED or FAILED, as long
    // as nothing else is currently active. Also requires that message to
    // actually be the *last* message in the thread (i.e. nothing newer —
    // like a fresh prompt — has been sent since), so Retry doesn't show
    // up stale on an old turn after the user has moved the conversation on.
    const lastMessage = messages?.[messages.length - 1];
    const isLastMessageError = lastMessage?.role === 'ASSISTANT' && lastMessage?.type === 'ERROR';

    const lastUserMessage = messages.findLast(msg => msg.role === 'USER');
    const lastUserJob = lastUserMessage?.jobs?.[0];
    const retryJob_ =
        !isJobActive && isLastMessageError && lastUserJob &&
        (lastUserJob.status === 'CANCELLED' || lastUserJob.status === 'FAILED')
            ? lastUserJob
            : undefined;

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="pt-2 pr-1">
                    {messages?.map((message) => {
                        // Attach the Retry button to the trailing ERROR
                        // message itself (that's what's visually flagged
                        // red), but the job it retries belongs to the user
                        // message computed above.
                        const isTrailingErrorMessage =
                            isLastMessageError && message.id === lastMessage?.id;

                        return (
                            <MessageCard 
                                key={message.id}
                                content={message.content}
                                role={message.role}
                                fragment={message.fragment}
                                createdAt={message.createdAt}
                                isActiveFragment={activeFragment?.id === message.fragment?.id}
                                type={message.type}
                                onFragmentClick={() => setActiveFragment(message.fragment)}
                                attachments={message.attachments as Array<{
                                    name: string;
                                    type: string;
                                    size: number;
                                    url?: string;
                                }> | undefined}
                                onRetry={
                                    isTrailingErrorMessage && retryJob_
                                        ? () => retryJob.mutate({ jobId: retryJob_.id })
                                        : undefined
                                }
                                isRetrying={isTrailingErrorMessage ? retryJob.isPending : false}
                            />
                        );
                    })}
                    {isJobActive && (
                        <MessageLoading
                            onStop={
                                activeJob
                                    ? () => stopJob.mutate({ jobId: activeJob.id })
                                    : undefined
                            }
                            isStopping={stopJob.isPending}
                        />
                    )}
                    <div ref={bottomRef}/>
                </div>
            </div>
            <div className="relative p-3 pt-1">
                <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent
                to-background/70 pointer-events-none"></div>
                <MessageForm projectId={projectId} isJobActive={isJobActive} />
            </div>
        </div>
    )
}